// 残光 ZANKO — drawing. Everything on screen is drawn by code (no image files): the hero is a small
// jointed figure posed from the rules' state, so it can be swapped for sprites later without touching sim.js.
(function (G) {
'use strict';
const Z = G.ZankoSim, T = Z.T, C = Z.C, ATK = Z.ATK;
const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const COL = { blade: '#9ff6ff', glow: 'rgba(80,215,255,', scarf: '#b06cff', armor: '#e4ecf8', armorBack: '#8e9bb4', joint: '#27344d', visor: '#6ff0ff', foe: '#ffb84d', danger: '#ff4d7a' };

// Saber sweep per move: start angle, end angle (0 = forward, negative = up), reach.
const SWEEP = { s1: [-2.2, 0.95, 31], s2: [1.25, -1.95, 34], s3: [-2.75, 1.3, 43], air: [-2.45, 1.35, 37], dash: [-1.0, 0.6, 43], wall: [-2.2, 1.0, 33], charge: [-3.05, 1.5, 53] };

const R = { ctx: null, VW: 426, VH: 240, K: 1, css: 1, cam: { x: 0, y: 0 }, shake: 0, parts: [], arcs: [], ghosts: [], scarf: [], phase: 0, lastX: 0, t: 0, debug: false, pose: null };

R.reset = function (s) {
  R.parts.length = R.arcs.length = R.ghosts.length = 0; R.scarf.length = 0; R.shake = 0; R.lastX = s.p.x;
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
  if (kind === 'run') R.phase += Math.abs(moved) / 24 * TAU; else if (kind !== 'dash') R.phase = 0;   // feet advance with distance: no sliding
  const pose = { x: p.x, y: p.y, face: p.face, kind, phase: R.phase, t: R.t, vy: p.vy, atk: p.atk ? { id: p.atk.id, f: p.atk.f } : null, charge: p.charge, inv: p.inv, use: p.act ? p.act.f : 0 };
  R.pose = pose;
  // saber trail: follow the live sweep, then let it fade where it ended
  const live = R.arcs.find(a => a.live);
  if (p.atk && p.atk.f >= ATK[p.atk.id].act[0] - 1) {
    const sw = sweepAngle(p.atk);
    if (live && live.key === p.atk) { live.to = sw.ang; }
    else { if (live) live.live = false; R.arcs.push({ key: p.atk, live: true, x: p.x, y: p.y, face: p.face, from: sw.from, to: sw.ang, reach: sw.reach, heavy: !!ATK[p.atk.id].heavy, fade: 0, sx: 1.2, sy: -22 }); }
    const cur = R.arcs[R.arcs.length - 1], sk = skeleton(pose); cur.x = p.x; cur.y = p.y; cur.face = p.face; cur.sx = sk.sh[0]; cur.sy = sk.sh[1];
    if (p.atk.f > ATK[p.atk.id].act[1]) cur.live = false;
  } else if (live) live.live = false;
  for (let i = R.arcs.length - 1; i >= 0; i--) { const a = R.arcs[i]; if (!a.live && ++a.fade > 9) R.arcs.splice(i, 1); }
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
    case 'hit': sparks(e.x, e.y, e.heavy ? 16 : 9, e.heavy ? 3.6 : 2.6, COL.blade, e.face); R.parts.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: e.heavy ? 9 : 6, max: e.heavy ? 9 : 6, size: e.heavy ? 20 : 13, color: '#ffffff', add: true, star: true, rot: Math.random() * 1.5 }); R.shake = Math.max(R.shake, e.heavy ? 4.5 : 1.6); break;
    case 'kill': sparks(e.x, e.y, 22, 3.2, COL.foe); R.parts.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 14, max: 14, size: 26, color: COL.foe, add: true, ring: true }); R.shake = Math.max(R.shake, 3); break;
    case 'cut': sparks(e.x, e.y, 7, 2, COL.foe); break;
    case 'hurt': sparks(e.x, e.y, 10, 2.4, COL.danger); R.shake = Math.max(R.shake, 3.5); break;
    case 'die': sparks(e.x, e.y, 30, 3.5, COL.blade); R.parts.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 22, max: 22, size: 46, color: COL.blade, add: true, ring: true }); R.shake = 6; break;
    case 'charged': R.parts.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 12, max: 12, size: 24, color: '#ffffff', add: true, ring: true, home: true }); break;
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
function drawHero(c, h, ghost) {
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
  c.save(); c.globalCompositeOperation = 'lighter'; c.shadowColor = 'rgba(80,215,255,.8)'; c.shadowBlur = (a.heavy ? 7 : 5) * R.K;
  shape(a.heavy ? 0.46 : 0.36, COL.glow + (0.34 * k) + ')');
  c.shadowBlur = 0; shape(a.heavy ? 0.13 : 0.09, 'rgba(235,252,255,' + (0.85 * k) + ')');
  c.restore();
}

// ---- world ----
function hash(n) { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); }
function drawBackdrop(c, s) {
  const g = c.createLinearGradient(0, R.cam.y, 0, R.cam.y + R.VH); g.addColorStop(0, '#0b1324'); g.addColorStop(0.6, '#0a1020'); g.addColorStop(1, '#060a14');
  c.fillStyle = g; c.fillRect(R.cam.x - 2, R.cam.y - 2, R.VW + 4, R.VH + 4);
  for (const [par, w, col, lit] of [[0.2, 46, '#0d172b', 'rgba(95,216,255,.10)'], [0.45, 30, '#101c33', 'rgba(176,108,255,.13)']]) {
    const ox = R.cam.x * (1 - par), oy = R.cam.y * (1 - par) * 0.6, gap = w * 3.2, i0 = Math.floor((R.cam.x - ox) / gap) - 1, i1 = i0 + Math.ceil(R.VW / gap) + 2;
    for (let i = i0; i <= i1; i++) {
      const x = ox + i * gap + hash(i + w) * gap * 0.4, top = R.cam.y + oy * 0.2 + 20 + hash(i * 3 + w) * 120;
      c.fillStyle = col; c.fillRect(x, top, w, R.VH + 300);
      c.fillStyle = lit; c.fillRect(x + w * 0.2, top + 8, 1.2, R.VH + 300); c.fillRect(x + 4, top, w - 8, 1);
    }
  }
}
function drawTiles(c, s) {
  const L = s.L, i0 = Math.max(0, Math.floor(R.cam.x / T)), i1 = Math.min(L.W - 1, Math.floor((R.cam.x + R.VW) / T)), j0 = Math.max(0, Math.floor(R.cam.y / T)), j1 = Math.min(L.H - 1, Math.floor((R.cam.y + R.VH) / T));
  const at = (i, j) => (i < 0 || i >= L.W) ? 1 : (j < 0 || j >= L.H) ? (j < 0 ? 0 : 1) : L.t[j * L.W + i];
  c.fillStyle = '#131f33';
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (at(i, j) === 1) c.fillRect(i * T, j * T, T + 0.3, T + 0.3);
  c.fillStyle = 'rgba(150,185,230,.05)';
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (at(i, j) === 1) { if ((i + j) % 2 === 0) c.fillRect(i * T + 1, j * T + 1, T - 2, T - 2); }
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const v = at(i, j);
    if (v === 1) {
      if (at(i, j - 1) !== 1) { c.fillStyle = 'rgba(95,216,255,.16)'; c.fillRect(i * T, j * T, T, 3.2); c.fillStyle = '#7fe3ff'; c.fillRect(i * T, j * T, T, 0.9); }
      if (at(i - 1, j) !== 1) { c.fillStyle = 'rgba(140,190,255,.38)'; c.fillRect(i * T, j * T, 0.7, T); }
      if (at(i + 1, j) !== 1) { c.fillStyle = 'rgba(140,190,255,.38)'; c.fillRect(i * T + T - 0.7, j * T, 0.7, T); }
      if (at(i, j + 1) !== 1) { c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(i * T, j * T + T - 1.5, T, 1.5); }
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
function drawMarkers(c, s) {
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
      c.fillStyle = '#1d2c47'; c.fillRect(x + 2, y0, T - 4, h); c.fillStyle = 'rgba(255,184,77,.85)';
      for (let k = 0; k < h; k += 12) { c.beginPath(); c.moveTo(x + 2, y0 + k + 8); c.lineTo(x + T - 2, y0 + k + 2); c.lineTo(x + T - 2, y0 + k + 5); c.lineTo(x + 2, y0 + k + 11); c.fill(); }
      c.strokeStyle = g.open ? COL.blade : COL.foe; c.lineWidth = 0.8; c.strokeRect(x + 2, y0, T - 4, h); c.restore();
    }
    c.fillStyle = g.open ? COL.blade : COL.foe; c.fillRect(x - 1, y0 - 2.5, T + 2, 1.5);
  }
  for (const th of s.things) {
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
function drawEnemies(c, s) {
  for (const e of s.enemies) {
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
function drawParticles(c) {
  for (const q of R.parts) {
    const k = q.life / q.max;
    c.save(); if (q.add) c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, k * (q.puff ? 0.5 : 1.3));
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
  drawBackdrop(c, s); drawSigns(c, s); drawTiles(c, s); drawThings(c, s); drawMarkers(c, s); drawEnemies(c, s);
  for (const g of R.ghosts) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = g.life / 11 * 0.42; drawHero(c, g.pose, '#4fc4ff'); c.restore(); }
  if (!p.dead && R.pose) {
    // scarf
    c.save(); c.lineCap = 'round';
    for (let i = 1; i < R.scarf.length; i++) { c.strokeStyle = i < 5 ? COL.scarf : '#d2a8ff'; c.lineWidth = 2.6 - i * 0.24; c.beginPath(); c.moveTo(R.scarf[i - 1].x, R.scarf[i - 1].y); c.lineTo(R.scarf[i].x, R.scarf[i].y); c.stroke(); }
    c.restore();
    c.save(); if (p.inv > 0 && p.stun <= 0 && (R.t >> 1) % 2 === 0) c.globalAlpha = 0.35;
    drawHero(c, R.pose, p.charge >= C.CHARGE_T && (R.t >> 2) % 2 === 0 ? '#ffffff' : null); c.restore();
  }
  for (const a of R.arcs) drawArc(c, a);
  drawParticles(c);
  if (R.debug) {
    c.lineWidth = 0.6; c.strokeStyle = '#4dff9a'; c.strokeRect(p.x - C.HW, p.y - C.H, C.HW * 2, C.H);
    if (p.atk) { const a = ATK[p.atk.id], b = Z.attackBox(p); c.strokeStyle = p.atk.f >= a.act[0] && p.atk.f <= a.act[1] ? '#ff5a5a' : 'rgba(255,90,90,.35)'; c.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); }
    c.strokeStyle = '#ffd24d'; for (const e of s.enemies) if (!e.dead) c.strokeRect(e.x - e.hw, e.y - e.h, e.hw * 2, e.h);
  }
};
G.ZankoRender = R;
})(typeof globalThis !== 'undefined' ? globalThis : this);
