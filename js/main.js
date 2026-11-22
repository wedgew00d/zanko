// 残光 ZANKO — window layout, input (keyboard, gamepad, touch), fixed-step loop, menus, sound.
(function () {
'use strict';
const Z = ZankoSim, R = ZankoRender, C = Z.C;
const $ = id => document.getElementById(id), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const frame = $('frame'), band = $('band'), canvas = $('game');
R.ctx = canvas.getContext('2d', { alpha: false });
let sim = Z.create(), mode = 'title', isTouch = matchMedia('(pointer:coarse)').matches, clearT = 0;

// ---- drawing resolution: the canvas never holds more than this many pixels (x1.6 with a mouse). Every full-screen pass
// (bloom, grain, the shader) costs in proportion, so this is the one setting that makes everything lighter at once.
const QUAL = [{ name: '高', px: 1.6e6 }, { name: '標準', px: 1.0e6 }, { name: '軽量', px: 0.6e6 }];
let qual = isTouch ? 1 : 0, qualAuto = false, slow = 0, playFps = 0;
try { const v = localStorage.getItem('zanko.qual'); if (v !== null && QUAL[+v]) qual = +v; } catch (_) {}
function qualLabel() { $('qualBtn').textContent = '描画の解像度：' + QUAL[qual].name + (qualAuto ? '（自動で下げた）' : '') + '　' + canvas.width + '×' + canvas.height + (playFps ? '・' + playFps + 'fps' : ''); }
function setQual(q, auto) { qual = q; qualAuto = !!auto; slow = 0; if (!auto) try { localStorage.setItem('zanko.qual', String(q)); } catch (_) {} layout(); qualLabel(); }

// Touch devices that cannot keep up get lighter by themselves, one step at a time (never heavier again by themselves; every step can be undone in the menu):
// resolution down a step -> colour grading off (the only pass that runs every frame) -> all of the atmosphere off.
// Under 30 fps for 2 seconds (in-app browsers such as LINE's, which seem to draw without the GPU): straight to the lightest setting.
let crawl = 0, noteT = 0;
function note(text) { const el = $('note'); el.textContent = text; el.classList.add('show'); clearTimeout(noteT); noteT = setTimeout(() => el.classList.remove('show'), 4500); }
function fxLabels() { $('fxBtn').textContent = '空気感：' + (R.fx ? 'ON' : 'OFF'); $('gradeBtn').textContent = '色調整（LUT・トーン）：' + (R.grade ? 'ON' : 'OFF'); }
function lighten() {
  if (crawl >= 4 && (R.fx || qual < QUAL.length - 1)) { R.fx = false; fxLabels(); setQual(QUAL.length - 1, true); crawl = 0; note('動作が重いため、空気感を切り、解像度を下げました（メニューで戻せます）'); return; }
  if (slow < 6) return;
  if (qual < QUAL.length - 1) { setQual(qual + 1, true); note('動作が重いため、描画の解像度を下げました（メニューで戻せます）'); }
  else if (R.fx && R.grade) { R.grade = false; fxLabels(); slow = 0; note('動作が重いため、色調整を切りました（メニューで戻せます）'); }
  else if (R.fx) { R.fx = false; fxLabels(); slow = 0; note('動作が重いため、空気感を切りました（メニューで戻せます）'); }
}
// In-app browsers of chat and social apps (not the Claude app, where this runs well). LINE opens a link in the real browser when the address carries openExternalBrowser=1.
const inApp = /\bLine\/|FBAN|FBAV|Instagram/i.test(navigator.userAgent), inLine = /\bLine\//i.test(navigator.userAgent);
if (inApp) { const el = $('inapp'); el.hidden = false; if (inLine) { const u = new URL(location.href); u.searchParams.set('openExternalBrowser', '1'); const a = document.createElement('a'); a.href = u.href; a.textContent = '外部ブラウザで開く'; el.appendChild(a); } }

// ---- layout: the view is 204 to 240 world rows tall (closer on short screens); its width follows the window ----
function layout() {
  const fw = frame.clientWidth, fh = frame.clientHeight; if (!fw || !fh) return;
  const bandMode = fh / fw > 1.25; let bw = fw, bh = fh;
  if (bandMode) bh = Math.round(Math.min(fw * 0.8, fh * 0.56));           // tall window: game on top, thumbs below
  const vh = clamp(204 + (bh - 430) / 250 * 36, 204, 240);                // short screens get a closer view
  let vw = vh * bw / bh; if (vw > 640) { vw = 640; bw = Math.round(bh * vw / vh); }
  frame.classList.toggle('band-mode', bandMode); frame.style.setProperty('--band-h', bh + 'px');
  band.style.left = Math.round((fw - bw) / 2) + 'px'; band.style.width = bw + 'px'; band.style.height = bh + 'px';
  let pr = Math.min(window.devicePixelRatio || 1, 3); const maxPixels = QUAL[qual].px * (isTouch ? 1 : 1.6);
  if (bw * bh * pr * pr > maxPixels) pr = Math.sqrt(maxPixels / (bw * bh));
  canvas.width = Math.round(bw * pr); canvas.height = Math.round(bh * pr);
  R.VW = vw; R.VH = vh; R.css = bh / vh; R.K = canvas.height / vh;
  measureButtons();
}
let queued = false;
function queueLayout() { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; layout(); }); }
addEventListener('resize', queueLayout); addEventListener('orientationchange', queueLayout);
if (window.visualViewport) visualViewport.addEventListener('resize', queueLayout);
document.addEventListener('fullscreenchange', queueLayout);

// ---- input ----
const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump', KeyK: 'jump', KeyX: 'jump', KeyW: 'interact', ArrowUp: 'interact', KeyE: 'interact', KeyF: 'interact',
  KeyJ: 'attack', KeyZ: 'attack', ShiftLeft: 'dash', ShiftRight: 'dash', KeyL: 'dash', KeyC: 'dash' };
const held = { left: false, right: false, jump: false, dash: false, attack: false, interact: false };
const latch = { jump: 0, dash: 0, attack: 0, interact: 0 };          // a press shorter than one step still counts
let tapDash = null, lastTap = { dir: 0, at: 0 }, dashLatch = 0;
const mouse = { attack: false, jump: false };   // left button: slash, right button: jump (and, in open air, air dash)
let rmbRecent = 0;
addEventListener('keydown', e => {
  const act = KEYMAP[e.code];
  if (act || e.code === 'Escape' || e.code === 'F3') e.preventDefault();
  if (e.repeat) return;
  if (mode === 'title' && (e.code === 'Enter' || e.code === 'Space' || act === 'attack')) { start(); return; }
  if (mode === 'talk') { if (act === 'interact' || act === 'attack' || act === 'jump' || e.code === 'Enter') talkNext(); else if (e.code === 'Escape') talkClose(); return; }
  if (e.code === 'Escape' || e.code === 'KeyP') { if (mode === 'play') setMode('pause'); else if (mode === 'pause') setMode('play'); return; }
  if (e.code === 'F3') { $('debug').hidden = !$('debug').hidden; return; }
  if (e.code === 'KeyH') { toggleBoxes(); return; }
  if (!act) return;
  held[act] = true; if (act in latch) latch[act] = 2;
  if (act === 'left' || act === 'right') {       // press the same direction twice quickly: dash
    const dir = act === 'left' ? -1 : 1, now = performance.now();
    if (lastTap.dir === dir && now - lastTap.at < 240) tapDash = { dir };
    lastTap = { dir, at: now };
  }
});
addEventListener('keyup', e => { const act = KEYMAP[e.code]; if (act) held[act] = false; });
function releaseAll() { for (const k in held) held[k] = false; mouse.attack = mouse.jump = false; dashLatch = 0; tapDash = null; stickEnd(); pointers.clear(); showButtons({}); }

// touch: a stick that appears under the left thumb, and three round buttons hit-tested by position,
// so a thumb can slide from DASH onto JUMP without lifting.
const stickEl = $('stick'), knob = $('stickKnob'), stick = { id: null, ox: 0, oy: 0, axis: 0 }, pointers = new Map();
let buttons = [];
function measureButtons() { buttons = [...document.querySelectorAll('.tbtn')].map(el => { const r = el.getBoundingClientRect(); return { el, act: el.dataset.act, x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 }; }); }
function buttonAt(x, y) { let best = null, bd = 1e9; for (const b of buttons) { const d = Math.hypot(x - b.x, y - b.y) / b.r; if (d < 1.75 && d < bd) { best = b; bd = d; } } return best; }   // nearest button, with a generous margin: no dead gaps between them
function showButtons(on) { for (const b of buttons) b.el.classList.toggle('on', !!on[b.act]); }
function stickStart(e) { const half = (stickEl.offsetWidth || 116) / 2 + 6; stick.id = e.pointerId; stick.ox = clamp(e.clientX, half, frame.clientWidth * 0.5); stick.oy = clamp(e.clientY, half, frame.clientHeight - half); stickEl.style.left = stick.ox + 'px'; stickEl.style.top = stick.oy + 'px'; stickEl.classList.add('active'); stickMove(e); }
function stickMove(e) {
  const reach = (stickEl.offsetWidth || 116) * 0.31; let dx = e.clientX - stick.ox;
  if (Math.abs(dx) > reach) { stick.ox = e.clientX - Math.sign(dx) * reach; stickEl.style.left = stick.ox + 'px'; dx = Math.sign(dx) * reach; }   // the base follows the thumb: reversing is quick
  stick.axis = Math.abs(dx) < reach * 0.3 ? 0 : Math.sign(dx);
  knob.style.transform = 'translate(' + dx + 'px,' + clamp(e.clientY - stick.oy, -reach * 0.4, reach * 0.4) + 'px)';
}
function stickEnd() { stick.id = null; stick.axis = 0; stickEl.classList.remove('active'); stickEl.style.left = stickEl.style.top = ''; knob.style.transform = ''; }
function setTouch(v) { if (isTouch === v) return; isTouch = v; document.body.classList.toggle('touch', v); layout(); }
frame.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch') setTouch(true);
  if (mode === 'talk' && !e.target.closest('button')) { e.preventDefault(); talkNext(); return; }
  if (e.target.closest('button,.overlay') || mode !== 'play' || e.pointerType !== 'touch') return;   // (mouse: see mousedown below)
  e.preventDefault();
  if (stick.id === null && e.clientX < frame.clientWidth * 0.45 && !buttonAt(e.clientX, e.clientY)) { stickStart(e); return; }
  const b = buttonAt(e.clientX, e.clientY); pointers.set(e.pointerId, b ? b.act : null);
  if (b) press(b.act);
});
// On touch a tap on DASH runs the whole dash, so the thumb is free to move to JUMP.
function press(act) { latch[act] = 2; if (act === 'dash') dashLatch = C.DASH_T; }
addEventListener('pointermove', e => {
  if (e.pointerId === stick.id) stickMove(e);
  else if (pointers.has(e.pointerId)) { const b = buttonAt(e.clientX, e.clientY), was = pointers.get(e.pointerId), now = b ? b.act : null; if (now !== was) { pointers.set(e.pointerId, now); if (now) press(now); } }
});
function pointerEnd(e) { if (e.pointerId === stick.id) stickEnd(); pointers.delete(e.pointerId); if (isTouch) showButtons(touchHeld()); }
function touchHeld() { const t = {}; for (const act of pointers.values()) if (act) t[act] = true; return t; }
addEventListener('pointerup', pointerEnd); addEventListener('pointercancel', pointerEnd);
// Safety net: once no finger is on the screen, nothing touch-driven may stay held, whatever events were missed.
for (const type of ['touchend', 'touchcancel']) addEventListener(type, e => { if (e.touches.length === 0 && (stick.id !== null || pointers.size)) { stickEnd(); pointers.clear(); showButtons({}); } }, { passive: true });
// Mouse buttons use mouse events: a second button pressed while one is held does not fire pointerdown.
const mouseAct = e => e.button === 0 ? 'attack' : e.button === 2 ? 'jump' : null;
// (the click that closes a text panel must not also count as a slash: hence the short guard after closing)
frame.addEventListener('mousedown', e => { const act = mouseAct(e); if (!act || mode !== 'play' || e.target.closest('button,.overlay') || performance.now() - talkClosedAt < 250) return; e.preventDefault(); mouse[act] = true; latch[act] = 2; if (act === 'jump') rmbRecent = 3; });
addEventListener('mouseup', e => { const act = mouseAct(e); if (act) mouse[act] = false; });
frame.addEventListener('contextmenu', e => e.preventDefault());

function readInput() {
  const inp = { left: held.left, right: held.right, jump: held.jump || mouse.jump, dash: held.dash, attack: held.attack || mouse.attack, interact: held.interact };
  if (dashLatch > 0) { dashLatch--; inp.dash = true; }
  if (rmbRecent > 0) { rmbRecent--; inp.jumpAirDash = true; }
  if (stick.axis < 0) inp.left = true; if (stick.axis > 0) inp.right = true;
  const t = {}; for (const act of pointers.values()) if (act) { inp[act] = true; t[act] = true; }
  if (t.dash) inp.autoDash = true;      // DASH kept down: one dash runs into the next, and landing goes straight into a dash
  if (isTouch) showButtons(t);
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const g of pads) { if (!g) continue; const b = i => g.buttons[i] && g.buttons[i].pressed;
    if (b(14) || g.axes[0] < -0.5) inp.left = true; if (b(15) || g.axes[0] > 0.5) inp.right = true;
    if (padWait) { if (b(0) || b(1) || b(2) || b(3)) continue; padWait = false; }      // the press that closed a panel or menu is not also an action
    if (b(0)) inp.jump = true; if (b(2)) inp.attack = true; if (b(1) || b(5) || b(7)) inp.dash = true; if (b(3) || b(12) || g.axes[1] < -0.6) inp.interact = true; }
  for (const k in latch) if (latch[k] > 0) { inp[k] = true; latch[k]--; }
  // Double-tap dash: stays on while that direction is held. The rules chain the dashes (autoDash), and
  // because dash stays held in the air, landing from a dash jump goes straight into the next dash.
  if (tapDash) { const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0); if (dir !== tapDash.dir) tapDash = null; else inp.dash = inp.autoDash = true; }
  if (inp.left && inp.right) { inp.left = lastTap.dir < 0; inp.right = lastTap.dir > 0; }   // both held: the later press wins
  return inp;
}

// ---- sound: js/audio.js (synthesized effects and music, no files) ----
const AU = window.ZankoAudio;
function audioStart() { AU.start(); AU.setPlay(mode === 'play'); }
function sfx(e) { AU.event(e); }

// ---- modes and menus ----
function setMode(m) {
  mode = m; frame.dataset.mode = m;
  for (const id of ['title', 'pause', 'clear']) $(id).classList.toggle('show', id === m);
  $('talk').classList.toggle('show', m === 'talk'); if (m !== 'play') promptEl.classList.remove('show');
  if (m !== 'play') releaseAll(); else { last = 0; acc = 0; measureButtons(); }
  AU.setPlay(m === 'play' || m === 'talk'); slow = 0; crawl = 0; if (m === 'pause') qualLabel();
}
function fullscreenEl() { return document.fullscreenElement || document.webkitFullscreenElement; }
function toggleFullscreen() { try { if (fullscreenEl()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; } const el = document.documentElement, fn = el.requestFullscreen || el.webkitRequestFullscreen; if (!fn) return; const r = fn.call(el, { navigationUI: 'hide' }); if (r && r.catch) r.catch(() => {}); } catch (_) {} }
function restart() { sim = Z.create(); R.reset(sim); clearT = 0; hudCache = ''; commReset(); }
function start() { audioStart(); if (isTouch && !fullscreenEl()) toggleFullscreen(); restart(); openScene('intro'); }
function toggleBoxes() { R.debug = !R.debug; $('boxBtn').textContent = '当たり判定の表示：' + (R.debug ? 'ON' : 'OFF'); }
$('startBtn').addEventListener('click', start);
$('pauseBtn').addEventListener('click', () => { if (mode === 'play') setMode('pause'); });
$('resumeBtn').addEventListener('click', () => setMode('play'));
$('retryBtn').addEventListener('click', () => { restart(); setMode('play'); });
$('againBtn').addEventListener('click', () => { restart(); setMode('play'); });
for (const k of ['bgm', 'se']) { const el = $(k + 'Vol'), out = $(k + 'VolV'); el.value = AU.vol[k]; out.textContent = AU.vol[k]; el.addEventListener('input', () => { AU.setVol(k, el.value); out.textContent = el.value; }); }
$('boxBtn').addEventListener('click', toggleBoxes);
const storyLabel = () => { $('storyBtn').textContent = '会話：' + (storyOn ? 'ON' : 'OFF'); };
$('storyBtn').addEventListener('click', () => { storyOn = !storyOn; storyLabel(); if (!storyOn) commReset(); try { localStorage.setItem('zanko.story', storyOn ? '1' : '0'); } catch (_) {} });
$('talkSkip').addEventListener('click', e => { e.stopPropagation(); talkClose(); });
$('qualBtn').addEventListener('click', () => setQual((qual + 1) % QUAL.length, false));
$('gradeBtn').addEventListener('click', () => { R.grade = !R.grade; $('gradeBtn').textContent = '色調整（LUT・トーン）：' + (R.grade ? 'ON' : 'OFF'); });
$('postBtn').addEventListener('click', () => { R.post = !R.post; $('postBtn').textContent = 'シェーダー効果（歪み・ブレ・色ずれ）：' + (R.post ? 'ON' : 'OFF'); });
$('fxBtn').addEventListener('click', () => { R.fx = !R.fx; $('fxBtn').textContent = '空気感：' + (R.fx ? 'ON' : 'OFF'); });
$('spriteBtn').addEventListener('click', () => { R.sprite = !R.sprite; $('spriteBtn').textContent = '絵の表示：' + (R.sprite ? 'ON' : 'OFF'); });
$('airBtn').addEventListener('click', () => { C.AIR_DASH = !C.AIR_DASH; $('airBtn').textContent = 'エアダッシュ（試験）：' + (C.AIR_DASH ? 'ON' : 'OFF'); });
$('carryBtn').addEventListener('click', () => { C.KICK_CARRY = !C.KICK_CARRY; $('carryBtn').textContent = '壁蹴りのダッシュ維持：' + (C.KICK_CARRY ? 'ON' : 'OFF'); });
if (document.fullscreenEnabled || document.webkitFullscreenEnabled) { $('fsBtn').hidden = false; $('fsBtn').addEventListener('click', toggleFullscreen); }
addEventListener('blur', () => { if (mode === 'play') setMode('pause'); else releaseAll(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') setMode('pause'); AU.hidden(document.hidden); });

// ---- examine prompt (floats over the thing; also the touch target) and the text panel ----
const promptEl = $('prompt'), VERB = { term: '調べる', switch: '動かす', heal: '使う' };
let promptFor = null;
promptEl.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (e.pointerType === 'touch') setTouch(true); latch.interact = 2; });
function placePrompt() {
  const th = mode === 'play' && !sim.p.act ? sim.near : null;
  if (!th) { if (promptFor) { promptFor = null; promptEl.classList.remove('show'); } return; }
  if (promptFor !== th) { promptFor = th; $('promptText').textContent = VERB[th.type]; promptEl.classList.add('show'); }
  const half = promptEl.offsetWidth / 2 + 6;
  promptEl.style.left = clamp((th.x - R.cam.x) * R.css, half, band.clientWidth - half) + 'px';
  promptEl.style.top = Math.max(promptEl.offsetHeight + 56, (th.y - 40 - R.cam.y) * R.css) + 'px';
}
const talk = { pages: [], i: 0, shown: 0, text: '', scene: false, then: null };
function openTalk(th) { talk.scene = false; frame.dataset.adv = '0'; talk.pages = th.pages; talk.i = 0; $('talkTitle').textContent = th.title; setMode('talk'); talkPage(); }
function talkPage() { const pg = talk.pages[talk.i]; talk.text = typeof pg === 'string' ? pg : pg.text; if (talk.scene) scenePage(pg); talk.shown = 0; $('talkText').textContent = ''; $('talkMore').textContent = talk.i < talk.pages.length - 1 ? '▼ 次へ' : '■ 閉じる'; $('talkMore').classList.remove('ready'); }
function talkNext() {
  if (talk.shown < talk.text.length) { talk.shown = talk.text.length; $('talkText').textContent = talk.text; $('talkMore').classList.add('ready'); return; }   // first press: show the whole page
  if (++talk.i < talk.pages.length) { talkPage(); sfx({ t: 'page' }); } else talkClose();
}
let talkClosedAt = 0;
function talkClose() { talkClosedAt = performance.now(); const then = talk.scene ? talk.then : null; talk.scene = false; talk.then = null; frame.dataset.adv = '0'; if (then) then(); else setMode('play'); }

// ---- story (js/story.js): scenes stop the game and show portraits; comms run in a corner while the game goes on ----
const ST = window.ZankoStory, PT = {}, STAND = {};
let storyOn = !navigator.webdriver;                             // automated browsers (the tests) start with the story off, so that START still leads straight into play
try { const v = localStorage.getItem('zanko.story'); if (v !== null && !navigator.webdriver) storyOn = v === '1'; } catch (_) {}
storyLabel();
function ptLoad(key) { const im = new Image(); im.onload = () => { PT[key] = im.src; }; im.src = 'assets/portrait/' + key + '.png'; }
for (const k in ST.cast) { ptLoad(ST.cast[k].img); for (const f of ST.faces) ptLoad(ST.cast[k].img + '_' + f); }
const heroSheet = new Image(); heroSheet.src = 'assets/hero.png';
function standIn(c) {                                           // no portrait file yet: the hero's own sprite enlarged, or a plain silhouette
  if (STAND[c.img]) return STAND[c.img];
  const cv = document.createElement('canvas'); cv.width = 400; cv.height = 600; const x = cv.getContext('2d'), f = c.img === 'hero' && heroSheet.complete && heroSheet.naturalWidth && typeof HERO_ATLAS !== 'undefined' && HERO_ATLAS.frames.idle0;
  if (f) { const sh = f.h * 0.6, k = 570 / sh; x.imageSmoothingQuality = 'high'; x.drawImage(heroSheet, f.x, f.y, f.w, sh, 200 - f.w * k / 2, 30, f.w * k, 570); }
  else { x.fillStyle = '#26314f'; x.strokeStyle = c.color || '#bcd7ff'; x.lineWidth = 4; x.beginPath(); x.arc(200, 150, 72, 0, 7); x.fill(); x.stroke(); x.beginPath(); x.moveTo(60, 600); x.quadraticCurveTo(70, 270, 200, 262); x.quadraticCurveTo(330, 270, 340, 600); x.closePath(); x.fill(); x.stroke(); if (c.img === 'hero') return cv.toDataURL(); }
  return (STAND[c.img] = cv.toDataURL());
}
function ptSrc(c, face) { return (face && PT[c.img + '_' + face]) || PT[c.img] || standIn(c); }
function openScene(id, then) {
  const pages = storyOn && ST.scenes[id]; if (!pages) { if (then) then(); else setMode('play'); return; }
  talk.scene = true; talk.then = then || null; talk.pages = pages; talk.i = 0; for (const s of ['L', 'R']) $('adv' + s).className = '';
  frame.dataset.adv = '1'; setMode('talk'); talkPage();
}
function scenePage(pg) {
  const c = ST.cast[pg.who], el = $('adv' + c.side), other = $('adv' + (c.side === 'L' ? 'R' : 'L'));
  $('talkTitle').textContent = c.name; el.src = ptSrc(c, pg.face); el.className = 'in on' + (c.flip ? ' flip' : ''); other.classList.remove('on');
}
function commFace(c, face) {                                   // show the face part of the portrait in the small square
  $('comm').style.setProperty('--cc', c.color || '#bcd7ff'); const el = $('commFace'), src = ptSrc(c, face), real = !!PT[c.img], b = real && c.faceBox; el.style.backgroundImage = 'url(' + src + ')';
  if (!b) { el.style.backgroundSize = ''; el.style.backgroundPosition = ''; return; }
  const im = new Image(); im.src = src; const asp = (im.naturalHeight || 1100) / (im.naturalWidth || 564), fw = b[2], fh = fw / asp;
  el.style.backgroundSize = (100 / fw) + '% auto'; el.style.backgroundPosition = ((b[0] - fw / 2) / (1 - fw) * 100) + '% ' + ((b[1] - fh / 2) / (1 - fh) * 100) + '%';
}
// comms: a queue of lines; each types out, stays a moment, then makes room for the next
const comm = { q: [], cur: null, shown: 0, hold: 0 };
function commReset() { comm.q.length = 0; comm.cur = null; $('comm').classList.remove('show'); for (const c of ST.comms) c.done = false; }
function commTick() {
  if (!storyOn) return;
  for (const c of ST.comms) if (!c.done && sim.p.x >= c.col * 16) { c.done = true; for (const text of c.lines) comm.q.push({ who: c.who, face: c.face, text }); }
  if (!comm.cur) { if (!comm.q.length) return; const n = comm.cur = comm.q.shift(), c = ST.cast[n.who]; comm.shown = 0; comm.hold = 0; $('commName').textContent = c.name; $('commText').textContent = ''; commFace(c, n.face); const box = $('comm'); box.classList.add('show'); box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop'); sfx({ t: 'comm' }); }
  const n = comm.cur;
  if (comm.shown < n.text.length) { comm.shown = Math.min(n.text.length, comm.shown + 1); $('commText').textContent = n.text.slice(0, Math.floor(comm.shown)); }
  else if (++comm.hold > 150 + n.text.length * 7) { comm.cur = null; if (!comm.q.length) $('comm').classList.remove('show'); }
}
function talkTick() { if (talk.shown < talk.text.length) { talk.shown = Math.min(talk.text.length, talk.shown + 1); $('talkText').textContent = talk.text.slice(0, talk.shown); if (talk.shown === talk.text.length) $('talkMore').classList.add('ready'); else if (talk.shown % 3 === 0) sfx({ t: 'type' }); } }

// ---- gamepad outside play: any face button turns the page, Options pauses and resumes ----
let padPrev = {}, padWait = false;
function padMenus() {
  const now = {}; const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const g of pads) { if (!g) continue; for (const i of [0, 1, 2, 3, 9]) if (g.buttons[i] && g.buttons[i].pressed) now[i] = true; }
  const hit = i => now[i] && !padPrev[i], face = hit(0) || hit(1) || hit(2) || hit(3);
  if (mode === 'talk') { if (face) talkNext(); }
  else if (mode === 'title') { if (face || hit(9)) start(); }
  else if (mode === 'pause') { if (hit(9) || hit(0)) setMode('play'); }
  else if (mode === 'clear') { if (hit(0) || hit(9)) { restart(); setMode('play'); } }
  else if (mode === 'play' && hit(9)) setMode('pause');
  if (mode !== 'play') padWait = true;
  padPrev = now;
}

// ---- HUD ----
const cells = $('cells'); for (let i = 0; i < C.HP; i++) cells.appendChild(document.createElement('i'));
let hudCache = '';
function fmt(fr) { const s = fr / 60, m = Math.floor(s / 60); return m + ':' + (s % 60).toFixed(1).padStart(4, '0'); }
function hud() {
  const key = sim.p.hp + '|' + Math.floor(sim.time / 6) + '|' + sim.deaths; if (key === hudCache) return; hudCache = key;
  [...cells.children].forEach((el, i) => el.classList.toggle('on', i < sim.p.hp)); cells.classList.toggle('low', sim.p.hp <= 4);
  $('time').textContent = fmt(sim.time); $('deaths').textContent = sim.deaths;
}

// ---- loop: rules advance in fixed 1/60 s steps, whatever the display's refresh rate ----
let last = 0, acc = 0, fps = 60, fpsN = 0, fpsAt = 0;
function stepOnce() {
  Z.step(sim, readInput());
  let opened = null;
  for (const e of sim.events) { R.event(e); sfx(e); if (e.t === 'talk') opened = e.thing; }
  sim.events.length = 0;
  R.step(sim);
  if (opened) openTalk(opened);
  if (sim.cleared && ++clearT === 70) { $('resTime').textContent = fmt(sim.time); $('resMiss').textContent = sim.deaths; comm.q.length = 0; comm.cur = null; $('comm').classList.remove('show'); openScene('outro', () => setMode('clear')); }
  commTick();
}
function tick(ts) {
  requestAnimationFrame(tick);
  const dt = last ? Math.min(0.1, (ts - last) / 1000) : 0; last = ts;
  if (mode === 'play') { acc += dt; let n = 0; while (acc >= 1 / 60 - 0.0005 && n < 4) { acc -= 1 / 60; n++; stepOnce(); } if (n === 4) acc = 0; }
  padMenus();
  if (mode === 'talk') talkTick();
  R.draw(sim); hud(); placePrompt();
  fpsN++; if (ts - fpsAt > 500) { fps = Math.round(fpsN * 1000 / (ts - fpsAt)); fpsN = 0; fpsAt = ts;
    // touch devices: 3 seconds under 48 fps while playing -> one step down in resolution (never back up by itself; the menu shows it and can undo it)
    if (mode === 'play') { playFps = fps; slow = fps < 48 ? slow + 1 : 0; crawl = fps < 30 ? crawl + 1 : 0; if (isTouch) lighten(); }
    if (!$('debug').hidden) { const p = sim.p; $('debug').textContent = fps + ' fps  view ' + Math.round(R.VW) + 'x' + Math.round(R.VH) + '  canvas ' + canvas.width + 'x' + canvas.height + '\n' + (R.pose ? R.pose.kind : '-') + '  x ' + p.x.toFixed(1) + '  y ' + p.y.toFixed(1) + '  vx ' + p.vx.toFixed(2) + '  vy ' + p.vy.toFixed(2) + '\ndash ' + p.dashT + '  airFast ' + p.airFast + '  wall ' + p.wall + '  atk ' + (p.atk ? p.atk.id + ':' + p.atk.f : '-') + '  charge ' + p.charge; } }
}
document.body.classList.toggle('touch', isTouch);
if (location.hash === '#debug') $('debug').hidden = false;
layout(); R.reset(sim); R.step(sim); requestAnimationFrame(tick);
window.__zanko = { story: v => { storyOn = !!v; storyLabel(); }, openScene, get comm() { return comm; }, get sim() { return sim; }, R, setMode, start, input: () => ({ stick: stick.id, axis: stick.axis, pointers: [...pointers.values()], held: Object.keys(held).filter(k => held[k]), mouse: Object.keys(mouse).filter(k => mouse[k]), dashLatch, tapDash: !!tapDash, on: buttons.filter(b => b.el.classList.contains('on')).map(b => b.act) }) };     // for automated checks
})();
