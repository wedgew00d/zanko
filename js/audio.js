// 残光 ZANKO — sound. Everything is synthesized with Web Audio: no audio files.
// Every function that makes sound takes the graph (and so the audio context) as an argument, so the very same code
// can be rendered in an OfflineAudioContext and measured (test/audio.js). Nobody can listen during development:
// loudness is set by measuring, against levels that were judged comfortable in earlier games.
//
// Music: an original piece. Direction only: a driving 16th-note bass and a lead line (GBA-era action games), electronic
// drums kept light, and an organ-like pad with a repeating high figure. No existing melody or progression is quoted.
// Nothing sustained sits below 110 Hz and the whole output passes an 85 Hz high-pass: no heavy sub bass.
(function (G) {
'use strict';
const BPM = 140, S16 = 60 / BPM / 4, LOOP_BARS = 32;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const LEVEL = { bgm: 0.044, se: 0.6 };                          // bus gains at the default sliders (BGM 50, SE 60); set by measuring

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function build(ctx) {
  const g = { ctx };
  g.out = ctx.createGain();
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 85; hp.Q.value = 0.7;
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -8; lim.knee.value = 6; lim.ratio.value = 8; lim.attack.value = 0.003; lim.release.value = 0.12;
  g.out.connect(hp); hp.connect(lim); lim.connect(ctx.destination);
  g.bgm = ctx.createGain(); g.se = ctx.createGain(); g.bgm.gain.value = LEVEL.bgm; g.se.gain.value = LEVEL.se; g.bgm.connect(g.out); g.se.connect(g.out);
  g.calm = ctx.createGain(); g.drive = ctx.createGain(); g.drive.gain.value = 0; g.calm.connect(g.bgm); g.drive.connect(g.bgm);   // calm: pad and high figure (always). drive: bass, drums, lead (while playing)
  // one short room for each bus. The returns enter before the bus gain, so the volume sliders also turn the reverb down.
  const r = rng(7), len = Math.floor(ctx.sampleRate * 1.3), ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
  const room = (dest, gain) => { const cv = ctx.createConvolver(); cv.buffer = ir; const ret = ctx.createGain(); ret.gain.value = gain; cv.connect(ret); ret.connect(dest); return cv; };
  g.bgmWet = room(g.bgm, 0.5); g.seWet = room(g.se, 0.35);
  const r2 = rng(11); g.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); { const d = g.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = r2() * 2 - 1; }
  return g;
}

// ---- voices ----
function osc(g, dest, type, f0, f1, t, dur, vol, atk, wet) {
  const c = g.ctx, o = c.createOscillator(), a = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  a.gain.setValueAtTime(0.0001, t); a.gain.linearRampToValueAtTime(vol, t + (atk || 0.004)); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(a); a.connect(dest); if (wet) a.connect(wet); o.start(t); o.stop(t + dur + 0.03);
}
function nz(g, dest, ftype, f0, f1, t, dur, vol, q, atk, wet) {
  const c = g.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), a = c.createGain(); s.buffer = g.noise; s.loop = true;
  f.type = ftype; f.Q.value = q || 1; f.frequency.setValueAtTime(f0, t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  a.gain.setValueAtTime(0.0001, t); a.gain.linearRampToValueAtTime(vol, t + (atk || 0.002)); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(a); a.connect(dest); if (wet) a.connect(wet); s.start(t, (t * 0.37) % 0.9); s.stop(t + dur + 0.03);
}

// ---- effects ----
// e: the event from the rules (sim.js). t: when. Each returns nothing; all sound goes to the SE bus.
function sfx(g, e, t) {
  const d = g.se, w = g.seWet, O = (type, f0, f1, dur, vol, dly, atk, wet) => osc(g, d, type, f0, f1, t + (dly || 0), dur, vol, atk, wet ? w : null), N = (ft, f0, f1, dur, vol, q, dly, atk, wet) => nz(g, d, ft, f0, f1, t + (dly || 0), dur, vol, q, atk, wet ? w : null);
  switch (e.t) {
    case 'slash': {
      // an energy blade: a bright swish that falls in pitch, a short buzzing body, and a thin ring on top
      const id = e.id, big = id === 's3' || id === 'air' || id === 'dash', up = id === 's2' || id === 'wall' ? 1.18 : 1;
      if (id === 'charge') {
        N('bandpass', 6200, 320, 0.36, 0.5, 0.9, 0, 0.004, true); O('sawtooth', 900, 110, 0.32, 0.13); O('triangle', 260, 90, 0.3, 0.3); O('sine', 2600, 1500, 0.34, 0.05, 0.02, 0.01, true); N('highpass', 5000, 7000, 0.12, 0.12, 0.7, 0.05);
      } else {
        N('bandpass', (big ? 4600 : 5400) * up, (big ? 700 : 1300) * up, big ? 0.17 : 0.11, big ? 0.42 : 0.34, 1.1, 0, 0.003, big);
        O('sawtooth', (big ? 1100 : 1500) * up, (big ? 300 : 460) * up, big ? 0.13 : 0.085, 0.055); O('sine', 3300 * up, 2300 * up, 0.12, 0.035, 0.01);
        if (big) O('triangle', 210, 95, 0.13, 0.2);
      }
      break; }
    case 'hit': {
      const h = e.heavy; N('bandpass', h ? 2000 : 2700, h ? 420 : 800, h ? 0.11 : 0.07, h ? 0.5 : 0.42, 0.8); O('square', h ? 190 : 250, h ? 90 : 120, h ? 0.12 : 0.07, h ? 0.2 : 0.15); O('sine', 3200, 1500, 0.035, 0.09);
      if (h) N('lowpass', 900, 200, 0.16, 0.25, 0.7, 0.01, 0.004, true);
      break; }
    case 'kill': N('lowpass', 1500, 160, 0.42, 0.55, 0.7, 0, 0.004, true); O('triangle', 190, 90, 0.34, 0.3); O('square', 420, 110, 0.16, 0.1);
      for (let i = 0; i < 3; i++) N('bandpass', 2600 - i * 500, 900, 0.06, 0.2, 1.4, 0.07 + i * 0.07); break;
    case 'cut': O('sine', 1900, 1750, 0.11, 0.1, 0, 0.002, true); O('sine', 2850, 2700, 0.09, 0.07); N('highpass', 5200, 5200, 0.03, 0.14, 0.7); break;
    case 'jump': O('triangle', 310, 540, 0.075, 0.13); N('bandpass', 900, 2000, 0.06, 0.07, 0.9); break;
    case 'kick': N('bandpass', 1700, 600, 0.05, 0.26, 0.9); O('triangle', 250, 440, 0.07, 0.17); break;
    case 'dash': N('bandpass', 480, 2700, 0.2, 0.36, 0.8, 0, 0.012); O('sine', 190, 95, 0.08, 0.22); O('sawtooth', 190, 430, 0.16, 0.035); break;
    case 'airdash': N('bandpass', 900, 4300, 0.19, 0.34, 0.9, 0, 0.01, true); O('sine', 720, 1350, 0.1, 0.07); O('sine', 210, 100, 0.07, 0.16); break;
    case 'land': O('sine', 150, 90, 0.06, 0.22); N('lowpass', 600, 220, 0.05, 0.14, 0.7); break;
    case 'hurt': O('sawtooth', 400, 95, 0.22, 0.2); N('bandpass', 1900, 420, 0.13, 0.32, 0.8); O('square', 130, 100, 0.1, 0.14); break;
    case 'die': O('sawtooth', 520, 90, 0.7, 0.22); N('lowpass', 1800, 140, 0.6, 0.45, 0.7, 0, 0.004, true);
      for (let i = 0; i < 5; i++) { N('bandpass', 2400 - i * 300, 700, 0.07, 0.24, 1.2, 0.05 + i * 0.1); O('square', 300 - i * 30, 110, 0.07, 0.1, 0.05 + i * 0.1); } break;
    case 'charged': O('sine', 880, 1320, 0.14, 0.2); O('sine', 1320, 1980, 0.16, 0.13, 0.05); O('sine', 2640, 2640, 0.22, 0.06, 0.1, 0.004, true); N('highpass', 6000, 6000, 0.1, 0.05, 0.7, 0.05); break;
    case 'check': O('sine', 784, 784, 0.16, 0.17, 0, 0.004, true); O('sine', 1175, 1175, 0.3, 0.17, 0.11, 0.004, true); break;
    case 'shot': O('square', 950, 230, 0.12, 0.085); N('bandpass', 3200, 1100, 0.05, 0.1, 1.2); O('sine', 1900, 500, 0.08, 0.05); break;
    case 'comm': O('sine', 1320, 1320, 0.07, 0.16); O('sine', 1760, 1760, 0.12, 0.16, 0.08, 0.004, true); N('highpass', 6000, 6000, 0.03, 0.05, 0.7); break;   // incoming line: two rising notes
    case 'talk': O('sine', 880, 1100, 0.07, 0.15); break;
    case 'type': O('square', 1500, 1500, 0.014, 0.03); break;
    case 'page': O('sine', 700, 700, 0.05, 0.11); break;
    case 'heal': [659, 880, 1319, 1760].forEach((f, i) => O('sine', f, f, 0.2, 0.14, i * 0.06, 0.004, true)); break;
    case 'switch': O('square', 170, 95, 0.1, 0.2); N('lowpass', 320, 110, 0.55, 0.4, 0.7, 0.03, 0.02); O('sawtooth', 120, 230, 0.5, 0.05, 0.03, 0.05); N('bandpass', 2400, 2400, 0.03, 0.18, 2, 0.56); break;
    case 'clear': [587, 740, 880, 1175, 1480].forEach((f, i) => O('triangle', f, f, 0.34, 0.2, i * 0.1, 0.004, true)); O('sine', 294, 294, 1.1, 0.12, 0.5, 0.05, true); O('sine', 440, 440, 1.1, 0.1, 0.5, 0.05, true); break;
    case 'respawn': O('sine', 320, 1250, 0.26, 0.1, 0, 0.02, true); N('bandpass', 800, 3600, 0.24, 0.12, 1); break;
  }
}
const GAP = { slash: 0.05, hit: 0.035, shot: 0.05, cut: 0.04, land: 0.06 };   // shortest spacing between two of the same kind (seconds)

// ---- music ----
// 32 bars of 4/4, 16 steps a bar. Chords change every 2 bars. Bars 0-15: pad, high figure, bass, light drums. Bars 16-31: the lead joins, full drums.
const CH = [[62, 65, 69], [58, 62, 65], [53, 57, 60], [60, 64, 67], [62, 65, 69], [58, 62, 65], [55, 58, 62], [57, 61, 64]];   // Dm Bb F C Dm Bb Gm A
const BASS = [50, 46, 53, 48, 50, 46, 55, 45];               // roots between A2 (110 Hz) and G3
const BASS_ON = [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1], FIG = [0, 2, 1, 2, 0, 2, 1, 2];
const LEAD = [
  [[0, 6, 74], [6, 6, 77], [12, 4, 76]], [[0, 8, 74], [8, 4, 72], [12, 4, 69]], [[0, 6, 70], [6, 6, 74], [12, 4, 77]], [[0, 12, 77], [12, 4, 79]],
  [[0, 6, 81], [6, 6, 79], [12, 4, 77]], [[0, 8, 72], [8, 8, 77]], [[0, 6, 76], [6, 6, 79], [12, 4, 76]], [[0, 12, 72], [12, 4, 74]],
  [[0, 6, 74], [6, 6, 77], [12, 4, 81]], [[0, 8, 82], [8, 4, 81], [12, 4, 77]], [[0, 6, 82], [6, 6, 81], [12, 4, 77]], [[0, 12, 74], [12, 4, 77]],
  [[0, 6, 79], [6, 6, 82], [12, 4, 79]], [[0, 8, 74], [8, 8, 79]], [[0, 6, 76], [6, 6, 73], [12, 4, 76]], [[0, 12, 81]]];
function organ(g, t, dur, midi, vol) {                         // sine partials: soft, no buzz. Slow in, slow out
  const c = g.ctx, a = c.createGain(), f = mtof(midi); a.gain.setValueAtTime(0.0001, t); a.gain.linearRampToValueAtTime(vol, t + 0.5); a.gain.setValueAtTime(vol, t + dur - 0.1); a.gain.linearRampToValueAtTime(0.0001, t + dur + 0.7);
  [[1, 1], [2, 0.42], [3, 0.2], [4, 0.1]].forEach(([m, k]) => { const o = c.createOscillator(), p = c.createGain(); o.frequency.value = f * m * (1 + (m - 1) * 0.0007); p.gain.value = k; o.connect(p); p.connect(a); o.start(t); o.stop(t + dur + 0.8); });
  a.connect(g.calm); a.connect(g.bgmWet);
}
function pluck(g, dest, t, dur, midi, vol, cut, wet) {          // saw through a closing low-pass: the bass and the lead
  const c = g.ctx, a = c.createGain(), f = c.createBiquadFilter(), fr = mtof(midi); f.type = 'lowpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(cut, t); f.frequency.exponentialRampToValueAtTime(Math.max(200, cut * 0.35), t + dur);
  a.gain.setValueAtTime(0.0001, t); a.gain.linearRampToValueAtTime(vol, t + 0.008); a.gain.setValueAtTime(vol, t + Math.max(0.01, dur - 0.05)); a.gain.linearRampToValueAtTime(0.0001, t + dur);
  [-5, 5].forEach(ct => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = ct; o.connect(f); o.start(t); o.stop(t + dur + 0.02); });
  f.connect(a); a.connect(dest); if (wet) a.connect(g.bgmWet);
}
function musicStep(g, s, t) {                                  // s: step counted from the start of the piece
  const bar = Math.floor(s / 16) % LOOP_BARS, st = s % 16, ci = (bar >> 1) % 8, ch = CH[ci], full = bar >= 16;
  if (st === 0 && bar % 2 === 0) { organ(g, t, 32 * S16, ch[0] - 12 < 45 ? ch[0] : ch[0] - 12, 0.075); organ(g, t, 32 * S16, ch[1], 0.06); organ(g, t, 32 * S16, ch[2], 0.06); }
  if (st % 2 === 0) {                                          // high figure in 8ths; it comes and goes over the 32 bars
    const swell = 0.55 + 0.45 * Math.sin((bar * 16 + st) / (LOOP_BARS * 16) * Math.PI * 2 - 1.2), n = ch[FIG[st / 2]] + 24;
    osc(g, g.calm, 'sine', mtof(n), mtof(n), t, 0.22, 0.085 * swell, 0.006, g.bgmWet); osc(g, g.calm, 'triangle', mtof(n - 12), mtof(n - 12), t, 0.16, 0.03 * swell, 0.006);
  }
  if (BASS_ON[st]) pluck(g, g.drive, t, S16 * 0.92, BASS[ci] + (st === 7 || st === 15 ? 12 : 0), 0.2, 1100);
  // drums: a short kick that starts at 150 Hz, noise snare, noise hats. Kept behind the bass and the effects
  const kick = st === 0 || st === 10 || (full && st === 7 && bar % 2 === 1), snare = full ? (st === 4 || st === 12 || (bar === LOOP_BARS - 1 && st > 12)) : st === 12 && bar % 4 === 3;
  if (kick) { osc(g, g.drive, 'sine', 160, 100, t, 0.1, 0.38, 0.002); nz(g, g.drive, 'lowpass', 1200, 300, t, 0.03, 0.12, 0.7); }
  if (snare) { nz(g, g.drive, 'bandpass', 1900, 1500, t, 0.12, 0.3, 0.7, 0.002, g.bgmWet); osc(g, g.drive, 'triangle', 240, 170, t, 0.07, 0.13); }
  if (st % 2 === 0 || full) nz(g, g.drive, 'highpass', 7200, 7200, t, st === 14 ? 0.11 : 0.035, (st % 4 === 2 ? 0.1 : 0.055) * (st % 2 ? 0.6 : 1), 0.7);
  if (full) for (const [at, len, m] of LEAD[bar - 16]) if (at === st) pluck(g, g.drive, t, len * S16 * 0.94, m, 0.085, 3200, true);
}
function music(g, t0, t1) { for (let s = Math.max(0, Math.ceil(t0 / S16 - 1e-6)); s * S16 < t1; s++) musicStep(g, s, s * S16); }   // for offline rendering: the piece starts at time 0

// ---- the live player ----
const A = { g: null, vol: { bgm: 50, se: 60 }, step: 0, tNext: 0, timer: null, last: {}, play: false };
try { const v = JSON.parse(localStorage.getItem('zanko.vol') || 'null'); if (v && isFinite(v.bgm) && isFinite(v.se)) A.vol = { bgm: Math.max(0, Math.min(100, v.bgm)), se: Math.max(0, Math.min(100, v.se)) }; } catch (_) {}
function applyVol() { if (!A.g) return; const t = A.g.ctx.currentTime; A.g.bgm.gain.setTargetAtTime(LEVEL.bgm * A.vol.bgm / 50, t, 0.03); A.g.se.gain.setTargetAtTime(LEVEL.se * A.vol.se / 60, t, 0.03); }
function tick() {
  const g = A.g; if (!g || g.ctx.state !== 'running') return;
  const now = g.ctx.currentTime; if (A.tNext < now) { A.step += Math.ceil((now - A.tNext) / S16); A.tNext = now + 0.05; }   // fell behind (tab was hidden): skip ahead, never bunch up
  while (A.tNext < now + 1.0) { musicStep(g, A.step, A.tNext); A.step++; A.tNext += S16; }
}
const Api = {
  build, sfx, music, S16, LEVEL,
  get vol() { return A.vol; }, get ready() { return !!A.g; },
  start() {
    if (A.g) { if (A.g.ctx.state === 'suspended') A.g.ctx.resume(); return; }
    try { const ctx = new (G.AudioContext || G.webkitAudioContext)(); A.g = build(ctx); applyVol(); A.step = 0; A.tNext = ctx.currentTime + 0.1; tick(); A.timer = setInterval(tick, 200); } catch (_) { A.g = null; }
  },
  setVol(kind, v) { A.vol[kind] = Math.max(0, Math.min(100, +v || 0)); applyVol(); try { localStorage.setItem('zanko.vol', JSON.stringify(A.vol)); } catch (_) {} },
  setPlay(on) { A.play = on; if (A.g) A.g.drive.gain.setTargetAtTime(on ? 1 : 0, A.g.ctx.currentTime, on ? 0.12 : 0.35); },   // menus: only the pad and the high figure stay
  hidden(h) { if (!A.g) return; if (h) A.g.ctx.suspend(); else A.g.ctx.resume(); },
  event(e) {
    const g = A.g; if (!g || g.ctx.state !== 'running' || A.vol.se <= 0) return;
    const now = g.ctx.currentTime, gap = GAP[e.t] || 0.02; if (now - (A.last[e.t] || -1) < gap) return; A.last[e.t] = now;
    sfx(g, e, now + 0.004);
  },
};
G.ZankoAudio = Api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
