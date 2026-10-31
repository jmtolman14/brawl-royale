// Bot AI: a small state machine that outputs InputFrames, exactly like a human.
// States: drop → loot / roam / hunt → fight → recover, with flee-the-storm overriding.
import { ITEM_BY_ID } from '../../data/items';
import { ZONES } from '../../data/map';
import { getFighter } from '../../data/fighters';
import { SIGNATURES } from '../../data/moves';
import { canBeTargeted } from '../combat';
import { HOTBAR_SLOTS, HYPE_MAX, MAX_SHIELD, PICKUP_RANGE } from '../constants';
import type { SimCtx } from '../ctx';
import { GLIDE_DEPLOY_HEIGHT } from '../drop';
import { dirToYaw } from '../math';
import { getMove, movesetOf, moveTimes } from '../moves';
import { BOXES, blockedByBuilding } from '../statics';
import { heightAt, SEA_LEVEL } from '../terrain';
import { emptyInput, type FighterState, type InputFrame } from '../types';

const enum Mode {
  Drop = 0,
  Loot = 1,
  Roam = 2,
  Hunt = 3,
  Fight = 4,
  Recover = 5,
  Flee = 6,
}

export function initBots(ctx: SimCtx) {
  const w = ctx.w;
  for (const f of w.fighters) {
    if (!f.isBot) continue;
    const zone = ctx.rng.chance(0.75) ? ctx.rng.pick(ZONES) : null;
    const tx = zone ? zone.x + ctx.rng.range(-zone.r, zone.r) * 0.7 : ctx.rng.range(-220, 220);
    const tz = zone ? zone.z + ctx.rng.range(-zone.r, zone.r) * 0.7 : ctx.rng.range(-220, 220);
    const b = w.bus;
    // Bus progress closest to the landing target
    const proj = (tx - b.x) * b.dirX + (tz - b.z) * b.dirZ;
    f.ai = {
      mode: Mode.Drop, tx, tz, target: -1, think: 0, nextAtk: 0, strafe: ctx.rng.chance(0.5) ? 1 : -1, nextStrafe: 0,
      seenAtk: -1, defend: 0, defendUntil: 0, stuckT: 0, lastX: f.pos.x, lastZ: f.pos.z, avoidUntil: 0, avoidDir: 1,
      jumpT: Math.max(40, Math.min(b.length - 30, proj - 25 + ctx.rng.range(-35, 35))),
      itemUid: -1, combo: 0, aggression: 0.35 + ctx.rng.next() * 0.65, retreatUntil: 0, escapeUntil: -100,
    };
  }
}

function enemyThreat(o: FighterState) {
  if (o.state !== 'attack') return null;
  const m = getMove(o.move);
  if (!m || m.counter) return null;
  const t = moveTimes(o, m);
  if (o.stateTime > t.s + t.a) return null;
  return m;
}

function findTarget(ctx: SimCtx, f: FighterState, radius: number) {
  const w = ctx.w;
  let best: FighterState | null = null;
  let bestD = radius;
  for (const o of w.fighters) {
    if (o === f || !canBeTargeted(o) || o.state === 'knockdown' || o.state === 'getup') continue;
    let d = Math.hypot(o.pos.x - f.pos.x, o.pos.z - f.pos.z);
    if (o.id === w.championId) d *= 0.3; // the champ is a magnet
    if (o.id === f.ai.target) d *= 0.7; // stickiness
    if (d < bestD && (d < 12 || !blockedByBuilding(f.pos.x, f.pos.z, o.pos.x, o.pos.z))) {
      best = o;
      bestD = d;
    }
  }
  return best;
}

function nearestLoot(ctx: SimCtx, f: FighterState, radius: number) {
  const w = ctx.w;
  const full = f.inventory.every((s) => s);
  let best: { x: number; z: number; uid: number } | null = null;
  let bestD = radius;
  for (const c of w.crates) {
    if (c.opened) continue;
    const d = Math.hypot(c.x - f.pos.x, c.z - f.pos.z);
    if (d < bestD) {
      best = { x: c.x, z: c.z, uid: c.uid };
      bestD = d;
    }
  }
  if (!full) {
    for (const it of w.items) {
      const d = Math.hypot(it.x - f.pos.x, it.z - f.pos.z) * (it.itemId === 'belt' ? 0.3 : 1);
      if (d < bestD) {
        best = { x: it.x, z: it.z, uid: it.uid };
        bestD = d;
      }
    }
  }
  return best;
}

function insideNextRing(ctx: SimCtx, x: number, z: number, margin = 0) {
  const r = ctx.w.ring;
  if (r.phase < 0) return true;
  const cx = r.stage === 'wait' ? r.toX : r.cx;
  const cz = r.stage === 'wait' ? r.toZ : r.cz;
  const rr = r.stage === 'wait' ? r.toR : r.r;
  return Math.hypot(x - cx, z - cz) < rr - margin;
}

function stormUrgent(ctx: SimCtx, f: FighterState) {
  const r = ctx.w.ring;
  if (r.phase < 0) return false;
  const outNow = Math.hypot(f.pos.x - r.cx, f.pos.z - r.cz) > r.r - 3;
  if (outNow) return true;
  // Head to the next zone once the wait timer is running low
  const left = r.stageDur - r.stageTime;
  return r.stage === 'wait' && left < 25 && !insideNextRing(ctx, f.pos.x, f.pos.z, 4);
}

/** Pick a slot holding an item of one of these kinds. */
function findSlot(f: FighterState, kinds: string[]) {
  for (let i = 0; i < HOTBAR_SLOTS; i++) {
    const s = f.inventory[i];
    if (s && kinds.includes(ITEM_BY_ID[s.itemId]?.kind)) return i;
  }
  return -1;
}

/** Steer toward (tx,tz) with simple whisker avoidance and stuck recovery. */
function steer(ctx: SimCtx, f: FighterState, inp: InputFrame, tx: number, tz: number, sprint: boolean, dt: number) {
  const ai = f.ai;
  let yaw = dirToYaw(tx - f.pos.x, tz - f.pos.z);
  // Whisker: building straight ahead?
  const ax = f.pos.x - Math.sin(yaw) * 2.2;
  const az = f.pos.z - Math.cos(yaw) * 2.2;
  const blocked = BOXES.some((b) => ax > b.minX - 0.6 && ax < b.maxX + 0.6 && az > b.minZ - 0.6 && az < b.maxZ + 0.6 && f.pos.y < b.topY);
  // Avoid wading into the sea
  const wet = heightAt(ax, az) < SEA_LEVEL + 0.3 && heightAt(tx, tz) > SEA_LEVEL + 0.3;
  if ((blocked || wet) && ctx.w.time > ai.avoidUntil) {
    ai.avoidUntil = ctx.w.time + 0.9;
    ai.avoidDir = ctx.rng.chance(0.5) ? 1 : -1;
  }
  if (ctx.w.time < ai.avoidUntil) yaw += ai.avoidDir * 1.3;
  // Stuck detection
  ai.stuckT += dt;
  if (ai.stuckT > 1) {
    const moved = Math.hypot(f.pos.x - ai.lastX, f.pos.z - ai.lastZ);
    if (moved < 0.8 && (f.state === 'move' || f.state === 'idle')) {
      inp.jump = true;
      ai.avoidUntil = ctx.w.time + 1.2;
      ai.avoidDir = -ai.avoidDir;
    }
    ai.stuckT = 0;
    ai.lastX = f.pos.x;
    ai.lastZ = f.pos.z;
  }
  inp.yaw = yaw;
  inp.moveZ = 1;
  inp.sprint = sprint && f.stamina > f.maxStamina * 0.35;
}

function roamPoint(ctx: SimCtx, f: FighterState) {
  const r = ctx.w.ring;
  for (let i = 0; i < 12; i++) {
    const cx = r.phase < 0 ? 0 : r.toX;
    const cz = r.phase < 0 ? 0 : r.toZ;
    const rad = Math.max(5, Math.min(r.phase < 0 ? 250 : r.toR, 250) * 0.8);
    const a = ctx.rng.range(0, Math.PI * 2);
    const d = Math.sqrt(ctx.rng.next()) * rad;
    const x = cx + Math.cos(a) * d;
    const z = cz + Math.sin(a) * d;
    if (heightAt(x, z) > SEA_LEVEL + 1) {
      f.ai.tx = x;
      f.ai.tz = z;
      return;
    }
  }
  f.ai.tx = r.toX;
  f.ai.tz = r.toZ;
}

function fight(ctx: SimCtx, f: FighterState, o: FighterState, inp: InputFrame) {
  const ai = f.ai;
  const w = ctx.w;
  const skill = f.skill;
  const dx = o.pos.x - f.pos.x;
  const dz = o.pos.z - f.pos.z;
  const d = Math.hypot(dx, dz);
  const ms = movesetOf(f);
  const reach = ms.lights[0].range * 0.9;
  inp.lockTarget = o.id;
  inp.yaw = dirToYaw(dx, dz);

  // --- Defence: react to incoming attacks after a skill-based reaction time
  const threat = enemyThreat(o);
  if (threat && d < threat.range + 1.5) {
    const startedAt = w.time - o.stateTime;
    if (ai.seenAtk !== startedAt) {
      ai.seenAtk = startedAt;
      const react = 0.28 - skill * 0.2;
      const tm = moveTimes(o, threat);
      // Can we physically react before it lands?
      const canReact = tm.s > react;
      ai.defend = 0;
      if (canReact && ctx.rng.chance(0.15 + skill * 0.65)) {
        if (threat.grab) ai.defend = ctx.rng.chance(0.5) ? 2 : 3; // dodge or strike the grabber
        else ai.defend = ctx.rng.chance(0.55 - skill * 0.15) ? 1 : 2; // block or dodge
        ai.defendUntil = w.time + react;
      }
    }
    if (ai.defend && w.time >= ai.defendUntil) {
      if (ai.defend === 1) inp.block = true;
      else if (ai.defend === 2) {
        inp.dodge = true;
        inp.moveX = ai.strafe;
        inp.moveZ = -0.3;
        ai.defend = 0;
      } else if (ai.defend === 3) {
        inp.light = true;
        ai.defend = 0;
      }
      if (ai.defend === 1) return;
    }
  } else if (ai.defend === 1) {
    ai.defend = 0;
  }

  // --- Back off when gassed or hurt (skilled bots manage stamina)
  if (f.stamina < f.maxStamina * 0.2 && skill > 0.3) ai.retreatUntil = w.time + 1.2;
  if (w.time < ai.retreatUntil) {
    inp.moveZ = -1;
    inp.moveX = ai.strafe * 0.5;
    if (d < 3 && ctx.rng.chance(skill * 0.05)) inp.block = true;
    return;
  }

  // --- Footwork
  if (w.time > ai.nextStrafe) {
    ai.nextStrafe = w.time + ctx.rng.range(0.8, 2.2);
    ai.strafe = -ai.strafe;
  }
  if (d > reach + 0.2) {
    inp.moveZ = 1;
    inp.sprint = d > 6;
  } else if (d < 1.1) inp.moveZ = -0.6;
  inp.moveX = ai.strafe * (d < reach + 2 ? 0.45 : 0.15);

  // Throwables at mid range
  if (d > 5 && d < 16 && w.time > ai.nextAtk) {
    const ts = findSlot(f, ['throwable']);
    if (ts >= 0 && ctx.rng.chance(0.3)) {
      inp.slot = ts;
      inp.throwItem = true;
      ai.nextAtk = w.time + 1;
      return;
    }
  }

  if (w.time < ai.nextAtk || f.state !== 'idle' && f.state !== 'move' && f.state !== 'attack') return;

  // --- Offence
  const sig = SIGNATURES[getFighter(f.rosterId).signature];
  const punish = o.state === 'stun' || (o.state === 'attack' && !enemyThreat(o));
  const tempo = (0.75 - skill * 0.45) / (0.5 + ai.aggression);
  if (f.hype >= HYPE_MAX && d < 4) {
    inp.signature = true;
    ai.nextAtk = w.time + 1.2;
    return;
  }
  if (sig && w.time >= f.sigReadyAt && d < Math.max(sig.range, sig.lunge ? 6 : 0) && ctx.rng.chance(0.04 + skill * 0.06)) {
    inp.signature = true;
    ai.nextAtk = w.time + 1;
    return;
  }
  if (o.state === 'block' && d < ms.grab.range + 0.3 && ctx.rng.chance(0.25 + skill * 0.5)) {
    inp.grapple = true; // grab beats block
    ai.nextAtk = w.time + tempo + 0.4;
    return;
  }
  if (d < reach + 0.3) {
    if (f.state === 'attack') {
      // Buffer combo
      if (skill > 0.4 && ai.combo < 2) {
        inp.light = true;
        ai.combo++;
      } else if (skill > 0.55 && ai.combo === 2) {
        inp.heavy = true;
        ai.combo = 0;
      }
      return;
    }
    const r = ctx.rng.next();
    if (r < 0.12 + (1 - skill) * 0.05) inp.grapple = true;
    else if (r < 0.35 || punish) inp.heavy = ctx.rng.chance(0.4);
    if (!inp.grapple && !inp.heavy) {
      inp.light = true;
      ai.combo = 1;
    }
    ai.nextAtk = w.time + tempo * (punish ? 0.4 : 1) + ctx.rng.range(0, 0.4);
  }
}

export function botThink(ctx: SimCtx, f: FighterState, dt: number): InputFrame {
  const w = ctx.w;
  const ai = f.ai;
  const inp = emptyInput();
  inp.yaw = f.yaw;

  // --- Drop
  if (f.state === 'bus') {
    if (w.bus.t >= ai.jumpT) inp.jump = true;
    return inp;
  }
  if (f.state === 'glide') {
    const dd = Math.hypot(ai.tx - f.pos.x, ai.tz - f.pos.z);
    inp.yaw = dirToYaw(ai.tx - f.pos.x, ai.tz - f.pos.z);
    const above = f.pos.y - heightAt(f.pos.x, f.pos.z);
    inp.moveZ = dd > 4 ? 1 : 0;
    if (above > GLIDE_DEPLOY_HEIGHT && dd < 40) inp.moveZ = 1;
    return inp;
  }
  if (ai.mode === Mode.Drop) ai.mode = Mode.Loot;
  if (!f.alive) return inp;

  // Training partner: mostly defensive, attacks rarely
  const training = w.ring.phase < 0;

  // --- High-level decision
  ai.think -= dt;
  const player = w.fighters[0];
  const farFromPlayer = Math.hypot(player.pos.x - f.pos.x, player.pos.z - f.pos.z) > 120;
  if (ai.think <= 0) {
    ai.think = (0.3 + (1 - f.skill) * 0.3) * (farFromPlayer ? 2 : 1);
    const phaseMul = 1 + Math.max(0, w.ring.phase) * 0.45;
    const huntR = training ? 30 : (4 + ai.aggression * 9 + f.skill * 4) * phaseMul;
    const tgt = findTarget(ctx, f, w.phase === 'bus' ? 18 : huntR);
    const hurt = f.hp < f.maxHp * 0.45;
    const healSlot = findSlot(f, ['heal']);
    const shieldSlot = findSlot(f, ['shield']);
    const urgent = !training && stormUrgent(ctx, f);
    const tgtD = tgt ? Math.hypot(tgt.pos.x - f.pos.x, tgt.pos.z - f.pos.z) : Infinity;
    // Early game: looting matters more than brawling unless someone is in your face
    const closeEnemy = tgt && tgtD < (w.time < 110 && !training ? 3.5 : 6);
    // Hurt and losing: disengage to heal (smarter bots do this more)
    if (!training && tgt && closeEnemy && f.hp < f.maxHp * 0.3 && tgt.hp > f.hp && ctx.rng.chance(f.skill * 0.6) && w.time > ai.escapeUntil + 6) {
      ai.escapeUntil = w.time + 3 + f.skill * 2;
    }
    if (w.time < ai.escapeUntil && tgt) {
      ai.mode = Mode.Flee;
      ai.tx = f.pos.x - (tgt.pos.x - f.pos.x) * 4;
      ai.tz = f.pos.z - (tgt.pos.z - f.pos.z) * 4;
    } else if (urgent && !(closeEnemy && f.skill < 0.5)) {
      ai.mode = Mode.Flee;
      ai.escapeUntil = -100; // storm flee: head for the safe zone
    } else if (tgt && closeEnemy) {
      ai.mode = Mode.Fight;
      ai.target = tgt.id;
    } else if ((hurt && healSlot >= 0) || (f.shield < MAX_SHIELD * 0.5 && shieldSlot >= 0) || findSlot(f, ['wraps', 'knucks', 'belt']) >= 0) {
      ai.mode = Mode.Recover;
    } else if (tgt && (!hurt || f.skill < 0.3)) {
      ai.mode = Mode.Hunt;
      ai.target = tgt.id;
    } else {
      const loot = training ? null : nearestLoot(ctx, f, 45);
      if (loot && (!insideNextRing(ctx, f.pos.x, f.pos.z) ? insideNextRing(ctx, loot.x, loot.z) : true)) {
        ai.mode = Mode.Loot;
        ai.tx = loot.x;
        ai.tz = loot.z;
        ai.itemUid = loot.uid;
      } else if (ai.mode !== Mode.Roam || Math.hypot(ai.tx - f.pos.x, ai.tz - f.pos.z) < 4) {
        ai.mode = Mode.Roam;
        roamPoint(ctx, f);
      }
    }
  }

  const target = ai.target >= 0 ? w.fighters[ai.target] : null;
  switch (ai.mode) {
    case Mode.Flee: {
      const r = w.ring;
      const escaping = w.time < ai.escapeUntil;
      const cx = escaping ? ai.tx : r.stage === 'wait' ? r.toX : r.cx;
      const cz = escaping ? ai.tz : r.stage === 'wait' ? r.toZ : r.cz;
      steer(ctx, f, inp, cx, cz, true, dt);
      if (target && target.alive && Math.hypot(target.pos.x - f.pos.x, target.pos.z - f.pos.z) < 2.2 && ctx.rng.chance(0.05)) inp.light = true;
      break;
    }
    case Mode.Fight:
      if (!target || !target.alive || !canBeTargeted(target)) {
        ai.think = 0;
        ai.target = -1;
        break;
      }
      if (training) {
        // Gentle sparring partner
        const d = Math.hypot(target.pos.x - f.pos.x, target.pos.z - f.pos.z);
        inp.lockTarget = target.id;
        inp.yaw = dirToYaw(target.pos.x - f.pos.x, target.pos.z - f.pos.z);
        const threat = enemyThreat(target);
        if (threat && ctx.rng.chance(0.03)) inp.block = true;
        if (d > 2.2) inp.moveZ = 0.6;
        if (w.time > ai.nextAtk && d < 2.2) {
          ai.nextAtk = w.time + ctx.rng.range(1.8, 3.5);
          if (ctx.rng.chance(0.7)) inp.light = true;
          else inp.grapple = true;
        }
        if (f.state === 'block' && !threat) inp.block = false;
        break;
      }
      fight(ctx, f, target, inp);
      break;
    case Mode.Hunt: {
      if (!target || !target.alive) {
        ai.think = 0;
        break;
      }
      steer(ctx, f, inp, target.pos.x, target.pos.z, Math.hypot(target.pos.x - f.pos.x, target.pos.z - f.pos.z) > 8, dt);
      break;
    }
    case Mode.Loot: {
      const d = Math.hypot(ai.tx - f.pos.x, ai.tz - f.pos.z);
      if (d < PICKUP_RANGE * 0.8) {
        inp.grapple = true; // E: pick up / open
        ai.think = Math.min(ai.think, 0.15);
      } else steer(ctx, f, inp, ai.tx, ai.tz, d > 12, dt);
      break;
    }
    case Mode.Recover: {
      if (f.state === 'use') {
        // keep still while healing
        break;
      }
      const order: [string[], boolean][] = [
        [['heal'], f.hp < f.maxHp * 0.6],
        [['shield'], f.shield < MAX_SHIELD * 0.6],
        [['belt', 'knucks', 'wraps'], true],
      ];
      let used = false;
      for (const [kinds, ok] of order) {
        if (!ok) continue;
        const s = findSlot(f, kinds);
        if (s >= 0) {
          if (f.slot !== s) inp.slot = s;
          else inp.useItem = true;
          used = true;
          break;
        }
      }
      if (!used) ai.think = 0;
      break;
    }
    case Mode.Roam:
      steer(ctx, f, inp, ai.tx, ai.tz, false, dt);
      break;
  }
  // Use adrenaline/energy in fights
  if (ai.mode === Mode.Fight && f.stamina < f.maxStamina * 0.3) {
    const s = findSlot(f, ['stamina']);
    if (s >= 0 && f.state !== 'attack') {
      if (f.slot !== s) inp.slot = s;
      else inp.useItem = true;
    }
  }
  if (ai.mode === Mode.Fight && !f.buffs.some((b) => b.kind === 'adrenaline') && ctx.rng.chance(0.01)) {
    const s = findSlot(f, ['adrenaline']);
    if (s >= 0) {
      if (f.slot !== s) inp.slot = s;
      else inp.useItem = true;
    }
  }
  return inp;
}
