// Headless checks: measured jump numbers, the combo, and a simple auto-runner that must reach the goal.
const Z = require('../js/sim.js'), T = Z.T, C = Z.C;
const none = () => ({ left: false, right: false, jump: false, dash: false, attack: false, interact: false });
function run(s, n, f) { for (let i = 0; i < n; i++) Z.step(s, f ? f(i) : none()); }

// --- measurements on the flat start area ---
{ const s = Z.create(); s.enemies.length = 0; const y0 = s.p.y; let top = y0, air = 0;
  Z.step(s, { ...none(), jump: true });
  for (let i = 0; i < 200 && (!s.p.ground || i < 2); i++) { Z.step(s, { ...none(), jump: true }); top = Math.min(top, s.p.y); air++; }
  console.log('full jump: height', (y0 - top).toFixed(1), 'px =', ((y0 - top) / T).toFixed(2), 'tiles, air', air, 'steps'); }
{ const s = Z.create(); s.enemies.length = 0; const y0 = s.p.y; let top = y0;
  Z.step(s, { ...none(), jump: true }); run(s, 3, () => ({ ...none(), jump: true }));
  for (let i = 0; i < 200 && !s.p.ground; i++) { Z.step(s, none()); top = Math.min(top, s.p.y); }
  console.log('tap jump (4 steps): height', (y0 - top).toFixed(1), 'px'); }
for (const dash of [false, true]) { const s = Z.create(); s.enemies.length = 0;
  if (dash) { Z.step(s, { ...none(), right: true, dash: true }); run(s, 4, () => ({ ...none(), right: true, dash: true })); }
  const x0 = s.p.x; Z.step(s, { ...none(), right: true, dash, jump: true });
  for (let i = 0; i < 200 && (!s.p.ground || i < 2); i++) Z.step(s, { ...none(), right: true, dash, jump: true });
  console.log(dash ? 'dash jump' : 'plain jump', 'distance', (s.p.x - x0).toFixed(1), 'px =', ((s.p.x - x0) / T).toFixed(2), 'tiles'); }
{ const s = Z.create(); const d = s.enemies[0]; s.p.x = d.x - 22; const log = []; let n = 0;
  for (let i = 0; i < 120; i++) { Z.step(s, { ...none(), attack: i % 9 < 2 }); for (const e of s.events) if (e.t === 'slash') log.push(e.id + '@' + i); else if (e.t === 'hit') n++; s.events.length = 0; }
  console.log('mash attack:', log.slice(0, 6).join(' '), '| hits', n, '| dummy hp', d.hp, d.dead ? '(destroyed)' : ''); }
{ const s = Z.create(); const d = s.enemies[0]; s.p.x = d.x - 24; let id = null;
  for (let i = 0; i < 90; i++) { Z.step(s, { ...none(), attack: i < 55 }); for (const e of s.events) if (e.t === 'slash') id = e.id + '@' + i; s.events.length = 0; }
  console.log('hold 55 steps then release ->', id, '| dummy hp', d.hp); }

// --- auto-runner: hold right, dash whenever possible, jump at edges and walls, kick off any wall, slash what is close ---
function bot(s) {
  const p = s.p, L = s.L, f = s.frame, inp = { left: false, right: true, jump: false, dash: false, attack: false, interact: false };
  if (s.near && s.near.type !== 'term') { inp.right = false; inp.interact = f % 2 === 0; return inp; }   // operate switches and capsules on the way
  const feet = p.y + 4;
  const ahead = d => Z.tile(L, p.x + d, feet) === 1 && Z.tile(L, p.x + d, p.y - 2) !== 2;
  const enemyNear = s.enemies.some(e => !e.dead && e.type !== 'dummy' && Math.abs(e.y - p.y) < 40 && e.x - p.x > -10 && e.x - p.x < 46);
  if (p.ground) {
    inp.dash = p.dashT > 0 || f % 2 === 0;                 // re-press as soon as a dash runs out
    const lead = p.dashT > 0 ? 12 : 8;
    const edge = !ahead(lead), wallAhead = Z.tile(L, p.x + C.HW + 3, p.y - 10) === 1;
    if (enemyNear) { inp.dash = false; inp.right = false; inp.attack = f % 8 < 4; }
    else if (edge || wallAhead) inp.jump = true;
  } else {
    inp.dash = true;
    inp.jump = p.vy < 0 || (p.wall !== 0 && f % 2 === 0);  // hold while rising; tap to kick when touching a wall
    if (p.wall !== 0 && p.vy >= 0) inp.jump = f % 2 === 0;
    inp.attack = enemyNear && f % 8 < 4;
  }
  return inp;
}
{ const s = Z.create(); let maxX = 0, lastProgress = 0; const marks = [];
  for (let i = 0; i < 60 * 240 && !s.cleared; i++) {
    Z.step(s, bot(s)); for (const e of s.events) if (e.t === 'check' || e.t === 'die') marks.push(e.t + '@' + (s.time / 60).toFixed(1) + 's x=' + Math.round(e.x / T)); s.events.length = 0;
    if (s.p.x > maxX + 1) { maxX = s.p.x; lastProgress = i; }
    if (i - lastProgress > 60 * 25) { console.log('STUCK at col', (s.p.x / T).toFixed(1), 'row', (s.p.y / T).toFixed(1), 'ground', s.p.ground, 'wall', s.p.wall); break; }
  }
  console.log('bot:', s.cleared ? 'CLEARED' : 'NOT CLEARED', 'time', (s.time / 60).toFixed(1) + 's', 'deaths', s.deaths, '| furthest col', (maxX / T).toFixed(1));
  console.log(marks.join(' | '));
  if (!s.cleared) process.exit(1); }

// --- assists ---
{ const s = Z.create(); s.enemies.length = 0;      // dash, let go, jump 12 steps later: still a dash jump
  Z.step(s, { ...none(), right: true, dash: true }); run(s, 8, () => ({ ...none(), right: true, dash: true })); run(s, 12, () => ({ ...none(), right: true }));
  Z.step(s, { ...none(), right: true, jump: true }); console.log('jump 12 steps after releasing dash -> airFast', s.p.airFast); if (!s.p.airFast) process.exit(1); }
{ const s = Z.create(); s.enemies.length = 0; s.p.x = 60 * T; let kicks = 0, fast = 0;   // dash jump into the plateau wall, then tap jump only
  Z.step(s, { ...none(), right: true, dash: true }); run(s, 3, () => ({ ...none(), right: true, dash: true })); Z.step(s, { ...none(), right: true, dash: true, jump: true });
  for (let i = 0; i < 200 && s.p.y > 17 * T + 1; i++) { Z.step(s, { ...none(), right: true, jump: s.p.vy < 0 || (s.p.wall !== 0 && i % 2 === 0) }); for (const e of s.events) if (e.t === 'kick') { kicks++; if (s.p.airFast) fast++; } s.events.length = 0; }
  console.log('wall kicks without holding dash:', kicks, 'of which at dash speed:', fast, '| reached top:', s.p.y <= 17 * T + 1); if (fast !== kicks || !kicks) process.exit(1); }
{ const s = Z.create(); s.enemies.length = 0; Z.step(s, { ...none(), jump: true }); let started = false;   // dash pressed just before landing
  let down = false; for (let i = 0; i < 80; i++) { if (!s.p.ground && s.p.vy > 0 && s.p.y > 416 - 12) down = true; Z.step(s, { ...none(), right: true, jump: i < 10, dash: down }); if (s.p.dashT > 0) started = true; }
  console.log('dash buffered before landing ->', started); if (!started) process.exit(1); }

// --- interaction ---
{ const s = Z.create(); const th = s.things.find(q => q.type === 'term'); s.p.x = th.x - 10; let talk = null;
  run(s, 3); Z.step(s, { ...none(), interact: true }); for (let i = 0; i < 20; i++) { Z.step(s, { ...none(), right: true, jump: i === 2 }); for (const e of s.events) if (e.t === 'talk') talk = e.thing.title; s.events.length = 0; if (i === 4) console.log('terminal: during the motion vx', s.p.vx, 'ground', s.p.ground); }
  console.log('terminal ->', talk); if (!talk) process.exit(1); }
{ const s = Z.create(); const sw = s.things.find(q => q.type === 'switch'), g = s.L.gates[0]; s.enemies.length = 0; s.p.x = sw.x + 6; s.p.y = sw.y;
  const before = Z.tile(s.L, g.col * T + 8, g.r1 * T + 8); run(s, 3); Z.step(s, { ...none(), interact: true }); run(s, 20);
  console.log('switch: gate tile', before, '->', Z.tile(s.L, g.col * T + 8, g.r1 * T + 8), 'used', sw.used, '| can be used again:', s.near === sw); if (before !== 1 || Z.tile(s.L, g.col * T + 8, g.r1 * T + 8) !== 0) process.exit(1); }
{ const s = Z.create(); const g = s.L.gates[0]; s.enemies.length = 0; s.p.x = 137 * T; s.p.y = 10 * T; let maxX = 0;     // the closed gate cannot be passed or climbed over
  for (let i = 0; i < 600; i++) { Z.step(s, { ...none(), right: true, dash: true, jump: s.p.vy < 0 || i % 3 === 0 }); maxX = Math.max(maxX, s.p.x); }
  console.log('closed gate: furthest x', maxX.toFixed(1), '(gate face at', g.col * T + ')'); if (maxX > g.col * T) process.exit(1); }

// --- air dash ---
{ const s = Z.create(); s.enemies.length = 0; const x0 = s.p.x; let n = 0, yDuring = [];
  Z.step(s, { ...none(), right: true, jump: true }); run(s, 14, () => ({ ...none(), right: true, jump: true }));
  const xa = s.p.x; Z.step(s, { ...none(), right: true, dash: true }); for (let i = 0; i < 17; i++) { Z.step(s, { ...none(), right: true }); if (i < 16) yDuring.push(s.p.y); }
  const level = Math.max(...yDuring) - Math.min(...yDuring) < 0.01, dist = s.p.x - xa;
  Z.step(s, { ...none(), right: true, dash: false }); Z.step(s, { ...none(), right: true, dash: true }); const second = s.p.airDashT > 0;
  for (let i = 0; i < 200 && !s.p.ground; i++) Z.step(s, { ...none(), right: true });
  console.log('air dash: travelled', dist.toFixed(1), 'px, level:', level, '| second one in the same jump:', second, '| total jump distance', (s.p.x - x0).toFixed(1), 'px (plain jump 58.5)', '| restored on landing:', s.p.airDashOK);
  if (!level || second || !s.p.airDashOK || dist < 55) process.exit(1); }
{ const s = Z.create(); s.enemies.length = 0; s.p.x = 20 * T; Z.step(s, { ...none(), right: true, dash: true }); run(s, 20, () => ({ ...none(), right: true, dash: true }));
  console.log('dash pressed on the ground does not use up the air dash:', s.p.airDashOK && s.p.airDashT === 0); if (!s.p.airDashOK) process.exit(1); }
