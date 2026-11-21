// 残光 ZANKO — drawing. Everything on screen is drawn by code (no image files): the hero is a small
// jointed figure posed from the rules' state, so it can be swapped for sprites later without touching sim.js.
(function (G) {
'use strict';
const Z = G.ZankoSim, T = Z.T, C = Z.C, ATK = Z.ATK;
const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const COL = { blade: '#9ff6ff', glow: 'rgba(80,215,255,', scarf: '#b06cff', armor: '#e4ecf8', armorBack: '#8e9bb4', joint: '#27344d', visor: '#6ff0ff', foe: '#ffb84d', danger: '#ff4d7a' };

// Saber sweep per move: start angle, end angle (0 = forward, negative = up), reach.
const SWEEP = { s1: [-2.2, 0.95, 31], s2: [1.25, -1.95, 34], s3: [-2.75, 1.3, 43], air: [-2.45, 1.35, 37], dash: [-1.0, 0.6, 43], wall: [-2.2, 1.0, 33], charge: [-3.05, 1.5, 53] };

const R = { ctx: null, VW: 426, VH: 240, K: 1, css: 1, cam: { x: 0, y: 0 }, shake: 0, parts: [], arcs: [], ghosts: [], scarf: [], phase: 0, lastX: 0, t: 0, debug: false, pose: null, runU: 0, deadT: 0, sprite: true, fx: true, post: true, waves: [], rb: 0, hurtFx: 0 };

R.reset = function (s) {
  R.parts.length = R.arcs.length = R.ghosts.length = 0; R.scarf.length = 0; R.shake = 0; R.waves.length = 0; R.rb = 0; R.hurtFx = 0; R.lastX = s.p.x;
  R.cam.x = s.p.x - R.VW / 2; R.cam.y = s.p.y - R.VH * 0.62; clampCam(s);
};
function clampCam(s) {
  R.cam.x = clamp(R.cam.x, 0, Math.max(0, s.L.W * T - R.VW)); R.cam.y = clamp(R.cam.y, 0, Math.max(0, s.L.H * T - R.VH));
}

// ---- per-step update: pose, camera, effects ----
function sweepAngle(atk) {
  const a = ATK[atk.id], sw = SWEEP[atk.id], u = clamp((atk.f - a.act[0] + 1) / (a.act[1] - a.act[0] - 1), 0, 1);
  return { ang: lerp(sw[0], sw[1], 1 - Math.pow(1 - u, 3)), u, from: sw[0], reach: sw[2] };
}
R.step = function (s) {
  const p = s.p; R.t++;
  // pose
  const moved = p.x - R.lastX; R.lastX = p.x;
  let kind = 'idle';
  if (p.dead) kind = 'dead'; else if (p.stun > 0) kind = 'hurt'; else if (p.act) kind = 'use'; else if (p.sliding) kind = 'slide';
  else if (p.airDashT > 0) kind = 'dash'; else if (!p.ground) kind = p.vy < 0 ? 'rise' : 'fall'; else if (p.dashT > 0) kind = 'dash'; else if (Math.abs(p.vx) > 0.1) kind = 'run';
  if (kind === 'run') R.phase += Math.abs(moved) / 24 * TAU; else if (kind !== 'dash') R.phase = 0;
  R.runU = kind === 'run' ? (R.runU + Math.abs(moved) / RUN_CYCLE) % 1 : 0; R.deadT = p.dead ? R.deadT + 1 : 0;   // feet advance with distance: no sliding
  const pose = { x: p.x, y: p.y, face: p.face, kind, phase: R.phase, t: R.t, vy: p.vy, atk: p.atk ? { id: p.atk.id, f: p.atk.f } : null, charge: p.charge, inv: p.inv, use: p.act ? p.act.f : 0, wall: p.wall, runU: R.runU, deadT: R.deadT, adash: p.airDashT > 0, floor: p.ground ? p.y : null };
  R.L = s.L;
  R.pose = pose;
  // saber trail: follow the live sweep, then let it fade where it ended
  const live = R.arcs.find(a => a.live);
  if (p.atk && p.atk.f >= ATK[p.atk.id].act[0] - 1) {
    const sw = sweepAngle(p.atk);
    if (live && live.key === p.atk) { live.to = sw.ang; }
    else { if (live) live.live = false; R.arcs.push({ key: p.atk, live: true, x: p.x, y: p.y, face: p.face, from: sw.from, to: sw.ang, reach: sw.reach, heavy: !!ATK[p.atk.id].heavy, fade: 0, sx: 1.2, sy: -22 }); }
    const cur = R.arcs[R.arcs.length - 1], sk = skeleton(pose); cur.x = p.x; cur.y = p.y; cur.face = p.face; cur.sx = sk.sh[0]; cur.sy = sk.sh[1]; cur.floor = p.ground ? p.y : null;
    if (p.atk.f > ATK[p.atk.id].act[1]) cur.live = false;
  } else if (live) live.live = false;
  for (let i = R.arcs.length - 1; i >= 0; i--) { const a = R.arcs[i]; if (!a.live && ++a.fade > 9) R.arcs.splice(i, 1); }
  R.rb += ((!p.dead && (p.dashT > 0 || p.airDashT > 0) ? 1 : 0) - R.rb) * 0.3; if (R.hurtFx > 0) R.hurtFx--;
  for (let i = R.waves.length - 1; i >= 0; i--) if (--R.waves[i].life <= 0) R.waves.splice(i, 1);
  // afterimages while moving at dash speed
  if (!p.dead && (p.dashT > 0 || p.airDashT > 0 || (p.airFast && !p.ground)) && R.t % (p.airDashT > 0 ? 2 : 3) === 0) R.ghosts.push({ pose: Object.assign({}, pose), life: 11 });
  for (let i = R.ghosts.length - 1; i >= 0; i--) if (--R.ghosts[i].life <= 0) R.ghosts.splice(i, 1);
  // scarf: a short chain pinned to the neck
  const neck = { x: p.x - p.face * 2, y: p.y - 22.5 - (kind === 'dash' ? -5 : 0) };
  if (!R.scarf.length) for (let i = 0; i < 8; i++) R.scarf.push({ x: neck.x - p.face * i * 2, y: neck.y, px: neck.x - p.face * i * 2, py: neck.y });
  R.scarf[0].x = neck.x; R.scarf[0].y = neck.y;
  for (let i = 1; i < R.scarf.length; i++) { const q = R.scarf[i], vx = (q.x - q.px) * 0.86, vy = (q.y - q.py) * 0.86; q.px = q.x; q.py = q.y; q.x += vx - p.face * 0.05 + Math.sin(R.t * 0.13 + i) * 0.03; q.y += vy + 0.07; }
  for (let k = 0; k < 3; k++) for (let i = 1; i < R.scarf.length; i++) { const a = R.scarf[i - 1], b = R.scarf[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, m = 2.3 / d; b.x = a.x + dx * m; b.y = a.y + dy * m; }
  // continuous effects
  if (p.sliding && R.t % 4 === 0) dust(p.x + p.wall * C.HW, p.y - 4, 1, -p.wall * 0.2, -0.3);
  if (p.dashT > 0 && R.t % 3 === 0) dust(p.x - p.face * 6, p.y - 1, 1, -p.face * 0.4, -0.2);
  if (p.charge > 12 && !p.dead) {
    const full = p.charge >= C.CHARGE_T;
    if (R.t % (full ? 2 : 4) === 0) { const a = Math.random() * TAU, d = 18 + Math.random() * 10; R.parts.push({ x: p.x + Math.cos(a) * d, y: p.y - 14 + Math.sin(a) * d, vx: -Math.cos(a) * d / 14, vy: -Math.sin(a) * d / 14, life: 14, max: 14, size: full ? 1.3 : 0.9, color: full ? '#ffffff' : COL.blade, add: true, home: true }); }
  }
  // particles
  for (let i = R.parts.length - 1; i >= 0; i--) { const q = R.parts[i]; q.x += q.vx; q.y += q.vy; if (q.home) { q.x += p.x - (q.hx === undefined ? p.x : q.hx); q.hx = p.x; } q.vy += q.grav || 0; q.vx *= q.drag || 1; q.vy *= q.drag || 1; if (--q.life <= 0) R.parts.splice(i, 1); }
  for (const g of s.L.gates) { if (g.lift === undefined) g.lift = 0; if (g.open && g.lift < 1) g.lift = Math.min(1, g.lift + 1 / 34); }
  if (R.shake > 0) R.shake *= 0.82;
  // camera: look a little ahead, ease after the player, stay inside the map
  const tx = p.x + p.face * R.VW * 0.07 - R.VW / 2, ty = p.y - R.VH * 0.62;
  if (!p.dead) { R.cam.x += (tx - R.cam.x) * 0.14; R.cam.y += (ty - R.cam.y) * (p.ground ? 0.12 : 0.09); }
  clampCam(s);
};
function dust(x, y, n, vx, vy) { for (let i = 0; i < n; i++) R.parts.push({ x: x + (Math.random() - 0.5) * 3, y, vx: (vx || 0) + (Math.random() - 0.5) * 0.5, vy: (vy || 0) - Math.random() * 0.3, life: 16, max: 16, size: 1.6 + Math.random() * 1.4, color: '#9fb2cc', puff: true }); }
function sparks(x, y, n, speed, color, face) { for (let i = 0; i < n; i++) { const a = (face ? (face > 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 2.2 : Math.random() * TAU), v = speed * (0.4 + Math.random()); R.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.3, life: 10 + Math.random() * 10 | 0, max: 20, size: 0.9, color, add: true, streak: true, grav: 0.12, drag: 0.93 }); } }

R.event = function (e) {
  switch (e.t) {
    case 'jump': dust(e.x, e.y, 3, 0, -0.1); break;
    case 'land': dust(e.x - 3, e.y, 2, -0.5, 0); dust(e.x + 3, e.y, 2, 0.5, 0); break;
    case 'dash': dust(e.x - e.face * 4, e.y, 5, -e.face * 0.9, -0.1); break;
    case 'kick': dust(e.x, e.y, 4, e.dir * 0.3, 0.2); break;
    case 'airdash': R.parts.push({ x: e.x - e.face * 4, y: e.y, vx: 0, vy: 0, life: 10, max: 10, size: 13, color: COL.blade, add: true, ring: true }); sparks(e.x - e.face * 6, e.y, 6, 1.6, COL.blade, -e.face); break;
    case 'hit': R.waves.push({ x: e.x, y: e.y, r: e.heavy ? 78 : 46, amp: e.heavy ? 3.4 : 1.9, life: e.heavy ? 20 : 14, max: e.heavy ? 20 : 14 }); sparks(e.x, e.y, e.heavy ? 16 : 9, e.heavy ? 3.6 : 2.6, COL.blade, e.face); R.parts.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: e.heavy ? 9 : 6, max: e.heavy ? 9 : 6, size: e.heavy ? 20 : 13, color: '#ffffff', add: true, star: true, rot: Math.random() * 1.5 }); R.shake = Math.max(R.shake, e.heavy ? 4.5 : 1.6); break;
    case 'kill': R.waves.push({ x: e.x, y: e.y, r: 96, amp: 4.2, life: 22, max: 22 }); sparks(e.x, e.y, 22, 3.2, COL.foe); R.parts.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 14, max: 14, size: 26, color: COL.foe, add: true, ring: true }); R.shake = Math.max(R.shake, 3); break;
    case 'cut': sparks(e.x, e.y, 7, 2, COL.foe); break;
    case 'hurt': R.hurtFx = POSTFX.hurtT; sparks(e.x, e.y, 10, 2.4, COL.danger); R.shake = Math.max(R.shake, 3.5); break;
    case 'die': R.waves.push({ x: e.x, y: e.y, r: 130, amp: 5, life: 26, max: 26 }); sparks(e.x, e.y, 30, 3.5, COL.blade); R.parts.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 22, max: 22, size: 46, color: COL.blade, add: true, ring: true }); R.shake = 6; break;
    case 'charged': R.waves.push({ x: e.x, y: e.y, r: 52, amp: 1.5, life: 14, max: 14 }); R.parts.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 12, max: 12, size: 24, color: '#ffffff', add: true, ring: true, home: true }); break;
    case 'check': R.parts.push({ x: e.x, y: e.y - 20, vx: 0, vy: 0, life: 20, max: 20, size: 34, color: COL.blade, add: true, ring: true }); break;
    case 'spawn': case 'respawn': R.parts.push({ x: e.x, y: e.y - (e.t === 'respawn' ? 14 : 0), vx: 0, vy: 0, life: 14, max: 14, size: 22, color: '#ffffff', add: true, ring: true }); if (e.t === 'respawn') R.scarf.length = 0; break;
    case 'shot': sparks(e.x, e.y, 4, 1.2, COL.foe); break;
    case 'heal': for (let i = 0; i < 16; i++) R.parts.push({ x: e.x + (Math.random() - 0.5) * 14, y: e.y + 10 - Math.random() * 6, vx: 0, vy: -0.5 - Math.random() * 0.9, life: 26, max: 26, size: 1.1, color: '#7dffb0', add: true }); R.parts.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 16, max: 16, size: 26, color: '#7dffb0', add: true, ring: true }); break;
    case 'switch': sparks(e.x, e.y, 8, 1.6, COL.blade); R.shake = Math.max(R.shake, 2.2); break;
    case 'clear': sparks(e.x, e.y - 14, 40, 4, '#ffffff'); break;
  }
};

// ---- hero ----
function ik(ax, ay, bx, by, l1, l2, bend) {     // knee/elbow position for a two-segment limb
  let dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 0.001; const max = l1 + l2 - 0.02;
  if (d > max) { bx = ax + dx / d * max; by = ay + dy / d * max; dx = bx - ax; dy = by - ay; d = max; }
  const a = Math.atan2(dy, dx), k = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  return [ax + Math.cos(a - bend * k) * l1, ay + Math.sin(a - bend * k) * l1, bx, by];
}
function skeleton(h) {
  let hipX = 0, hipY = -13, lean = 0.02, f1 = [2.8, 0], f2 = [-2.6, 0], aF = 1.35, aB = 1.85, head = 0;
  const th = h.phase;
  switch (h.kind) {
    case 'idle': hipY += Math.sin(h.t * 0.07) * 0.35; break;
    case 'run': { const ft = a => [Math.sin(a) * 6.2, -Math.max(0, Math.cos(a)) * 4.2]; f1 = ft(th); f2 = ft(th + Math.PI); hipY = -12.3 - Math.abs(Math.cos(th)) * 0.9; lean = 0.2; aF = 1.57 - Math.sin(th) * 1.0; aB = 1.57 + Math.sin(th) * 1.0; break; }
    case 'dash': hipY = -9.2; hipX = -1; lean = 0.72; f1 = [7.5, 0]; f2 = [-10, -0.8]; aF = 2.75; aB = 2.95; head = -0.35; break;
    case 'rise': lean = 0.06; f1 = [2.2, -5.5]; f2 = [-3.2, -1.2]; aF = 0.75; aB = 2.4; break;
    case 'fall': lean = -0.04; f1 = [3.4, -2.2]; f2 = [-2.4, 0.2]; aF = -0.25; aB = 3.5; break;
    case 'slide': hipX = -1.6; lean = -0.14; f1 = [-3.2, -0.5]; f2 = [-4.6, -7]; aF = 1.25; aB = 4.0; head = 0.25; break;
    case 'use': { const u = Math.sin(clamp(h.use / 16, 0, 1) * Math.PI); lean = 0.1 + u * 0.12; hipX = u * 1.2; f1 = [4, 0]; f2 = [-3.2, 0]; aF = 1.3 - u * 1.45; aB = 2.0; break; }
    case 'hurt': case 'dead': lean = -0.42; f1 = [3, -2.5]; f2 = [-3.5, 0]; aF = -0.7; aB = 3.7; head = -0.3; break;
  }
  let blade = null;
  if (h.atk) {
    const a = ATK[h.atk.id], sw = sweepAngle(h.atk), wind = clamp(h.atk.f / Math.max(1, a.act[0]), 0, 1);
    aF = sw.ang; blade = { ang: sw.ang, reach: sw.reach };
    const swing = (sw.u - 0.5) * (h.atk.id === 's2' ? -1 : 1);
    lean += 0.12 + swing * 0.3 * wind; aB = 2.5 - swing * 0.6;
    if (h.kind === 'idle' || h.kind === 'run') { f1 = [5.2, 0]; f2 = [-4.6, 0]; hipY = -11.6; hipX = 0.8 + sw.u * (a.heavy ? 2.2 : 1); }
  } else if (h.charge > 12 && h.kind !== 'hurt' && h.kind !== 'dead') { aF = 2.3; blade = { ang: 2.55, reach: 30, held: true }; }
  const sh = [hipX + Math.sin(lean) * 10, hipY - Math.cos(lean) * 10];
  const hd = [sh[0] + Math.sin(lean + head) * 5.4 + 0.5, sh[1] - Math.cos(lean + head) * 5.4];
  const legF = ik(hipX + 0.9, hipY, f1[0], f1[1], 6.9, 6.9, 1), legB = ik(hipX - 0.9, hipY, f2[0], f2[1], 6.9, 6.9, 1);
  const arm = (ang, l) => { const ex = sh[0] + Math.cos(ang + 0.3) * 4.8 * l, ey = sh[1] + Math.sin(ang + 0.3) * 4.8 * l; return [ex, ey, sh[0] + Math.cos(ang) * 9.4 * l, sh[1] + Math.sin(ang) * 9.4 * l]; };
  return { hipX, hipY, sh, hd, legF, legB, armF: arm(aF, 1), armB: arm(aB, 0.95), blade, lean };
}
function limb(c, ax, ay, k, w, col) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(ax, ay); c.lineTo(k[0], k[1]); c.lineTo(k[2], k[3]); c.stroke(); }
// ---- hero as sprites (assets/hero.png + js/hero_atlas.js). Falls back to the line figure when missing or switched off ----
const RUN_CYCLE = 33;                                    // world units per full run cycle (two steps): feet do not slide
const RUN_CUT = [100, 60, 60, 90, 100, 60, 60, 90].reduce((a, v) => (a.push((a.length ? a[a.length - 1] : 0) + v / 620), a), []);
const ATK_FRAMES = { s1: ['s1_', [3, 9]], s2: ['s2_', [3, 10]], s3: ['s3_', [6, 10, 13]], charge: ['charge_', [8, 12, 16]], air: ['s3_', [3, 7, 11]], dash: ['datk_', [2]], wall: ['wall_', [3]] };
const HERO = { img: null, ok: false, tints: {} };
if (typeof HERO_ATLAS !== 'undefined' && typeof Image !== 'undefined') {
  HERO.img = new Image(); HERO.img.onload = () => { HERO.ok = true; }; HERO.img.src = 'assets/hero.png';
}
R.spriteReady = () => HERO.ok;
R.bloom = v => { if (v !== undefined) BLOOM.on = !!v; return BLOOM.on; };
function heroTint(color) {                               // flat-colour copy of the atlas, for afterimages and the charge flash
  if (!HERO.tints[color]) {
    const cv = document.createElement('canvas'); cv.width = HERO.img.width; cv.height = HERO.img.height;
    const x = cv.getContext('2d'); x.drawImage(HERO.img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, cv.width, cv.height);
    HERO.tints[color] = cv;
  }
  return HERO.tints[color];
}
function heroFrame(h) {
  if (h.kind === 'dead') return h.deadT < 16 ? 'dead0' : 'dead1';
  if (h.kind === 'hurt') return 'hurt';
  if (h.atk) { const d = ATK_FRAMES[h.atk.id]; let i = 0; while (i < d[1].length && h.atk.f >= d[1][i]) i++; return d[0] + i; }
  switch (h.kind) {
    case 'run': { let i = 0; while (i < 7 && h.runU >= RUN_CUT[i]) i++; return 'run' + i; }
    case 'dash': return h.adash ? 'adash' : 'dash'; case 'rise': return 'rise'; case 'fall': return 'fall'; case 'slide': return 'slide';
    case 'use': return h.use >= 4 ? 'use' : 'idle0';
  }
  return (h.t % 160) < 80 ? 'idle0' : 'idle1';
}
function bladeBlock(c, h, f, u) {                         // expects the hero's transform (translate + facing) to be set
  if (!(h.atk && f.hx !== undefined)) return;
  c.save();
  if (h.floor != null && R.L) {                              // standing on a floor: the blade stops at the floor line instead of passing through it
    // (in the hero's own coordinates: x is mirrored by the facing, y = 0 is the feet). Columns with no floor tile stay open, so the blade can hang over a ledge.
    const L = R.L, row = Math.round(h.floor / T), at = (i, j) => (i < 0 || i >= L.W || j < 0 || j >= L.H) ? 0 : L.t[j * L.W + i];
    c.beginPath(); c.rect(-400, -400, 800, 400);
    for (let i = Math.floor((h.x - 80) / T); i <= Math.floor((h.x + 80) / T); i++) if (at(i, row) !== 1) c.rect((i * T - h.x) * h.face, 0, T * h.face, 300);
    c.clip();
  }
    // The blade is drawn as a smear: a fan from the hands that trails behind the swing, plus a glow over the grip.
    // The pictures hold the hilt at whatever angle the pose needs, so a thin straight blade would look bent at the hand;
    // the fan and the glow hide the hilt and the hands, and the eye reads one continuous stroke along the leading edge.
    const sw = sweepAngle(h.atk), prev = sweepAngle({ id: h.atk.id, f: Math.max(0, h.atk.f - 2) }), end = SWEEP[h.atk.id][1];
    const dir = end >= sw.from ? 1 : -1, len = sw.reach - 5, ox = (f.hx - f.ax) * u, oy = (f.hy - f.ay) * u;
    const width = 0.26 + clamp(Math.abs(sw.ang - prev.ang) * 1.1, 0, 0.55), n = 14, dim = R.fx ? TUNE.keep : 1;
    { const r = len + 14; c.beginPath(); c.rect(ox - r, oy - r, r * 2, r * 2); c.clip(); }   // tight clip box: keeps the blurred glow of the blade cheap
    c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
    for (let i = 0; i < n; i++) {                                     // trailing edge (faint) to leading edge (bright)
      const a0 = sw.ang - dir * width * (1 - i / n), a1 = sw.ang - dir * width * (1 - (i + 1) / n), k = (i + 1) / n;
      const bx = -Math.sin(sw.ang) * 1.6, by = Math.cos(sw.ang) * 1.6;   // the fan starts as wide as the hands
      c.fillStyle = COL.glow + ((0.05 + 0.5 * k * k * k) * dim).toFixed(3) + ')';
      c.beginPath(); c.moveTo(ox - bx, oy - by); c.lineTo(ox + Math.cos(a0) * len, oy + Math.sin(a0) * len); c.lineTo(ox + Math.cos(a1) * len, oy + Math.sin(a1) * len); c.lineTo(ox + bx, oy + by); c.fill();
    }
    const tx = ox + Math.cos(sw.ang) * len, ty = oy + Math.sin(sw.ang) * len;
    c.shadowColor = COL.blade; c.shadowBlur = 8 * R.K * dim;
    c.strokeStyle = COL.glow + (0.8 * dim) + ')'; c.lineWidth = 3.6; c.beginPath(); c.moveTo(ox, oy); c.lineTo(tx, ty); c.stroke();
    c.strokeStyle = '#ffffff'; c.lineWidth = 1.7; c.beginPath(); c.moveTo(ox, oy); c.lineTo(tx, ty); c.stroke();
    c.shadowBlur = 0;
    const g = c.createRadialGradient(ox, oy, 0, ox, oy, 5.2);         // glow over the grip: hides the hilt and the hands
    g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.35, COL.glow + (0.75 * dim) + ')'); g.addColorStop(1, COL.glow + '0)');
    c.fillStyle = g; c.beginPath(); c.arc(ox, oy, 5.2, 0, TAU); c.fill();
  c.restore();
}
function drawHeroSprite(c, h, ghost) {
  const name = heroFrame(h), f = HERO_ATLAS.frames[name], u = 1 / HERO_ATLAS.ppu;
  const flip = name === 'slide' && h.wall ? h.wall : h.face;         // the wall-slide picture faces the wall
  c.save(); c.translate(h.x, h.y); c.scale(flip, 1); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  const flash = ghost === '#ffffff'; if (flash) ghost = null;           // charge flash: the picture, with a white wash over it
  if (!ghost && !R.noRim) {                                           // pale rim, so the dark suit reads against the dark stage
    const rim = heroTint('#a9dcff'), o = 0.42, ga = c.globalAlpha; c.globalAlpha = ga * 0.6;
    for (const d of [[o, 0], [-o, 0], [0, o], [0, -o]]) c.drawImage(rim, f.x, f.y, f.w, f.h, -f.ax * u + d[0], -f.ay * u + d[1], f.w * u, f.h * u);
    c.globalAlpha = ga;
  }
  c.drawImage(ghost ? heroTint(ghost) : HERO.img, f.x, f.y, f.w, f.h, -f.ax * u, -f.ay * u, f.w * u, f.h * u);
  if (flash) { c.save(); c.globalAlpha *= 0.5; c.drawImage(heroTint('#ffffff'), f.x, f.y, f.w, f.h, -f.ax * u, -f.ay * u, f.w * u, f.h * u); c.restore(); }
  if (!ghost) bladeBlock(c, h, f, u);
  c.restore();
}
function drawHero(c, h, ghost) {
  if (R.sprite && HERO.ok) return drawHeroSprite(c, h, ghost);
  const sk = skeleton(h);
  c.save(); c.translate(h.x, h.y); c.scale(h.face, 1); c.lineCap = 'round'; c.lineJoin = 'round';
  const front = ghost || COL.armor, back = ghost || COL.armorBack;
  limb(c, sk.sh[0], sk.sh[1], sk.armB, 2.5, back);
  limb(c, sk.hipX - 0.9, sk.hipY, sk.legB, 3.3, back);
  c.strokeStyle = front; c.lineWidth = 6.2; c.beginPath(); c.moveTo(sk.hipX, sk.hipY - 1); c.lineTo(sk.sh[0], sk.sh[1] + 1.2); c.stroke();
  if (!ghost) { c.strokeStyle = COL.joint; c.lineWidth = 1.5; c.beginPath(); c.moveTo(sk.hipX - 2.4, sk.hipY - 0.6); c.lineTo(sk.hipX + 2.6, sk.hipY - 1.2); c.stroke(); }
  limb(c, sk.hipX + 0.9, sk.hipY, sk.legF, 3.5, front);
  c.fillStyle = front; c.beginPath(); c.arc(sk.hd[0], sk.hd[1], 3.7, 0, TAU); c.fill();
  if (!ghost) {
    c.fillStyle = COL.joint; c.beginPath(); c.moveTo(sk.hd[0] - 3.4, sk.hd[1] - 2.2); c.lineTo(sk.hd[0] - 6.4, sk.hd[1] - 4.6); c.lineTo(sk.hd[0] - 1.2, sk.hd[1] - 3.6); c.fill();
    c.strokeStyle = COL.visor; c.lineWidth = 1.3; c.beginPath(); c.moveTo(sk.hd[0] + 0.6, sk.hd[1] - 0.2); c.lineTo(sk.hd[0] + 3.5, sk.hd[1] - 0.2); c.stroke();
  }
  limb(c, sk.sh[0], sk.sh[1], sk.armF, 2.7, front);
  if (sk.blade && !ghost) {
    const b = sk.blade, hx = sk.armF[2], hy = sk.armF[3], tx = sk.sh[0] + Math.cos(b.ang) * b.reach, ty = sk.sh[1] + Math.sin(b.ang) * b.reach;
    c.save(); c.globalCompositeOperation = 'lighter'; c.shadowColor = COL.blade; c.shadowBlur = 7 * R.K;
    c.strokeStyle = COL.glow + (b.held ? 0.5 : 0.75) + ')'; c.lineWidth = 3.2; c.beginPath(); c.moveTo(hx, hy); c.lineTo(tx, ty); c.stroke();
    c.strokeStyle = '#ffffff'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(hx, hy); c.lineTo(tx, ty); c.stroke(); c.restore();
  }
  c.restore();
  return sk;
}
function drawArc(c, a) {
  const k = a.live ? 1 : 1 - a.fade / 10, n = 18, sign = a.to >= a.from ? 1 : -1, span = Math.abs(a.to - a.from);
  if (span < 0.05 || k <= 0) return;
  const tail = a.live ? 0 : (a.fade / 10) * 0.7;                       // the tail catches up while fading
  const cx = a.x + a.face * a.sx, cy = a.y + a.sy;                      // centred on the sword arm's shoulder
  const pt = (s, r) => { const ang = a.from + sign * span * s; return [cx + a.face * Math.cos(ang) * r, cy + Math.sin(ang) * r]; };
  const shape = (thick, alphaCol) => {
    c.beginPath();
    for (let i = 0; i <= n; i++) { const s = lerp(tail, 1, i / n), q = pt(s, a.reach + 1.5); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }
    for (let i = n; i >= 0; i--) { const s = lerp(tail, 1, i / n), w = thick * Math.pow((s - tail) / (1 - tail || 1), 1.25), q = pt(s, a.reach * (1 - w)); c.lineTo(q[0], q[1]); }
    c.closePath(); c.fillStyle = alphaCol; c.fill();
  };
  const dim = R.fx ? TUNE.keep : 1;                                    // see BLADE_KEEP
  c.save();
  if (a.floor != null && R.L) {                              // swung while standing on a floor: the arc stops at the floor line too (open where there is no floor tile)
    const L = R.L, row = Math.round(a.floor / T), at = (i, j) => (i < 0 || i >= L.W || j < 0 || j >= L.H) ? 0 : L.t[j * L.W + i], r = a.reach + 24;
    c.beginPath(); c.rect(a.x - r - T, a.floor - 400, (r + T) * 2, 400);
    for (let i = Math.floor((a.x - r) / T); i <= Math.floor((a.x + r) / T); i++) if (at(i, row) !== 1) c.rect(i * T, a.floor, T, 300);
    c.clip();
  }
  { const r = a.reach + 14; c.beginPath(); c.rect(cx - r, cy - r, r * 2, r * 2); c.clip(); }   // a tight clip box keeps the blurred glow cheap (measured: an arc in the air, which had no clip at all, cost 2.5x a ground one)
  c.globalCompositeOperation = 'lighter'; c.shadowColor = 'rgba(80,215,255,.8)'; c.shadowBlur = (a.heavy ? 7 : 5) * R.K * dim;
  shape(a.heavy ? 0.46 : 0.36, COL.glow + (0.34 * k * dim) + ')');
  c.shadowBlur = 0; shape(a.heavy ? 0.13 : 0.09, 'rgba(235,252,255,' + (0.85 * k * (R.fx ? TUNE.core : 1)) + ')');
  c.restore();
}

// ---- world ----
function hash(n) { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); }
// distant skyline: two pictures that repeat sideways (their left and right ends are empty sky, so no seam shows)
const SKY = [{ src: 'assets/bg_far.png', par: 0.2, h: 150 }, { src: 'assets/bg_near.png', par: 0.45, h: 118 }];
if (typeof Image !== 'undefined') for (const k of SKY) { k.img = new Image(); k.img.onload = () => { k.ok = true; }; k.img.onerror = () => {}; k.img.src = k.src; }
// ---- atmosphere (R.fx): haze over the skyline, drifting mist, light spilling from lamps and from the blade ----
// Balance of the saber against the atmosphere. With fog wash, light pools and bloom all adding light, the blade blew out.
// These were set by photographing the same slash with the atmosphere off (the look Yota asked to match) and on,
// and bringing the count of blown-out pixels around the blade back to the "off" figure. A little bloom is kept as a halo.
const TUNE = { keep: 0.65, core: 0.8, pool: 0.05, bloomSaber: 0.12, bloomParts: 0.28 };   // keep/core: the blade's and arcs' own glow and white core; pool: light the blade throws around; bloomSaber: how much of the blade and arcs goes into the bloom
R.tune = TUNE;
const MIST = { cv: null };
function mistTex() {                                        // soft blobs that wrap sideways; built once
  if (!MIST.cv && typeof document !== 'undefined') {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const x = cv.getContext('2d');
    for (let i = 0; i < 70; i++) {
      const px = hash(i * 7 + 1) * 512, py = 30 + hash(i * 13 + 5) * 80, rx = 40 + hash(i * 3 + 9) * 90, ry = 10 + hash(i * 5 + 2) * 22;
      for (const dx of [-512, 0, 512]) { const g = x.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, 'rgba(120,170,255,0.10)'); g.addColorStop(1, 'rgba(120,170,255,0)'); x.save(); x.translate(px + dx, py); x.scale(rx, ry); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 1, 0, TAU); x.fill(); x.restore(); }
    }
    MIST.cv = cv;
  }
  return MIST.cv;
}
function drawMist(c, yBase, par, speed, alpha) {
  const m = mistTex(); if (!m) return; const w = 460, h = 84, ox = R.cam.x * (1 - par) - (R.t * speed) % w;
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = alpha;
  for (let i = Math.floor((R.cam.x - ox) / w) - 1, x = ox + i * w; x < R.cam.x + R.VW; i++, x = ox + i * w) if (x + w > R.cam.x) c.drawImage(m, x, yBase - h, w + 0.3, h);
  c.restore();
}
function haze(c, yTop, yBase, rgb, a) {                     // thickens toward the foot of a layer, and stays thick below it
  const g = c.createLinearGradient(0, yTop, 0, yBase); g.addColorStop(0, 'rgba(' + rgb + ',0)'); g.addColorStop(1, 'rgba(' + rgb + ',' + a + ')');
  c.fillStyle = g; c.fillRect(R.cam.x - 2, yTop, R.VW + 4, yBase - yTop); c.fillStyle = 'rgba(' + rgb + ',' + a + ')'; c.fillRect(R.cam.x - 2, yBase - 0.3, R.VW + 4, R.VH + 300);
}
function light(c, x, y, r, rgb, a) {
  if (x + r < R.cam.x || x - r > R.cam.x + R.VW || y + r < R.cam.y || y - r > R.cam.y + R.VH) return;
  const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); g.addColorStop(0.45, 'rgba(' + rgb + ',' + a * 0.35 + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
}
function drawMotes(c, n, par, seed, size, alpha) {          // drifting dust, wrapped around the view; par < 1 sits behind the stage, par > 1 in front
  const W = R.VW + 60, H = R.VH + 40;
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const h1 = hash(seed + i * 3.1), h2 = hash(seed + i * 7.7), h3 = hash(seed + i * 1.3);
    const x = ((h1 * W - R.cam.x * par + R.t * (0.03 + h3 * 0.05)) % W + W) % W - 30, y = ((h2 * H - R.cam.y * par - R.t * (0.012 + h1 * 0.02) + Math.sin(R.t * 0.01 + i) * 6) % H + H) % H - 20;
    const r = size * (0.6 + h3), a = alpha * (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(R.t * 0.02 + i * 1.7)));
    const px = R.cam.x + x, py = R.cam.y + y, g = c.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(170,215,255,' + a + ')'); g.addColorStop(1, 'rgba(170,215,255,0)');
    c.fillStyle = g; c.fillRect(px - r, py - r, r * 2, r * 2);
  }
  c.restore();
}
function drawRig(c) {                                       // dark pipework across the top of the view, closer than the stage: it slides by faster
  const u0 = R.cam.x * 1.5, y0 = R.cam.y, seg = 96, i0 = Math.floor(u0 / seg) - 1, i1 = i0 + Math.ceil(R.VW / seg) + 2;
  c.save(); c.fillStyle = 'rgba(2,5,12,0.92)'; c.strokeStyle = 'rgba(2,5,12,0.92)'; c.lineCap = 'round';
  c.fillRect(R.cam.x - 2, y0 - 2, R.VW + 4, 7.5); c.fillRect(R.cam.x - 2, y0 + 9, R.VW + 4, 2.2);
  for (let i = i0; i <= i1; i++) {
    const x = R.cam.x + i * seg - u0, w = 8 + hash(i * 2.3) * 12, len = 9 + hash(i * 5.1) * 16, x2 = x + seg, len2 = 9 + hash((i + 1) * 5.1) * 16;
    c.fillRect(x + 20, y0, w, len); c.fillRect(x + 20 + w * 0.3, y0 + len, w * 0.4, 3);
    if (hash(i * 9.7) > 0.35) { c.lineWidth = 1.1; c.beginPath(); c.moveTo(x + 24, y0 + len - 1); c.quadraticCurveTo((x + x2) / 2 + 22, y0 + Math.max(len, len2) + 14 + hash(i) * 10, x2 + 24, y0 + len2 - 1); c.stroke(); }
  }
  c.restore();
}
// ---- bloom: the things that emit light are drawn again, alone, into a small canvas; that is shrunk by halves (which blurs it) and added back ----
const BLOOM = { cv: [], on: true };
function drawEmitters(c, s) {
  c.save(); c.globalCompositeOperation = 'lighter';
  const dot = (x, y, r, rgb, a) => { c.fillStyle = 'rgba(' + rgb + ',' + a + ')'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
  const P = R.sprite && PROP.ok ? PROP_ATLAS.frames : null;
  for (const th of s.things) {
    if (th.type === 'term') { const r = P ? P.term.rect : [-9, -34, 18, 14]; c.fillStyle = 'rgba(80,215,255,' + (s.near === th ? 0.55 : 0.36) + ')'; c.fillRect(th.x + r[0], th.y + r[1], r[2], r[3]); }
    else if (th.type === 'switch') { const l = P ? P[th.used ? 'switch1' : 'switch0'].lamp : [0, -16]; dot(th.x + l[0], th.y + l[1], 2.2, th.used ? '159,246,255' : '255,184,77', 0.9); }
    else if (!th.used) { c.fillStyle = 'rgba(125,255,176,0.55)'; c.fillRect(th.x - 1.3, th.y - 19, 2.6, 10); c.fillRect(th.x - 5, th.y - 15.3, 10, 2.6); }
  }
  for (const k of s.checks) if (k.on) { const l = P ? P.check1.lamp : [0, -31]; dot(k.x + l[0], k.y + l[1], 4.2, '159,246,255', 0.8); }
  { const g = s.goal, gf = P ? P.goal : null, hw = gf ? gf.w / PROP_ATLAS.ppu / 2 : 13, hh = gf ? gf.h / PROP_ATLAS.ppu : 54; c.fillStyle = 'rgba(127,227,255,0.5)'; c.fillRect(g.x - hw, g.y - hh, 2.6, hh); c.fillRect(g.x + hw - 2.6, g.y - hh, 2.6, hh); c.fillRect(g.x - hw, g.y - hh, hw * 2, 3.2); }
  for (const q of s.bullets) dot(q.x, q.y, 2.8, '255,225,170', 1);
  for (const e of s.enemies) if (!e.dead && e.type === 'turret' && e.cool < 26) dot(e.x + e.dir * 14, e.y - 14, 2.5 + (1 - e.cool / 26) * 2, '255,184,77', 1 - e.cool / 26);
  c.restore();
}
function drawBloom(c, s) {
  const cw = c.canvas.width, ch = c.canvas.height, n = 4;
  for (let i = 0; i < n; i++) {
    const w = Math.max(2, Math.ceil(cw / (4 << i))), h = Math.max(2, Math.ceil(ch / (4 << i)));
    if (!BLOOM.cv[i]) BLOOM.cv[i] = document.createElement('canvas');
    if (BLOOM.cv[i].width !== w || BLOOM.cv[i].height !== h) { BLOOM.cv[i].width = w; BLOOM.cv[i].height = h; }
  }
  const e = BLOOM.cv[0], x = e.getContext('2d'), k = R.K * e.width / cw, keepK = R.K;
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, e.width, e.height);
  x.setTransform(k, 0, 0, k, -R.cam.x * k, -R.cam.y * k);
  R.K = k;                                                   // glow radii inside the draw calls are given in device pixels: scale them with the canvas
  drawEmitters(x, s);
  x.globalAlpha = TUNE.bloomSaber; for (const a of R.arcs) drawArc(x, a); x.globalAlpha = 1;
  drawParticles(x, true, TUNE.bloomParts);
  const p = s.p;
  if (!p.dead && R.pose && R.pose.atk && R.sprite && HERO.ok) { const h = R.pose, f = HERO_ATLAS.frames[heroFrame(h)]; x.save(); x.globalAlpha = TUNE.bloomSaber; x.translate(h.x, h.y); x.scale(h.face, 1); bladeBlock(x, h, f, 1 / HERO_ATLAS.ppu); x.restore(); }
  R.K = keepK;
  for (let i = 1; i < n; i++) { const y = BLOOM.cv[i].getContext('2d'); y.setTransform(1, 0, 0, 1, 0, 0); y.clearRect(0, 0, BLOOM.cv[i].width, BLOOM.cv[i].height); y.imageSmoothingEnabled = true; y.imageSmoothingQuality = 'high'; y.drawImage(BLOOM.cv[i - 1], 0, 0, BLOOM.cv[i].width, BLOOM.cv[i].height); }
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'lighter'; c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  const amt = [0, 0.28, 0.34, 0.34];                         // tight halo, mid, wide
  for (let i = 1; i < n; i++) { c.globalAlpha = amt[i]; c.drawImage(BLOOM.cv[i], 0, 0, cw, ch); }
  c.restore();
}
// ---- floor reflections: whatever stands on a floor is drawn again upside down just under the floor line, in a few fading strips ----
const SABER_REFLECT = 0;                                    // the blade and the arcs: off for now (Yota: even at the hero's strength, 0.4, they stood out badly)
const HERO_REFLECT = 0.4;                                   // strength of the hero's own reflection against the others (0 = none)
function reflect(c, s, x0, x1, y, drawFn, gain) {
  const L = s.L, row = Math.round(y / T); if (Math.abs(y - row * T) > 0.6) return;                      // only for things standing exactly on a tile top
  const at = (i, j) => (i < 0 || i >= L.W || j < 0 || j >= L.H) ? 0 : L.t[j * L.W + i], cols = [];
  for (let i = Math.floor(x0 / T); i <= Math.floor(x1 / T); i++) if (at(i, row) === 1 && at(i, row - 1) !== 1) cols.push(i);
  if (!cols.length) return;
  const A = [0.2, 0.13, 0.08, 0.04], hgt = 3.4;
  for (let k = 0; k < A.length; k++) {
    c.save(); c.beginPath(); for (const i of cols) c.rect(i * T, y + 0.9 + k * hgt, T + 0.05, hgt); c.clip();
    c.globalAlpha = A[k] * (gain || 1); c.translate(0, 2 * y + 0.9); c.scale(1, -1); drawFn(); c.restore();
  }
}
function drawReflections(c, s) {
  const p = s.p;
  for (const th of s.things) if (R.sprite && PROP.ok && th.x > R.cam.x - 30 && th.x < R.cam.x + R.VW + 30) reflect(c, s, th.x - 16, th.x + 16, th.y, () => drawThingSprite(c, s, th));
  for (const e of s.enemies) if (!e.dead && R.sprite && FOE.ok && e.x > R.cam.x - 40 && e.x < R.cam.x + R.VW + 40) reflect(c, s, e.x - 22, e.x + 22, e.y, () => drawFoeSprite(c, e, 0));
  if (R.pose && p.ground && !p.dead) {
    // The hero is drawn with a pale rim so she reads against the dark stage; mirrored, that rim made her reflection look
    // heavier and dirtier than the others. So: no rim in the reflection, and under half the strength. The blade and arcs are held to the same strength.
    R.noRim = true; reflect(c, s, p.x - 30, p.x + 30, p.y, () => drawHero(c, Object.assign({}, R.pose, { atk: null }), null), HERO_REFLECT); R.noRim = false;
    if (SABER_REFLECT > 0 && (R.pose.atk || R.arcs.length)) reflect(c, s, p.x - 64, p.x + 64, p.y, () => { const h = R.pose; if (h.atk && R.sprite && HERO.ok) { const f = HERO_ATLAS.frames[heroFrame(h)]; c.save(); c.translate(h.x, h.y); c.scale(h.face, 1); bladeBlock(c, h, f, 1 / HERO_ATLAS.ppu); c.restore(); } for (const a of R.arcs) drawArc(c, a); }, SABER_REFLECT);
  }
}
// ---- shader pass (R.post): the finished 2D picture goes through a fragment shader on a WebGL canvas laid over it ----
// First use: shock waves from hits bend the picture, with a little colour fringing inside the bend.
// The WebGL canvas is only shown while a wave is alive, so there is no per-frame cost the rest of the time.
const POST = { gl: null, cv: null, fail: false, shown: false };
const POST_FS = `precision mediump float;
uniform sampler2D t; uniform vec2 res; uniform vec4 w[4]; uniform float a[4]; uniform vec4 h[3]; uniform float hs[3]; uniform float tm; uniform float k; uniform vec2 ctr; uniform float rb; uniform float ca;
void main(){
  vec2 px = gl_FragCoord.xy, off = vec2(0.0);
  for (int i = 0; i < 4; i++) {
    vec2 d = px - w[i].xy; float dist = length(d);
    float k = 1.0 - clamp(abs(dist - w[i].z) / max(w[i].w, 1.0), 0.0, 1.0); k = k * k * (3.0 - 2.0 * k);
    off += d / max(dist, 1.0) * k * a[i];
  }
  vec2 fr = off * 0.4 / res, q = px / k;
  for (int i = 0; i < 3; i++) {                                   // heat: columns of air that wobble as they rise and thin out with height
    float up = (px.y - h[i].y) / max(h[i].w, 1.0), side = min(px.x - h[i].x, h[i].z - px.x) / (4.0 * k);
    float m = clamp(side, 0.0, 1.0) * clamp(up * 8.0, 0.0, 1.0) * clamp(1.0 - up, 0.0, 1.0) * hs[i];
    off += m * k * vec2(sin(q.y * 0.42 - tm * 0.19 + q.x * 0.11) + 0.6 * sin(q.y * 0.93 - tm * 0.31), 0.5 * sin(q.x * 0.5 + q.y * 0.3 - tm * 0.23));
  }
  vec2 uv = (px - off) / res, cs = fr + vec2(ca / res.x, 0.0);   // ca: a sideways colour split over the whole view for a moment (taking a hit)
  vec3 col = vec3(texture2D(t, uv + cs).r, texture2D(t, uv).g, texture2D(t, uv - cs).b);
  if (rb > 0.0) {                                                 // dash: the picture smears towards the hero, more the further out, nothing near her
    vec2 d = (px - ctr) / res; float far = smoothstep(0.22, 0.8, length(d * vec2(res.x / res.y, 1.0))) * rb;
    for (int i = 1; i < 5; i++) col += texture2D(t, uv - d * far * float(i) * 0.25).rgb;
    col *= 0.2;
  }
  gl_FragColor = vec4(col, 1.0);
}`;
function postInit(src) {
  if (POST.fail || POST.gl) return !!POST.gl;
  try {
    const cv = document.createElement('canvas'); cv.id = 'post'; cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;display:none';
    const gl = cv.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('no webgl');
    const sh = (type, code) => { const o = gl.createShader(type); gl.shaderSource(o, code); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }')); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, POST_FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr); const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    POST.u = { res: gl.getUniformLocation(pr, 'res'), w: gl.getUniformLocation(pr, 'w'), a: gl.getUniformLocation(pr, 'a'), h: gl.getUniformLocation(pr, 'h'), hs: gl.getUniformLocation(pr, 'hs'), tm: gl.getUniformLocation(pr, 'tm'), k: gl.getUniformLocation(pr, 'k'), ctr: gl.getUniformLocation(pr, 'ctr'), rb: gl.getUniformLocation(pr, 'rb'), ca: gl.getUniformLocation(pr, 'ca') };
    cv.addEventListener('webglcontextlost', e => { e.preventDefault(); POST.fail = true; cv.style.display = 'none'; });
    src.parentNode.insertBefore(cv, src.nextSibling); POST.cv = cv; POST.gl = gl;
  } catch (err) { POST.fail = true; POST.err = String(err); }
  return !!POST.gl;
}
function postShow(on) { if (POST.cv && POST.shown !== on) { POST.cv.style.display = on ? 'block' : 'none'; POST.shown = on; } }
const POSTFX = { dash: 0.018, hurt: 2.4, hurtT: 10 };          // dash: smear length at the far edge, as a share of the distance to the hero. hurt: colour split in game units, and how many steps it lasts
R.postfx = POSTFX;
const HEAT = { L: null, runs: [], spikes: 0, charge: 0.4 };   // strengths in game units of wobble. Spikes: off (Yota: hard to see, not worth it); set above 0 to bring it back
function heatZones(s) {                                          // [x0, bottom, x1, height, strength] in world units, only those in view
  if (HEAT.L !== s.L) { HEAT.L = s.L; HEAT.runs = []; const L = s.L;
    for (let j = 0; j < L.H; j++) for (let i = 0; i < L.W; i++) if (L.t[j * L.W + i] === 2) { let n = i; while (n < L.W && L.t[j * L.W + n] === 2) n++; if (HEAT.spikes > 0) HEAT.runs.push([i * T - 3, j * T + 6, n * T + 3, 62, HEAT.spikes]); i = n; } }
  const out = HEAT.runs.filter(z => z[2] > R.cam.x && z[0] < R.cam.x + R.VW && z[1] - z[3] < R.cam.y + R.VH && z[1] > R.cam.y);
  const p = s.p; if (!p.dead && p.charge >= C.CHARGE_T) out.push([p.x - 15, p.y - 2, p.x + 15, 50, HEAT.charge]);   // a fully charged blade heats the air around the hero
  return out.slice(0, 3);
}
R.heat = HEAT;
function drawPost(c, s) {
  const live = R.waves.filter(q => q.life > 0), hot = R.fx && R.post ? heatZones(s) : [];
  const blur = R.rb > 0.03 ? R.rb : 0;
  if (!R.fx || !R.post || !(live.length || hot.length || blur || R.hurtFx > 0) || typeof document === 'undefined' || !postInit(c.canvas) || POST.fail) { postShow(false); return; }
  const gl = POST.gl, cv = POST.cv, cw = c.canvas.width, ch = c.canvas.height;
  if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
  gl.viewport(0, 0, cw, ch);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c.canvas);
  if (!POST.checked) { POST.checked = true; if (gl.getError() !== gl.NO_ERROR) { POST.fail = true; POST.err = 'upload'; postShow(false); return; } }
  const w = new Float32Array(16), a = new Float32Array(4);
  live.slice(-4).forEach((q, i) => { const u = 1 - q.life / q.max, e = 1 - (1 - u) * (1 - u);              // the ring runs out fast, then slows; it fades as it goes
    w[i * 4] = (q.x - R.cam.x) * R.K; w[i * 4 + 1] = ch - (q.y - R.cam.y) * R.K; w[i * 4 + 2] = q.r * e * R.K; w[i * 4 + 3] = (5 + q.r * 0.22) * R.K; a[i] = q.amp * (1 - u) * R.K; });
  const hz = new Float32Array(12), hst = new Float32Array(3);
  hot.forEach((z, i) => { hz[i * 4] = (z[0] - R.cam.x) * R.K; hz[i * 4 + 1] = ch - (z[1] - R.cam.y) * R.K; hz[i * 4 + 2] = (z[2] - R.cam.x) * R.K; hz[i * 4 + 3] = z[3] * R.K; hst[i] = z[4]; });
  gl.uniform4fv(POST.u.h, hz); gl.uniform1fv(POST.u.hs, hst); gl.uniform1f(POST.u.tm, R.t % 100000); gl.uniform1f(POST.u.k, R.K);
  gl.uniform2f(POST.u.ctr, (s.p.x - R.cam.x) * R.K, ch - (s.p.y - 14 - R.cam.y) * R.K); gl.uniform1f(POST.u.rb, blur * POSTFX.dash); gl.uniform1f(POST.u.ca, R.hurtFx / POSTFX.hurtT * POSTFX.hurt * R.K);
  gl.uniform2f(POST.u.res, cw, ch); gl.uniform4fv(POST.u.w, w); gl.uniform1fv(POST.u.a, a);
  gl.drawArrays(gl.TRIANGLES, 0, 3); postShow(true);
}
R.postInfo = () => ({ ready: !!POST.gl, fail: POST.fail, err: POST.err || null, shown: POST.shown });
const GRAIN = { cv: null };
function drawFinish(c) {                                    // in device pixels, over everything: colour wash, vignette, grain
  const cw = c.canvas.width, ch = c.canvas.height;
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  const wash = c.createLinearGradient(0, 0, 0, ch); wash.addColorStop(0, 'rgba(40,80,170,0.20)'); wash.addColorStop(0.6, 'rgba(60,90,160,0.06)'); wash.addColorStop(1, 'rgba(130,70,150,0.12)');
  c.globalCompositeOperation = 'soft-light'; c.fillStyle = wash; c.fillRect(0, 0, cw, ch);
  c.globalCompositeOperation = 'source-over';
  const v = c.createRadialGradient(cw / 2, ch * 0.52, Math.min(cw, ch) * 0.42, cw / 2, ch * 0.52, Math.hypot(cw, ch) * 0.62); v.addColorStop(0, 'rgba(2,4,10,0)'); v.addColorStop(1, 'rgba(2,4,10,0.62)');
  c.fillStyle = v; c.fillRect(0, 0, cw, ch);
  if (!GRAIN.cv && typeof document !== 'undefined') {
    const g = document.createElement('canvas'); g.width = g.height = 128; const x = g.getContext('2d'), d = x.createImageData(128, 128);
    for (let i = 0; i < d.data.length; i += 4) { const n = 128 + (hash(i * 0.37) - 0.5) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = n; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0); GRAIN.cv = g; GRAIN.pat = c.createPattern(g, 'repeat');
  }
  if (GRAIN.pat) { c.globalCompositeOperation = 'overlay'; c.globalAlpha = 0.06; c.translate(-((R.t * 37) % 128), -((R.t * 53) % 128)); c.fillStyle = GRAIN.pat; c.fillRect(0, 0, cw + 128, ch + 128); }
  c.restore();
}
function drawLights(c, s) {                                 // additive pools of light on whatever is behind them
  const p = s.p, pulse = 0.8 + Math.sin(R.t * 0.07) * 0.2;
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const th of s.things) {
    if (th.type === 'term') light(c, th.x, th.y - 26, 62, '80,200,255', (s.near === th ? 0.2 : 0.13) * pulse);
    else if (th.type === 'switch') light(c, th.x, th.y - 21, 40, th.used ? '110,225,255' : '255,180,80', 0.15 * pulse);
    else if (!th.used) light(c, th.x, th.y - 14, 52, '110,255,170', 0.15 * pulse);
  }
  for (const k of s.checks) if (k.on) light(c, k.x, k.y - 30, 58, '120,225,255', 0.16 * pulse);
  light(c, s.goal.x, s.goal.y - 26, 90, '120,225,255', 0.16 * pulse);
  for (const e of s.enemies) if (!e.dead && e.type !== 'dummy') light(c, e.x + (e.dir || 1) * 4, e.y - e.h * 0.6, 26, '255,180,80', 0.10);
  for (const q of s.bullets) light(c, q.x, q.y, 22, '255,190,100', 0.22);
  if (!p.dead) {
    if (p.atk) { const a = ATK[p.atk.id], on = p.atk.f >= a.act[0] - 2 && p.atk.f <= a.act[1] + 4; light(c, p.x + p.face * 14, p.y - 16, a.heavy ? 96 : 74, '110,220,255', on ? TUNE.pool : TUNE.pool * 0.46); }
    if (p.charge > 12) light(c, p.x, p.y - 16, 46 + Math.min(1, p.charge / C.CHARGE_T) * 26, '140,230,255', 0.10 + Math.min(1, p.charge / C.CHARGE_T) * 0.12);
  }
  c.restore();
}
function drawBackdrop(c, s) {
  const fx = R.fx && R.sprite && SKY.every(k => k.ok);
  const g = c.createLinearGradient(0, R.cam.y, 0, R.cam.y + R.VH); if (fx) { g.addColorStop(0, '#040814'); g.addColorStop(0.5, '#0a152b'); g.addColorStop(1, '#0d1a36'); } else { g.addColorStop(0, '#0b1324'); g.addColorStop(0.6, '#0a1020'); g.addColorStop(1, '#060a14'); }
  c.fillStyle = g; c.fillRect(R.cam.x - 2, R.cam.y - 2, R.VW + 4, R.VH + 4);
  if (R.sprite && SKY.every(k => k.ok)) {
    // The skyline stands on a line a little below the main floor, and drifts less than the stage when the camera climbs (far layer least).
    // Below the picture, its bottom row is stretched down, so buildings do not end in mid-air where a pit shows what is behind the floor.
    const base = R.VH * 0.72, camRef = s.L.GY * T + 14 - base; c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    for (const k of SKY) {
      const w = k.img.width * k.h / k.img.height, ox = R.cam.x * (1 - k.par), y = R.cam.y + base + (camRef - R.cam.y) * k.par * 0.6 - k.h;
      if (fx && k === SKY[0]) {                              // glow on the horizon, behind the farthest buildings
        const yb = y + k.h, hg = c.createLinearGradient(0, yb - 150, 0, yb + 40); hg.addColorStop(0, 'rgba(60,110,210,0)'); hg.addColorStop(0.75, 'rgba(60,110,210,0.26)'); hg.addColorStop(1, 'rgba(60,110,210,0)');
        c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = hg; c.fillRect(R.cam.x - 2, yb - 150, R.VW + 4, 190); c.restore();
      }
      for (let i = Math.floor((R.cam.x - ox) / w) - 1, x = ox + i * w; x < R.cam.x + R.VW; i++, x = ox + i * w) if (x + w > R.cam.x) {
        c.drawImage(k.img, x, y, w + 0.3, k.h); c.drawImage(k.img, 0, k.img.height - 2, k.img.width, 1, x, y + k.h - 0.3, w + 0.3, R.VH + 300);
      }
      if (fx) {                                             // depth fog: the far layer is hazier and bluer than the near one
        const far = k === SKY[0]; haze(c, y - 10, y + k.h, far ? '52,88,150' : '30,54,98', far ? 0.6 : 0.36);
        drawMist(c, y + k.h + 6, k.par + 0.08, far ? 0.035 : 0.07, far ? 0.55 : 0.4);
      }
    }
    return;
  }
  for (const [par, w, col, lit] of [[0.2, 46, '#0d172b', 'rgba(95,216,255,.10)'], [0.45, 30, '#101c33', 'rgba(176,108,255,.13)']]) {
    const ox = R.cam.x * (1 - par), oy = R.cam.y * (1 - par) * 0.6, gap = w * 3.2, i0 = Math.floor((R.cam.x - ox) / gap) - 1, i1 = i0 + Math.ceil(R.VW / gap) + 2;
    for (let i = i0; i <= i1; i++) {
      const x = ox + i * gap + hash(i + w) * gap * 0.4, top = R.cam.y + oy * 0.2 + 20 + hash(i * 3 + w) * 120;
      c.fillStyle = col; c.fillRect(x, top, w, R.VH + 300);
      c.fillStyle = lit; c.fillRect(x + w * 0.2, top + 8, 1.2, R.VH + 300); c.fillRect(x + 4, top, w - 8, 1);
    }
  }
}
const TILE = { img: null, ok: false };                    // one wall panel (assets/tile.png), drawn once per solid tile
if (typeof Image !== 'undefined') { TILE.img = new Image(); TILE.img.onload = () => { TILE.ok = true; }; TILE.img.onerror = () => {}; TILE.img.src = 'assets/tile.png'; }
const GATE = { img: null, ok: false }, SPIKE = { img: null, ok: false };
if (typeof Image !== 'undefined') for (const [o, src] of [[GATE, 'assets/gate.png'], [SPIKE, 'assets/spikes.png']]) { o.img = new Image(); o.img.onload = () => { o.ok = true; }; o.img.onerror = () => {}; o.img.src = src; }
function drawTiles(c, s) {
  const L = s.L, i0 = Math.max(0, Math.floor(R.cam.x / T)), i1 = Math.min(L.W - 1, Math.floor((R.cam.x + R.VW) / T)), j0 = Math.max(0, Math.floor(R.cam.y / T)), j1 = Math.min(L.H - 1, Math.floor((R.cam.y + R.VH) / T));
  const at = (i, j) => (i < 0 || i >= L.W) ? 1 : (j < 0 || j >= L.H) ? (j < 0 ? 0 : 1) : L.t[j * L.W + i];
  const panel = R.sprite && TILE.ok;
  c.fillStyle = '#131f33'; if (panel) { c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; }
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (at(i, j) === 1) { if (panel) c.drawImage(TILE.img, i * T, j * T, T + 0.3, T + 0.3); else c.fillRect(i * T, j * T, T + 0.3, T + 0.3); }
  c.fillStyle = 'rgba(150,185,230,.05)';
  if (!panel) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (at(i, j) === 1) { if ((i + j) % 2 === 0) c.fillRect(i * T + 1, j * T + 1, T - 2, T - 2); }
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const v = at(i, j);
    if (v === 1) {
      if (at(i, j - 1) !== 1) { c.fillStyle = 'rgba(95,216,255,.16)'; c.fillRect(i * T, j * T, T, 3.2); c.fillStyle = '#7fe3ff'; c.fillRect(i * T, j * T, T, 0.9); }
      if (at(i - 1, j) !== 1) { c.fillStyle = 'rgba(140,190,255,.38)'; c.fillRect(i * T, j * T, 0.7, T); }
      if (at(i + 1, j) !== 1) { c.fillStyle = 'rgba(140,190,255,.38)'; c.fillRect(i * T + T - 0.7, j * T, 0.7, T); }
      if (at(i, j + 1) !== 1) { c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(i * T, j * T + T - 1.5, T, 1.5); }
    } else if (v === 2 && R.sprite && SPIKE.ok) {
      for (let k = 0; k < 3; k++) {                                   // the strip holds 6 spikes: 3 per tile. Each one stretches a little from a fixed base, so the tips sway
        const top = 4.5 + Math.sin(R.t * 0.1 + i + k) * 0.6, sw = 128 / 3;
        c.drawImage(SPIKE.img, (i & 1) * 128 + k * sw, 0, sw, 88, i * T + k * T / 3, j * T + top, T / 3 + 0.15, T - top);
      }
    } else if (v === 2) {
      c.fillStyle = COL.danger; c.beginPath();
      for (let k = 0; k < 3; k++) { const x = i * T + k * T / 3; c.moveTo(x, j * T + T); c.lineTo(x + T / 6, j * T + 5 + Math.sin(R.t * 0.1 + i + k) * 0.6); c.lineTo(x + T / 3, j * T + T); }
      c.fill();
    }
  }
}
function drawSigns(c, s) {
  const size = clamp(12.5 / R.css, 5.2, 8.5);
  c.font = '600 ' + size + 'px "Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",Meiryo,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  for (const g of s.L.signs) {
    if (g.x < R.cam.x - 160 || g.x > R.cam.x + R.VW + 160) continue;
    const w = c.measureText(g.text).width, y = g.y - 86;
    c.fillStyle = 'rgba(8,16,30,.72)'; c.fillRect(g.x - w / 2 - 6, y - size - 3, w + 12, size + 8);
    c.fillStyle = 'rgba(127,227,255,.8)'; c.fillRect(g.x - w / 2 - 6, y + 5, w + 12, 0.8);
    c.fillStyle = '#dff4ff'; c.fillText(g.text, g.x, y);
  }
}
// ---- equipment as sprites (assets/props.png + js/prop_atlas.js); the line drawings remain as the fallback ----
const PROP = { img: null, ok: false };
if (typeof PROP_ATLAS !== 'undefined' && typeof Image !== 'undefined') {
  PROP.img = new Image(); PROP.img.onload = () => { PROP.ok = true; }; PROP.img.src = 'assets/props.png';
}
function prop(c, name, x, y) {
  const f = PROP_ATLAS.frames[name], u = 1 / PROP_ATLAS.ppu; c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(PROP.img, f.x, f.y, f.w, f.h, x - f.ax * u, y - f.ay * u, f.w * u, f.h * u); return f;
}
function glowDot(c, x, y, r, color, a) {
  const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color + a + ')'); g.addColorStop(1, color + '0)');
  c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.restore();
}
function drawMarkersSprite(c, s) {
  for (const k of s.checks) {
    const f = prop(c, k.on ? 'check1' : 'check0', k.x, k.y);
    if (k.on) glowDot(c, k.x + f.lamp[0], k.y + f.lamp[1], 11, 'rgba(159,246,255,', 0.35 + Math.sin(R.t * 0.1) * 0.15);
  }
  const g = s.goal, glow = 0.55 + Math.sin(R.t * 0.08) * 0.25, gf = PROP_ATLAS.frames.goal, half = gf.w / PROP_ATLAS.ppu / 2 - 2.6, top = gf.h / PROP_ATLAS.ppu - 4;
  c.save(); c.globalCompositeOperation = 'lighter';
  const gr = c.createLinearGradient(0, g.y - top, 0, g.y); gr.addColorStop(0, 'rgba(159,246,255,0)'); gr.addColorStop(1, 'rgba(159,246,255,' + glow * 0.5 + ')');
  c.fillStyle = gr; c.fillRect(g.x - half, g.y - top, half * 2, top); c.restore();
  prop(c, 'goal', g.x, g.y);
}
function drawThingSprite(c, s, th) {
  const near = s.near === th, glow = 0.65 + Math.sin(R.t * 0.12 + th.x) * 0.25;
  if (th.type === 'term') {
    const f = prop(c, 'term', th.x, th.y), r = f.rect, x = th.x + r[0] + 1.2, y = th.y + r[1] + 1.2, w = r[2] - 2.4, h = r[3] - 2.4;
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = COL.glow + (near ? 0.5 : 0.28) * glow + ')'; c.fillRect(x, y, w, h);
    c.fillStyle = COL.glow + '0.85)'; for (let k = 0; k < 3; k++) c.fillRect(x + 2.2, y + 2.4 + k * (h - 4) / 3, 7 + ((R.t >> 4) + k * 5) % 9, 1.1); c.restore();
  } else if (th.type === 'switch') {
    const f = prop(c, th.used ? 'switch1' : 'switch0', th.x, th.y);
    glowDot(c, th.x + f.lamp[0], th.y + f.lamp[1], 5, th.used ? 'rgba(159,246,255,' : 'rgba(255,184,77,', th.used ? 0.55 : glow * 0.7);
  } else {
    const f = PROP_ATLAS.frames[th.used ? 'heal1' : 'heal0'], r = f.rect;
    if (!th.used) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(125,255,176,' + 0.2 * glow + ')'; c.fillRect(th.x + r[0], th.y + r[1], r[2], r[3]); c.restore(); }
    else { c.fillStyle = 'rgba(58,74,102,.28)'; c.fillRect(th.x + r[0], th.y + r[1], r[2], r[3]); }
    prop(c, th.used ? 'heal1' : 'heal0', th.x, th.y);
  }
}
function drawMarkers(c, s) {
  if (R.sprite && PROP.ok) return drawMarkersSprite(c, s);
  for (const k of s.checks) {
    const on = k.on, pulse = 0.6 + Math.sin(R.t * 0.1) * 0.4;
    c.fillStyle = '#1b2942'; c.fillRect(k.x - 1.5, k.y - 26, 3, 26);
    c.save(); if (on) { c.globalCompositeOperation = 'lighter'; c.shadowColor = COL.blade; c.shadowBlur = 8 * R.K; }
    c.fillStyle = on ? 'rgba(159,246,255,' + (0.7 + pulse * 0.3) + ')' : '#3a4a66';
    c.beginPath(); c.moveTo(k.x, k.y - 37); c.lineTo(k.x + 4.5, k.y - 31); c.lineTo(k.x, k.y - 25); c.lineTo(k.x - 4.5, k.y - 31); c.fill(); c.restore();
  }
  const g = s.goal, glow = 0.55 + Math.sin(R.t * 0.08) * 0.25;
  c.save(); c.globalCompositeOperation = 'lighter';
  const gr = c.createLinearGradient(0, g.y - 50, 0, g.y); gr.addColorStop(0, 'rgba(159,246,255,0)'); gr.addColorStop(1, 'rgba(159,246,255,' + glow * 0.5 + ')');
  c.fillStyle = gr; c.fillRect(g.x - 11, g.y - 50, 22, 50); c.restore();
  c.fillStyle = '#7fe3ff'; c.fillRect(g.x - 13, g.y - 52, 2, 52); c.fillRect(g.x + 11, g.y - 52, 2, 52); c.fillRect(g.x - 13, g.y - 54, 26, 2);
}
// terminals, the heal capsule, the switch and its gate
function drawThings(c, s) {
  for (const g of s.L.gates) {
    const x = g.col * T, y0 = g.r0 * T, h = (g.r1 - g.r0 + 1) * T, lift = (g.lift || 0), ease = lift * lift * (3 - 2 * lift), shown = h * (1 - ease);
    if (shown > 0.5) {
      c.save(); c.beginPath(); c.rect(x - 2, y0, T + 4, shown); c.clip(); c.translate(0, -h * ease);
      if (R.sprite && GATE.ok) { c.imageSmoothingEnabled = true; c.drawImage(GATE.img, x + 1, y0, T - 2, h); c.restore(); } else {
      c.fillStyle = '#1d2c47'; c.fillRect(x + 2, y0, T - 4, h); c.fillStyle = 'rgba(255,184,77,.85)';
      for (let k = 0; k < h; k += 12) { c.beginPath(); c.moveTo(x + 2, y0 + k + 8); c.lineTo(x + T - 2, y0 + k + 2); c.lineTo(x + T - 2, y0 + k + 5); c.lineTo(x + 2, y0 + k + 11); c.fill(); }
      c.strokeStyle = g.open ? COL.blade : COL.foe; c.lineWidth = 0.8; c.strokeRect(x + 2, y0, T - 4, h); c.restore(); }
    }
    c.fillStyle = g.open ? COL.blade : COL.foe; c.fillRect(x - 1, y0 - 2.5, T + 2, 1.5);
  }
  for (const th of s.things) {
    if (R.sprite && PROP.ok) { drawThingSprite(c, s, th); continue; }
    const near = s.near === th, glow = 0.65 + Math.sin(R.t * 0.12 + th.x) * 0.25;
    c.save(); c.translate(th.x, th.y);
    if (th.type === 'term') {
      c.fillStyle = '#1b2942'; c.fillRect(-2, -15, 4, 15); c.fillRect(-6, -2, 12, 2); c.fillStyle = '#26344f'; c.fillRect(-7, -18, 14, 4);
      c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = COL.glow + (near ? 0.5 : 0.28) * glow + ')'; c.fillRect(-9, -34, 18, 14);
      c.strokeStyle = COL.glow + (near ? 0.95 : 0.6) + ')'; c.lineWidth = 0.7; c.strokeRect(-9, -34, 18, 14);
      c.fillStyle = COL.glow + '0.85)'; for (let k = 0; k < 3; k++) c.fillRect(-6, -31 + k * 3.6, 6 + ((R.t >> 4) + k * 5) % 7, 1); c.restore();
    } else if (th.type === 'switch') {
      const col = th.used ? COL.blade : COL.foe;
      c.fillStyle = '#1b2942'; c.fillRect(-1.5, -14, 3, 14); c.fillStyle = '#26344f'; c.beginPath(); c.roundRect(-6, -27, 12, 14, 2); c.fill(); c.strokeStyle = col; c.lineWidth = 0.8; c.stroke();
      c.strokeStyle = col; c.lineWidth = 1.8; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -20); c.lineTo(th.used ? 4 : -4, -25); c.stroke();
      c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = col; c.globalAlpha = th.used ? 0.9 : glow; c.beginPath(); c.arc(0, -16, 1.5, 0, TAU); c.fill(); c.restore();
    } else {
      const col = th.used ? '#3a4a66' : '#7dffb0';
      c.fillStyle = '#1b2942'; c.fillRect(-8, -3, 16, 3); c.fillRect(-8, -27, 16, 3);
      c.save(); if (!th.used) c.globalCompositeOperation = 'lighter'; c.fillStyle = th.used ? 'rgba(58,74,102,.35)' : 'rgba(125,255,176,' + 0.22 * glow + ')'; c.fillRect(-6, -24, 12, 21);
      c.strokeStyle = col; c.lineWidth = 0.8; c.strokeRect(-6, -24, 12, 21); c.fillStyle = col; c.fillRect(-1, -18, 2, 9); c.fillRect(-4.5, -14.5, 9, 2); c.restore();
    }
    c.restore();
  }
}
function hpBar(c, e) { if (e.hp >= e.maxHp || e.hp <= 0) return; const w = Math.max(14, e.hw * 2); c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(e.x - w / 2, e.y - e.h - 7, w, 2.2); c.fillStyle = COL.foe; c.fillRect(e.x - w / 2, e.y - e.h - 7, w * e.hp / e.maxHp, 2.2); }
// ---- enemies as sprites (assets/foes.png + js/foe_atlas.js); the line drawings below remain as the fallback ----
const FOE = { img: null, ok: false, white: null };
if (typeof FOE_ATLAS !== 'undefined' && typeof Image !== 'undefined') {
  FOE.img = new Image(); FOE.img.onload = () => { FOE.ok = true; }; FOE.img.src = 'assets/foes.png';
}
function foeWhite() {
  if (!FOE.white) { const cv = document.createElement('canvas'); cv.width = FOE.img.width; cv.height = FOE.img.height; const x = cv.getContext('2d'); x.drawImage(FOE.img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#ffffff'; x.fillRect(0, 0, cv.width, cv.height); FOE.white = cv; }
  return FOE.white;
}
function foeFrame(e) {
  if (e.type === 'dummy') return e.flash > 0 || e.stun > 0 ? 'dummy1' : 'dummy0';
  if (e.type === 'patrol') return 'patrol' + (Math.floor(e.x / 5) & 1);          // steps with distance walked
  if (e.type === 'heavy') return 'heavy' + (Math.floor(e.x / 6) & 1);
  return e.cool > 97 ? 'turret1' : 'turret0';                                    // barrel recoils just after a shot
}
function drawFoeSprite(c, e, jx) {
  const f = FOE_ATLAS.frames[foeFrame(e)], u = 1 / FOE_ATLAS.ppu;
  c.save(); c.translate(e.x + jx, e.y); c.scale(e.type === 'dummy' ? 1 : (e.dir || 1), 1); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(e.flash > 4 ? foeWhite() : FOE.img, f.x, f.y, f.w, f.h, -f.ax * u, -f.ay * u, f.w * u, f.h * u);
  c.restore();
  if (e.type === 'turret' && e.cool < 26) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,184,77,' + (1 - e.cool / 26) + ')'; c.beginPath(); c.arc(e.x + jx + e.dir * 14, e.y - 14, 2.5 + (1 - e.cool / 26) * 2, 0, TAU); c.fill(); c.restore(); }
}
function drawEnemies(c, s) {
  for (const e of s.enemies) {
    if (!e.dead && R.sprite && FOE.ok) { drawFoeSprite(c, e, e.flash > 0 ? Math.sin(R.t * 2.4) * e.flash * 0.22 : 0); hpBar(c, e); continue; }
    if (e.dead) { if (e.type === 'dummy') { c.fillStyle = '#1b2942'; c.fillRect(e.x - 1.5, e.y - 6, 3, 6); } continue; }
    const fl = e.flash > 4, jx = e.flash > 0 ? Math.sin(R.t * 2.4) * e.flash * 0.22 : 0, body = fl ? '#ffffff' : '#26344f', edge = fl ? '#ffffff' : COL.foe;
    c.save(); c.translate(e.x + jx, e.y);
    if (e.type === 'dummy') {
      c.fillStyle = fl ? '#fff' : '#1b2942'; c.fillRect(-1.5, -22, 3, 22); c.fillRect(-6, -1.5, 12, 1.5);
      c.strokeStyle = edge; c.lineWidth = 1.6; c.beginPath(); c.arc(0, -23, 6.2, 0, TAU); c.stroke(); c.fillStyle = edge; c.beginPath(); c.arc(0, -23, 1.8, 0, TAU); c.fill();
      c.strokeStyle = body; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-7, -13); c.lineTo(7, -13); c.stroke();
    } else if (e.type === 'patrol') {
      const bob = Math.sin(R.t * 0.2 + e.sx) * 0.8;
      c.fillStyle = body; c.beginPath(); c.roundRect(-9, -15 + bob, 18, 12, 5); c.fill(); c.strokeStyle = edge; c.lineWidth = 0.9; c.stroke();
      c.fillStyle = edge; c.beginPath(); c.arc(e.dir * 4, -9.5 + bob, 2, 0, TAU); c.fill();
      c.strokeStyle = body; c.lineWidth = 2; c.beginPath(); c.moveTo(-5, -4 + bob); c.lineTo(-6, 0); c.moveTo(5, -4 + bob); c.lineTo(6, 0); c.stroke();
    } else if (e.type === 'heavy') {
      c.fillStyle = body; c.beginPath(); c.roundRect(-11, -30, 22, 30, 3); c.fill(); c.strokeStyle = edge; c.lineWidth = 1; c.stroke();
      c.fillStyle = edge; c.fillRect(e.dir > 0 ? 1 : -9, -24, 8, 2); c.fillStyle = 'rgba(255,184,77,.25)'; c.fillRect(-11, -14, 22, 1);
    } else {
      c.fillStyle = body; c.beginPath(); c.moveTo(-8, 0); c.lineTo(-6, -11); c.lineTo(6, -11); c.lineTo(8, 0); c.fill(); c.strokeStyle = edge; c.lineWidth = 0.9; c.stroke();
      c.fillStyle = body; c.fillRect(e.dir > 0 ? 0 : -13, -15, 13, 5); c.strokeRect(e.dir > 0 ? 0 : -13, -15, 13, 5);
      if (e.cool < 26) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,184,77,' + (1 - e.cool / 26) + ')'; c.beginPath(); c.arc(e.dir * 13, -12.5, 2.5 + (1 - e.cool / 26) * 2, 0, TAU); c.fill(); c.restore(); }
    }
    c.restore(); hpBar(c, e);
  }
  c.save(); c.globalCompositeOperation = 'lighter'; c.shadowColor = COL.foe; c.shadowBlur = 6 * R.K;
  for (const q of s.bullets) { c.fillStyle = 'rgba(255,184,77,.45)'; c.fillRect(q.x - (q.vx > 0 ? 9 : 0), q.y - 1, 9, 2); c.fillStyle = '#fff3d6'; c.beginPath(); c.arc(q.x, q.y, 2.6, 0, TAU); c.fill(); }
  c.restore();
}
function drawParticles(c, onlyAdd, gain) {
  for (const q of R.parts) {
    if (onlyAdd && !q.add) continue;                         // the bloom pass takes only the particles that emit light
    const k = q.life / q.max;
    c.save(); if (q.add) c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, k * (q.puff ? 0.5 : 1.3)) * (gain || 1);
    if (q.ring) { c.strokeStyle = q.color; c.lineWidth = 2.2 * k + 0.3; c.beginPath(); c.arc(q.x, q.y, q.size * (1 - k * k) + 2, 0, TAU); c.stroke(); }
    else if (q.star) { c.translate(q.x, q.y); c.rotate(q.rot); c.fillStyle = q.color; for (let i = 0; i < 2; i++) { c.rotate(Math.PI / 2 * i + 0.4 * i); const l = q.size * (1.2 - k * 0.5), w = 1.6 * k + 0.2; c.beginPath(); c.moveTo(-l, 0); c.lineTo(0, -w); c.lineTo(l, 0); c.lineTo(0, w); c.fill(); } }
    else if (q.streak) { c.strokeStyle = q.color; c.lineWidth = q.size; c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x - q.vx * 2.2, q.y - q.vy * 2.2); c.stroke(); }
    else { c.fillStyle = q.color; const r = q.puff ? q.size * (1.6 - k * 0.6) : q.size; c.beginPath(); c.arc(q.x, q.y, r, 0, TAU); c.fill(); }
    c.restore();
  }
}

R.draw = function (s) {
  const c = R.ctx, p = s.p, sx = (Math.random() - 0.5) * R.shake, sy = (Math.random() - 0.5) * R.shake;
  c.setTransform(R.K, 0, 0, R.K, -(R.cam.x + sx) * R.K, -(R.cam.y + sy) * R.K);
  drawBackdrop(c, s); if (R.fx) drawMotes(c, 26, 0.7, 11, 1.1, 0.5); drawSigns(c, s); drawTiles(c, s); drawThings(c, s); drawMarkers(c, s); if (R.fx) drawLights(c, s); drawEnemies(c, s);
  for (const g of R.ghosts) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = g.life / 11 * 0.42; drawHero(c, g.pose, '#4fc4ff'); c.restore(); }
  if ((!p.dead || (R.sprite && HERO.ok)) && R.pose) {
    // scarf (line figure only)
    c.save(); c.lineCap = 'round';
    if (!(R.sprite && HERO.ok)) for (let i = 1; i < R.scarf.length; i++) { c.strokeStyle = i < 5 ? COL.scarf : '#d2a8ff'; c.lineWidth = 2.6 - i * 0.24; c.beginPath(); c.moveTo(R.scarf[i - 1].x, R.scarf[i - 1].y); c.lineTo(R.scarf[i].x, R.scarf[i].y); c.stroke(); }
    c.restore();
    c.save(); if (p.inv > 0 && p.stun <= 0 && (R.t >> 1) % 2 === 0) c.globalAlpha = 0.35;
    drawHero(c, R.pose, p.charge >= C.CHARGE_T && (R.t >> 2) % 2 === 0 ? '#ffffff' : null); c.restore();
  }
  for (const a of R.arcs) drawArc(c, a);
  if (R.fx) drawReflections(c, s);
  drawParticles(c);
  if (R.fx) { drawMotes(c, 12, 1.35, 77, 2.6, 0.2); drawRig(c); if (BLOOM.on && typeof document !== 'undefined') drawBloom(c, s); drawFinish(c); }
  if (R.debug) {
    c.lineWidth = 0.6; c.strokeStyle = '#4dff9a'; c.strokeRect(p.x - C.HW, p.y - C.H, C.HW * 2, C.H);
    if (p.atk) { const a = ATK[p.atk.id], b = Z.attackBox(p); c.strokeStyle = p.atk.f >= a.act[0] && p.atk.f <= a.act[1] ? '#ff5a5a' : 'rgba(255,90,90,.35)'; c.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); }
    c.strokeStyle = '#ffd24d'; for (const e of s.enemies) if (!e.dead) c.strokeRect(e.x - e.hw, e.y - e.h, e.hw * 2, e.h);
  }
  drawPost(c, s);
};
G.ZankoRender = R;
})(typeof globalThis !== 'undefined' ? globalThis : this);
