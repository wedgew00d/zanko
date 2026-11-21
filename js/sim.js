// 残光 ZANKO (working title) — rules only. No DOM, no canvas: the browser and the Node tests both load this.
// Units: 1 = one pixel of a 240-row screen, one step = 1/60 s. Speeds are per step.
(function (G) {
'use strict';
const T = 16;

// Feel constants. Starting points are approximate figures for the 16-bit games this imitates;
// they are tuned by play, not claimed to be frame-exact.
const C = {
  WALK: 1.5,        // ground and normal air speed (no acceleration: full speed at once, stop at once)
  DASH: 3.5,        // dash speed, also air speed after a dash jump
  DASH_T: 30,       // longest dash, in steps (ends early when the button is released)
  DASH_GRACE: 14,   // a jump this soon after a dash ends still counts as a dash jump
  DASH_BUF: 8,      // a dash pressed this soon before landing fires on landing
  AIR_DASH: true,   // experimental: one dash per jump in the air (press dash while airborne); a wall kick or landing restores it
  AIR_DASH_T: 18,   // its length in steps; it travels level, with gravity off
  KICK_CARRY: true, // a wall kick made at dash-jump speed keeps that speed without holding dash (assist; off = hold dash, as in the originals)
  JUMP: 5.0,        // launch speed
  GRAV: 0.25,
  FALL_MAX: 5.75,
  JUMP_CUT: 1.0,    // releasing jump while rising clamps upward speed to this
  SLIDE: 1.6,       // wall slide fall speed
  KICK_LOCK: 7,     // steps of forced movement away from the wall after a wall kick
  COYOTE: 4,        // steps after leaving a ledge in which a jump still works
  JUMP_BUF: 6,      // a jump pressed this early still fires on landing
  ATK_BUF: 10,      // same for attack presses (this is what makes the combo forgiving)
  CHARGE_T: 45,     // steps of holding attack for a charged slash
  IFRAMES: 90, STUN: 18, HP: 16,
  HW: 6, H: 28      // player half width and height
};

// Saber moves. len = total steps, act = [first, last] active step, box = [forward offset, top, width, height]
// relative to the feet, chain = first step at which the next combo hit may start.
const ATK = {
  s1:     { len: 15, act: [3, 8],  dmg: 2, box: [2, -32, 36, 32], next: 's2', chain: 7, stop: 3 },
  s2:     { len: 17, act: [3, 9],  dmg: 2, box: [2, -36, 40, 36], next: 's3', chain: 8, stop: 3 },
  s3:     { len: 28, act: [6, 13], dmg: 4, box: [0, -46, 48, 48], stop: 6, heavy: true },
  air:    { len: 16, act: [3, 10], dmg: 2, box: [-2, -38, 40, 44], stop: 3 },
  dash:   { len: 16, act: [2, 10], dmg: 3, box: [4, -24, 46, 24], stop: 3 },
  wall:   { len: 16, act: [3, 10], dmg: 2, box: [2, -36, 38, 36], stop: 3 },
  charge: { len: 34, act: [8, 16], dmg: 8, box: [-4, -54, 58, 58], stop: 8, heavy: true }
};
const ROOTED = { s1: 1, s2: 1, s3: 1, charge: 1 };   // ground moves that stop the feet

const ENEMY = {
  dummy:  { hw: 7,  h: 30, hp: 12, touch: 0 },
  patrol: { hw: 9,  h: 16, hp: 6,  touch: 3, speed: 0.5 },
  heavy:  { hw: 11, h: 30, hp: 36, touch: 4, speed: 0.35 },
  turret: { hw: 8,  h: 18, hp: 8,  touch: 2 }
};

function buildLevel() {
  const W = 162, H = 34, GY = 26, UY = 10, t = new Uint8Array(W * H), ents = [], signs = [], gates = [];
  const rect = (x, y, w, h, v) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (i >= 0 && j >= 0 && i < W && j < H) t[j * W + i] = v; };
  const put = (type, col, row, extra) => ents.push(Object.assign({ type, x: col * T + 8, y: row * T }, extra));
  rect(0, GY, 107, H - GY, 1);          // lower floor
  rect(0, 0, 2, H, 1);                  // left boundary
  rect(28, GY, 3, H - GY, 0);           // gap: a plain jump clears it
  rect(47, GY, 7, H - GY, 0);           // gap: needs a dash jump
  rect(67, GY - 9, 12, 9, 1);           // plateau: climbed by kicking up its face
  rect(88, GY - 1, 3, 1, 2);            // spikes
  rect(101, 4, 3, GY - 7, 1);           // shaft, left wall (a doorway is left open at the bottom)
  rect(107, UY, W - 107, H - UY, 1);    // upper ground; its face is the shaft's right wall
  rect(123, UY, 6, H - UY, 0);          // gap on the upper path
  rect(W - 2, 0, 2, H, 1);              // right boundary
  rect(140, 0, 5, 6, 1);                // gatehouse: the block above the gate, up to the top of the map
  gates.push({ id: 'g1', col: 142, r0: 6, r1: 9, open: false }); rect(142, 6, 1, 4, 1);   // the gate itself, closed
  put('start', 5, GY);
  put('dummy', 14, GY); put('dummy', 20, GY);
  put('patrol', 38, GY, { x0: 33 * T, x1: 45 * T });
  put('check', 57, GY);
  put('turret', 76, GY - 9);
  put('patrol', 83, GY, { x0: 80 * T, x1: 87 * T });
  put('patrol', 95, GY, { x0: 92 * T, x1: 100 * T });
  put('check', 110, UY);
  put('turret', 119, UY);
  put('patrol', 133, UY, { x0: 130 * T, x1: 136 * T });
  put('heavy', 149, UY, { x0: 145 * T, x1: 153 * T });
  // things the player can examine or operate (up / W / E)
  put('term', 11, GY, { title: '記録端末 A-01', pages: ['訓練区画へようこそ。ここでは、移動と剣の基本を確かめられます。', '標的は、壊しても少し待てば元に戻ります。三段斬りと溜め斬りを試してください。'] });
  put('heal', 64, GY);
  put('term', 113, UY, { title: '記録端末 B-07', pages: ['この先の隔壁は閉じています。', '手前の制御盤を操作すると、隔壁が開きます。'] });
  put('switch', 139, UY, { gate: 'g1' });
  put('goal', 156, UY);
  const sign = (col, row, text) => signs.push({ x: col * T, y: row * T, text });
  sign(9, GY, '攻撃を続けて押すと 三段斬り');
  sign(24, GY, 'ジャンプは 長押しで高く');
  sign(42, GY, 'ダッシュ中にジャンプで 遠くへ跳ぶ');
  sign(62, GY, '壁に向かってジャンプで 壁蹴り');
  sign(96, GY, '左右の壁を 交互に蹴って登る');
  sign(114, UY, '攻撃を長押しして離すと 溜め斬り');
  return { W, H, t, ents, signs, gates, GY, UY };
}

function tile(L, px, py) {
  const i = Math.floor(px / T), j = Math.floor(py / T);
  if (i < 0 || i >= L.W) return 1;
  if (j < 0) return 1;
  if (j >= L.H) return 0;
  return L.t[j * L.W + i];
}
function colSolid(L, px, y0, y1) {   // any solid tile on the vertical segment px, y0..y1
  for (let y = y0 + 0.01; y < y1; y += T) if (tile(L, px, y) === 1) return true;
  return tile(L, px, y1 - 0.01) === 1;
}
function rowSolid(L, x0, x1, py) {
  for (let x = x0 + 0.01; x < x1; x += T) if (tile(L, x, py) === 1) return true;
  return tile(L, x1 - 0.01, py) === 1;
}

function spawnEnemies(L) {
  const out = [];
  for (const e of L.ents) {
    const d = ENEMY[e.type]; if (!d) continue;
    out.push({ type: e.type, x: e.x, y: e.y, sx: e.x, x0: e.x0, x1: e.x1, hw: d.hw, h: d.h, hp: d.hp, maxHp: d.hp,
      dir: -1, flash: 0, stun: 0, dead: false, respawn: 0, cool: 60 });
  }
  return out;
}

function create() {
  const L = buildLevel();
  const st = L.ents.find(e => e.type === 'start');
  const s = {
    L, C, ATK, T, frame: 0, time: 0, hitstop: 0, cleared: false, deaths: 0, events: [],
    checks: L.ents.filter(e => e.type === 'check').map(e => ({ x: e.x, y: e.y, on: false })),
    goal: L.ents.find(e => e.type === 'goal'),
    spawn: { x: st.x, y: st.y },
    enemies: spawnEnemies(L), bullets: [],
    things: L.ents.filter(e => THING[e.type]).map(e => ({ type: e.type, x: e.x, y: e.y, used: false, gate: e.gate, title: e.title, pages: e.pages })),
    near: null,           // the thing the player could use right now (for the prompt)
    prev: { jump: false, dash: false, attack: false, interact: false, air: false },
    p: null
  };
  s.p = newPlayer(s.spawn);
  return s;
}
const THING = { term: 1, switch: 1, heal: 1 };
const USE_RANGE = 18, USE_AT = 8, USE_LEN = 16;   // reach, the step at which the effect happens, and the length of the motion
function newPlayer(at) {
  return { x: at.x, y: at.y, vx: 0, vy: 0, face: 1, ground: true, wall: 0, sliding: false,
    dashT: 0, dashRecent: 0, dbuf: 0, airFast: false, airDashT: 0, airDashOK: true, kickT: 0, kickDir: 0, coy: 0, jbuf: 0, abuf: 0,
    atk: null, act: null, charge: 0, hp: C.HP, inv: 0, stun: 0, dead: false, deadT: 0 };
}

function hurt(s, dmg, fromX) {
  const p = s.p; if (p.inv > 0 || p.dead || s.cleared) return;
  p.hp -= dmg; p.inv = C.IFRAMES; p.stun = C.STUN; p.atk = null; p.act = null; p.charge = 0; p.dashT = 0; p.airDashT = 0; p.kickT = 0; p.airFast = false;
  const away = fromX === undefined ? -p.face : (p.x < fromX ? -1 : 1);
  p.vx = away * 1.2; p.vy = -2.2; p.ground = false; p.sliding = false;
  s.events.push({ t: 'hurt', x: p.x, y: p.y - 14 });
  if (p.hp <= 0) kill(s);
}
function kill(s) {
  const p = s.p; if (p.dead) return;
  p.hp = 0; p.dead = true; p.deadT = 70; p.atk = null; p.vx = 0; p.vy = 0; s.deaths++;
  s.events.push({ t: 'die', x: p.x, y: p.y - 14 });
}

function useThing(s, th) {
  const p = s.p;
  if (th.type === 'term') s.events.push({ t: 'talk', thing: th, x: th.x, y: th.y });
  else if (th.type === 'heal') { th.used = true; p.hp = C.HP; s.events.push({ t: 'heal', x: th.x, y: th.y - 14 }); }
  else if (th.type === 'switch') {
    th.used = true; const g = s.L.gates.find(q => q.id === th.gate);
    if (g && !g.open) { g.open = true; for (let j = g.r0; j <= g.r1; j++) s.L.t[j * s.L.W + g.col] = 0; }
    s.events.push({ t: 'switch', x: th.x, y: th.y - 14, gate: g });
  }
}
function startAttack(s, id) {
  const p = s.p;
  p.atk = { id, f: 0, hit: new Set() };
  s.events.push({ t: 'slash', id, x: p.x, y: p.y, face: p.face });
}
function attackBox(p) {
  const a = ATK[p.atk.id], b = a.box;
  return { x0: p.face > 0 ? p.x + b[0] : p.x - b[0] - b[2], y0: p.y + b[1], x1: p.face > 0 ? p.x + b[0] + b[2] : p.x - b[0], y1: p.y + b[1] + b[3] };
}

function step(s, input) {
  const p = s.p, L = s.L, ev = s.events;
  const pressJump = input.jump && !s.prev.jump, pressDash = input.dash && !s.prev.dash, pressAtk = input.attack && !s.prev.attack;
  const pressUse = input.interact && !s.prev.interact, pressAir = input.jumpAirDash && !s.prev.air;
  s.prev.air = !!input.jumpAirDash;
  s.prev.jump = !!input.jump; s.prev.dash = !!input.dash; s.prev.attack = !!input.attack; s.prev.interact = !!input.interact;
  if (pressJump) p.jbuf = C.JUMP_BUF;
  if (pressAtk) p.abuf = C.ATK_BUF;
  if (pressDash) p.dbuf = C.DASH_BUF;
  if (s.hitstop > 0) { s.hitstop--; return; }    // presses made during the freeze stay buffered
  s.frame++;
  if (!s.cleared && !p.dead) s.time++;

  if (p.dead) {
    if (--p.deadT <= 0) { s.p = newPlayer(s.spawn); s.p.inv = 60; s.bullets.length = 0; ev.push({ t: 'respawn', x: s.spawn.x, y: s.spawn.y }); }
    stepEnemies(s); return;
  }

  const dir = s.cleared ? 0 : (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const wasGround = p.ground;

  // examine / operate: only on the ground, next to the thing. The feet stop for a short reach-out motion.
  s.near = null;
  if (p.ground && p.stun <= 0 && !s.cleared) for (const th of s.things) {
    if ((th.type !== 'term' && th.used) || Math.abs(p.x - th.x) > USE_RANGE || Math.abs(p.y - th.y) > 2) continue;
    if (!s.near || Math.abs(p.x - th.x) < Math.abs(p.x - s.near.x)) s.near = th;
  }
  if (pressUse && s.near && !p.act && !p.atk) {
    p.act = { f: 0, thing: s.near }; p.dashT = 0; p.dashRecent = 0; p.charge = 0; if (Math.abs(s.near.x - p.x) > 3) p.face = s.near.x > p.x ? 1 : -1;
  }

  if (p.stun > 0) {
    p.stun--; p.vy = Math.min(p.vy + C.GRAV, C.FALL_MAX);
  } else if (p.act) {
    p.vx = 0; p.vy = Math.min(p.vy + C.GRAV, C.FALL_MAX); p.jbuf = p.abuf = p.dbuf = 0;
    if (++p.act.f === USE_AT) useThing(s, p.act.thing);
    if (p.act && p.act.f >= USE_LEN) p.act = null;
  } else {
    let rooted = p.atk && p.ground && ROOTED[p.atk.id];
    const canCancel = !p.atk || p.atk.f >= ATK[p.atk.id].act[0];

    // dash
    // input.autoDash (double-tap dash held): the next dash starts by itself the moment one ends or the feet land
    if ((p.dbuf > 0 || (input.autoDash && input.dash && !p.atk)) && p.ground && p.dashT <= 0 && canCancel && !s.cleared) {
      p.dbuf = 0;
      if (dir) p.face = dir;
      p.dashT = C.DASH_T; if (rooted) { p.atk = null; rooted = false; }
      ev.push({ t: 'dash', x: p.x, y: p.y, face: p.face });
    }
    if (p.dashT > 0) {
      if (!input.dash || (dir && dir !== p.face) || !p.ground) { if (!p.ground) p.airFast = true; p.dashT = 0; }
      else { p.dashT--; p.dashRecent = C.DASH_GRACE; }
    }
    if (p.dashT <= 0 && p.dashRecent > 0) p.dashRecent--;
    if (p.dbuf > 0) p.dbuf--;

    // air dash
    // (not when about to land: there the press is kept as a ground dash for the landing)
    const landing = p.vy > 0 && rowSolid(L, p.x - C.HW, p.x + C.HW, p.y + 10);
    // input.jumpAirDash (the mouse's jump button): a jump press in open air is an air dash too. At a wall it
    // stays a wall kick, and when the air dash is not available it stays a jump press (buffered for landing).
    const byJump = pressAir && !p.wall;      // (its own press, so it also works while another jump key is held)
    if ((pressDash || byJump) && C.AIR_DASH && !p.ground && p.coy <= 0 && p.airDashOK && p.kickT <= 0 && !landing && !(p.wall && dir === p.wall) && !s.cleared) {
      if (byJump) p.jbuf = 0;
      if (dir && !p.atk) p.face = dir;
      p.airDashT = C.AIR_DASH_T; p.airDashOK = false; p.dbuf = 0; p.vy = 0;
      ev.push({ t: 'airdash', x: p.x, y: p.y - 12, face: p.face });
    }
    if (p.airDashT > 0) { if (p.ground || (dir && dir !== p.face)) p.airDashT = 0; else if (--p.airDashT === 0) p.airFast = true; }

    // horizontal
    if (p.airDashT > 0) p.vx = p.face * C.DASH;
    else if (p.dashT > 0) p.vx = p.face * C.DASH;
    else if (p.ground) { p.vx = rooted ? 0 : dir * C.WALK; if (dir && !p.atk) p.face = dir; }
    else {
      const sp = p.airFast ? C.DASH : C.WALK;
      if (p.kickT > 0) { p.kickT--; p.vx = p.kickDir * sp; }
      else { p.vx = dir * sp; if (dir && !p.atk) p.face = dir; }
    }

    // jump / wall kick
    if (p.jbuf > 0 && !s.cleared) {
      if ((p.ground || p.coy > 0) && canCancel) {
        p.vy = -C.JUMP; p.airFast = p.dashT > 0 || p.dashRecent > 0; p.dashT = 0; p.dashRecent = 0;
        p.ground = false; p.coy = 0; p.jbuf = 0; if (p.atk && ROOTED[p.atk.id]) p.atk = null;
        ev.push({ t: 'jump', x: p.x, y: p.y });
      } else if (!p.ground && p.wall) {
        p.vy = -C.JUMP; p.kickDir = -p.wall; p.kickT = C.KICK_LOCK; p.airFast = !!input.dash || (C.KICK_CARRY && p.airFast); p.jbuf = 0; p.airDashT = 0; p.airDashOK = true; p.sliding = false;
        if (!p.atk) p.face = p.kickDir;
        ev.push({ t: 'kick', x: p.x + p.wall * C.HW, y: p.y - 6, dir: p.kickDir });
      }
    }
    if (p.jbuf > 0) p.jbuf--;
    if (!input.jump && p.vy < -C.JUMP_CUT && p.kickT <= 0) p.vy = -C.JUMP_CUT;

    // wall slide and gravity
    p.sliding = !p.ground && p.vy > 0 && p.wall !== 0 && dir === p.wall;
    if (p.sliding && !p.atk) p.face = -p.wall;
    if (p.airDashT > 0) p.vy = 0; else p.vy = Math.min(p.vy + C.GRAV, p.sliding ? C.SLIDE : C.FALL_MAX);

    // saber
    if (input.attack && !s.cleared) { p.charge++; if (p.charge === C.CHARGE_T) ev.push({ t: 'charged', x: p.x, y: p.y - 14 }); }
    else if (p.charge >= C.CHARGE_T) { p.charge = 0; p.abuf = 0; if (p.sliding) p.face = -p.wall; startAttack(s, 'charge'); }
    else p.charge = 0;
    if (p.abuf > 0 && !s.cleared) {
      let id = null;
      if (!p.atk) id = p.sliding ? 'wall' : !p.ground ? 'air' : p.dashT > 0 ? 'dash' : 's1';
      else { const a = ATK[p.atk.id]; if (a.next && p.ground && p.atk.f >= a.chain) id = a.next; }
      if (id) { p.abuf = 0; if (id === 's1' && dir) p.face = dir; startAttack(s, id); }
      else p.abuf--;
    }
  }

  // move and collide
  const hx = moveX(L, p, p.vx);
  if (hx && p.stun > 0) p.vx = 0;
  if (hx && p.airDashT > 0) { p.airDashT = 0; p.airFast = true; }
  const hy = moveY(L, p, p.vy);
  if (hy > 0) {
    if (!wasGround) { ev.push({ t: 'land', x: p.x, y: p.y }); if (p.atk && p.atk.id === 'air') p.atk = null; }
    p.ground = true; p.vy = 0; p.airFast = false; p.kickT = 0; p.coy = C.COYOTE; p.airDashT = 0; p.airDashOK = true;
  } else {
    if (hy < 0) p.vy = 0;
    if (p.ground) p.ground = false;
    if (p.coy > 0) p.coy--;
  }
  p.wall = 0;
  if (!p.ground) {
    if (colSolid(L, p.x + C.HW + 1.5, p.y - C.H + 4, p.y - 4)) p.wall = 1;
    else if (colSolid(L, p.x - C.HW - 1.5, p.y - C.H + 4, p.y - 4)) p.wall = -1;
  }

  // active saber frames
  if (p.atk) {
    const a = ATK[p.atk.id];
    if (p.atk.f >= a.act[0] && p.atk.f <= a.act[1]) slashHits(s, a);
    if (p.atk && ++p.atk.f >= a.len) p.atk = null;
  }

  // hazards
  if (tile(L, p.x - C.HW + 1, p.y - 2) === 2 || tile(L, p.x + C.HW - 1, p.y - 2) === 2) hurt(s, 4);
  if (p.y > L.H * T + 48) kill(s);
  if (p.inv > 0) p.inv--;

  stepEnemies(s);

  // checkpoints and goal
  for (const c of s.checks) if (!c.on && Math.abs(p.x - c.x) < 12 && Math.abs(p.y - c.y) < 40) {
    c.on = true; s.spawn = { x: c.x, y: c.y }; p.hp = C.HP; ev.push({ t: 'check', x: c.x, y: c.y });
  }
  if (!s.cleared && !p.dead && Math.abs(p.x - s.goal.x) < 10 && Math.abs(p.y - s.goal.y) < 40) { s.cleared = true; ev.push({ t: 'clear', x: p.x, y: p.y }); }
}

function moveX(L, o, dx) {
  let nx = o.x + dx, hit = 0;
  if (dx > 0) { const e = nx + C.HW; if (colSolid(L, e, o.y - C.H, o.y)) { nx = Math.floor(e / T) * T - C.HW - 0.001; hit = 1; } }
  else if (dx < 0) { const e = nx - C.HW; if (colSolid(L, e, o.y - C.H, o.y)) { nx = (Math.floor(e / T) + 1) * T + C.HW + 0.001; hit = -1; } }
  o.x = nx; return hit;
}
function moveY(L, o, dy) {
  let ny = o.y + dy, hit = 0;
  if (dy > 0) { if (rowSolid(L, o.x - C.HW, o.x + C.HW, ny)) { ny = Math.floor(ny / T) * T; hit = 1; } }
  else if (dy < 0) { const top = ny - C.H; if (rowSolid(L, o.x - C.HW, o.x + C.HW, top)) { ny = (Math.floor(top / T) + 1) * T + C.H; hit = -1; } }
  o.y = ny; return hit;
}

function slashHits(s, a) {
  const p = s.p, b = attackBox(p); let landed = false;
  for (const e of s.enemies) {
    if (e.dead || p.atk.hit.has(e)) continue;
    if (e.x + e.hw < b.x0 || e.x - e.hw > b.x1 || e.y < b.y0 || e.y - e.h > b.y1) continue;
    p.atk.hit.add(e); landed = true;
    e.hp -= a.dmg; e.flash = 8; e.stun = a.heavy ? 26 : 14;
    if (e.type === 'patrol') e.x = Math.max(e.x0, Math.min(e.x1, e.x + p.face * (a.heavy ? 10 : 4)));
    s.events.push({ t: 'hit', x: Math.max(b.x0, Math.min(b.x1, e.x)), y: e.y - e.h * 0.55, heavy: !!a.heavy, face: p.face });
    if (e.hp <= 0) { e.dead = true; e.respawn = e.type === 'dummy' ? 150 : 0; s.events.push({ t: 'kill', x: e.x, y: e.y - e.h / 2, type: e.type }); }
  }
  for (let i = s.bullets.length - 1; i >= 0; i--) {
    const q = s.bullets[i];
    if (q.x > b.x0 && q.x < b.x1 && q.y > b.y0 && q.y < b.y1) { s.bullets.splice(i, 1); s.events.push({ t: 'cut', x: q.x, y: q.y }); }
  }
  if (landed) s.hitstop = a.stop;
}

function stepEnemies(s) {
  const p = s.p, L = s.L;
  for (const e of s.enemies) {
    if (e.dead) { if (e.respawn > 0 && --e.respawn === 0) { e.dead = false; e.hp = e.maxHp; e.flash = 10; s.events.push({ t: 'spawn', x: e.x, y: e.y - e.h / 2 }); } continue; }
    if (e.flash > 0) e.flash--;
    if (e.stun > 0) e.stun--;
    else if (e.type === 'patrol' || e.type === 'heavy') {
      const sp = ENEMY[e.type].speed, nx = e.x + e.dir * sp;
      if (nx < e.x0 || nx > e.x1 || tile(L, nx + e.dir * e.hw, e.y - 4) === 1 || tile(L, nx + e.dir * e.hw, e.y + 4) !== 1) e.dir = -e.dir;
      else e.x = nx;
    } else if (e.type === 'turret') {
      e.dir = p.x < e.x ? -1 : 1;
      if (e.cool > 0) e.cool--;
      else if (!p.dead && Math.abs(p.x - e.x) < 230 && Math.abs(p.y - e.y) < 70) {
        e.cool = 105; s.bullets.push({ x: e.x + e.dir * 12, y: e.y - 12, vx: e.dir * 2, life: 170 });
        s.events.push({ t: 'shot', x: e.x + e.dir * 12, y: e.y - 12 });
      }
    }
    const touch = ENEMY[e.type].touch;
    if (touch && !p.dead && Math.abs(p.x - e.x) < e.hw + C.HW - 1 && p.y > e.y - e.h && p.y - C.H < e.y) hurt(s, touch, e.x);
  }
  for (let i = s.bullets.length - 1; i >= 0; i--) {
    const q = s.bullets[i]; q.x += q.vx;
    if (--q.life <= 0 || tile(L, q.x, q.y) === 1) { s.bullets.splice(i, 1); continue; }
    if (!p.dead && Math.abs(q.x - p.x) < C.HW + 2 && q.y > p.y - C.H && q.y < p.y) { s.bullets.splice(i, 1); hurt(s, 2, q.x - q.vx); }
  }
}

const api = { T, C, ATK, ENEMY, create, step, tile, attackBox };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
G.ZankoSim = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
