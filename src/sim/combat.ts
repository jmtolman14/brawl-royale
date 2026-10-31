import { getFighter } from '../data/fighters';
import { MOVESETS, type MoveDef } from '../data/moves';
import { FIGHTER_RADIUS, GETUP_IFRAMES, KNOCKDOWN_TIME, PARRY_WINDOW, PLAYER_ID, THROW_TIME } from './constants';
import type { SimCtx } from './ctx';
import { addHype } from './hype';
import { dropInventory } from './loot';
import { angleDiff, dirToYaw } from './math';
import { getMove, moveTimes } from './moves';
import { baseDerived, defenseOf, passiveOf, powerOf } from './stats';
import type { FighterState } from './types';

export const isDown = (f: FighterState) => f.state === 'knockdown' || f.state === 'getup' || f.state === 'ko';
export const canBeTargeted = (f: FighterState) => f.alive && f.state !== 'bus' && f.state !== 'glide' && f.state !== 'grabbed';

function hitPause(ctx: SimCtx, a: FighterState, b: FighterState, amount: number) {
  if (a.id === PLAYER_ID || b.id === PLAYER_ID) ctx.w.hitPause = Math.max(ctx.w.hitPause, amount);
}

export function setState(f: FighterState, state: FighterState['state'], dur = 0) {
  f.state = state;
  f.stateTime = 0;
  f.stateDur = dur;
  if (state !== 'attack' && state !== 'grapple') {
    f.move = null;
    f.buffered = null;
  }
  if (state !== 'grapple' && state !== 'grabbed') f.grappleWith = -1;
}

/** Called every tick while a fighter is attacking: performs hit detection in the active window. */
export function processAttack(ctx: SimCtx, f: FighterState, m: MoveDef) {
  const t = moveTimes(f, m);
  if (f.stateTime < t.s || f.stateTime > t.s + t.a) return;
  if (m.counter) return; // counter stance is passive: handled when struck
  const hits = m.hits ?? 1;
  const idx = Math.min(hits - 1, Math.floor(((f.stateTime - t.s) / t.a) * hits));
  if (idx !== f.hitIndex) {
    f.hitIndex = idx;
    f.hitIds.length = 0;
  }
  const range = m.range * baseDerived(f.rosterId).range * (m.grab && passiveOf(f) === 'grip_strength' ? 1.3 : 1);
  for (const o of ctx.w.fighters) {
    if (o === f || !canBeTargeted(o) || f.hitIds.includes(o.id)) continue;
    const dx = o.pos.x - f.pos.x;
    const dz = o.pos.z - f.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > range + FIGHTER_RADIUS) continue;
    if (Math.abs(o.pos.y - f.pos.y) > 2.2) continue;
    if (!m.aoe && Math.abs(angleDiff(f.yaw, dirToYaw(dx, dz))) > m.arc && d > 0.8) continue;
    f.hitIds.push(o.id);
    if (m.grab) {
      if (tryGrab(ctx, f, o, m)) return;
    } else {
      resolveStrike(ctx, f, o, m);
      if (f.state !== 'attack') return; // got countered
    }
  }
}

function inCounterStance(o: FighterState) {
  if (o.state !== 'attack') return false;
  const m = getMove(o.move);
  if (!m?.counter) return false;
  const t = moveTimes(o, m);
  return o.stateTime >= t.s && o.stateTime <= t.s + t.a;
}

export function resolveStrike(ctx: SimCtx, a: FighterState, o: FighterState, m: MoveDef) {
  const w = ctx.w;
  const pos = { x: (a.pos.x + o.pos.x) / 2, y: o.pos.y + 1.3, z: (a.pos.z + o.pos.z) / 2 };
  // Dodge beats strikes
  if (o.invulnUntil > w.time) {
    if (o.state === 'dodge') addHype(ctx, o, 4);
    return;
  }
  // Counter stance (Ippon Counter) throws the striker
  if (inCounterStance(o)) {
    const cm = getMove(o.move)!;
    startThrow(ctx, o, a, cm);
    return;
  }
  const facing = Math.abs(angleDiff(o.yaw, dirToYaw(a.pos.x - o.pos.x, a.pos.z - o.pos.z))) < 1.9;
  if (o.state === 'block' && facing && !m.unblockable) {
    const window = PARRY_WINDOW * (passiveOf(o) === 'redirect' ? 2 : 1);
    if (w.time - o.blockStart <= window) {
      // Perfect block: stagger the attacker
      ctx.ev.emit({ type: 'parry', attacker: a.id, target: o.id, ...pos });
      addHype(ctx, o, 14);
      o.lastCombatAt = a.lastCombatAt = w.time;
      hitPause(ctx, a, o, 0.09);
      if (passiveOf(o) === 'redirect') {
        const g = MOVESETS[getFighter(o.rosterId).archetype].grab;
        startThrow(ctx, o, a, g);
      } else {
        setState(a, 'stun', 0.75);
        knock(a, o, 3, 0);
      }
      return;
    }
    // Normal block: chip damage + stamina drain
    const dmg = m.damage * powerOf(a) * defenseOf(o) * 0.12;
    applyDamage(ctx, a, o, dmg, true);
    o.stamina -= m.damage * 1.3 * (m.heavy ? 1.4 : 1);
    o.staminaLockUntil = w.time + 0.5;
    knock(o, a, m.knockback * 0.4, 0);
    if (passiveOf(o) === 'counter_puncher') o.counterReady = true;
    ctx.ev.emit({ type: 'hit', attacker: a.id, target: o.id, damage: dmg, ...pos, heavy: !!m.heavy, blocked: true, shield: false });
    if (o.stamina <= 0) {
      o.stamina = 0;
      setState(o, 'stun', 0.9); // guard break
      addHype(ctx, a, 8);
    }
    o.lastCombatAt = a.lastCombatAt = w.time;
    hitPause(ctx, a, o, 0.03);
    return;
  }

  // Clean hit
  let dmg = m.damage * powerOf(a) * defenseOf(o);
  if (a.counterReady) {
    dmg *= 1.4;
    a.counterReady = false;
  }
  const wasDown = isDown(o);
  if (wasDown) dmg *= 0.5;
  const interrupted = o.state === 'attack' || o.state === 'grapple';
  const hadShield = o.shield > 0;
  applyDamage(ctx, a, o, dmg, false);
  ctx.ev.emit({ type: 'hit', attacker: a.id, target: o.id, damage: dmg, ...pos, heavy: !!m.heavy, blocked: false, shield: hadShield });
  a.lastCombatAt = o.lastCombatAt = w.time;
  addHype(ctx, a, 2 + dmg * 0.25 + (a.comboStep >= 2 ? 3 : 0) + (interrupted ? 4 : 0));
  addHype(ctx, o, -2);
  hitPause(ctx, a, o, m.heavy ? 0.085 : 0.045);
  if (!o.alive) return;
  if (m.slow || (m.heavy && passiveOf(a) === 'leg_kicks')) {
    o.buffs = o.buffs.filter((b) => b.kind !== 'slow');
    o.buffs.push({ kind: 'slow', time: m.slow ?? 2 });
  }
  if (wasDown) return;
  // If they were grappling someone, release the victim
  if (o.state === 'grapple') releaseGrab(ctx, o);
  o.poise -= m.poise;
  const imm = passiveOf(o) === 'immovable';
  const kd = (m.knockdown && (!imm || o.poise <= 0 || m.poise >= 100)) || o.poise <= 0;
  const kb = m.knockback * baseDerived(a.rosterId).knockbackDealt;
  if (kd) {
    knockdown(ctx, o);
    knock(o, a, kb, m.lift);
  } else {
    setState(o, 'stun', m.hitstun);
    knock(o, a, kb * 0.8, m.lift * 0.4);
  }
}

/** Push `o` away from `from`. */
export function knock(o: FighterState, from: FighterState, kb: number, lift: number) {
  const mul = baseDerived(o.rosterId).knockbackTaken;
  let dx = o.pos.x - from.pos.x;
  let dz = o.pos.z - from.pos.z;
  const d = Math.hypot(dx, dz) || 1;
  dx /= d;
  dz /= d;
  o.vel.x = dx * kb * mul;
  o.vel.z = dz * kb * mul;
  if (lift > 0) {
    o.vel.y = Math.max(o.vel.y, lift * Math.max(0.5, mul));
    o.onGround = false;
  }
}

export function knockdown(ctx: SimCtx, o: FighterState) {
  setState(o, 'knockdown', KNOCKDOWN_TIME);
  o.poise = baseDerived(o.rosterId).poiseMax;
  ctx.ev.emit({ type: 'knockdown', target: o.id });
}

export function applyDamage(ctx: SimCtx, a: FighterState | null, o: FighterState, dmg: number, chip: boolean) {
  if (!o.alive) return;
  let rest = dmg;
  if (!chip && o.shield > 0) {
    const s = Math.min(o.shield, rest);
    o.shield -= s;
    rest -= s;
  }
  o.hp -= rest;
  if (a) {
    a.damageDealt += dmg;
    o.lastHitBy = a.id;
  }
  o.lastHitAt = ctx.w.time;
  if (o.hp <= 0) eliminate(ctx, o, a ? a.id : o.lastHitAt > ctx.w.time - 6 ? o.lastHitBy : -1);
}

export function eliminate(ctx: SimCtx, o: FighterState, by: number) {
  if (!o.alive) return;
  const w = ctx.w;
  if (o.state === 'grapple') releaseGrab(ctx, o);
  if (o.state === 'grabbed') {
    const holder = w.fighters[o.grappleWith];
    if (holder && holder.state === 'grapple') setState(holder, 'idle');
  }
  o.hp = 0;
  o.alive = false;
  o.placement = w.aliveCount;
  w.aliveCount--;
  setState(o, 'ko');
  o.vel.y = Math.max(o.vel.y, 3);
  const killer = by >= 0 ? w.fighters[by] : null;
  if (killer && killer !== o) {
    killer.kills++;
    addHype(ctx, killer, 25);
  }
  if (w.championId === o.id) w.championId = -1;
  dropInventory(ctx, o);
  ctx.ev.emit({ type: 'ko', target: o.id, by: killer && killer !== o ? killer.id : -1, placement: o.placement });
  if (w.aliveCount <= 1 && w.phase === 'playing') {
    const winner = w.fighters.find((f) => f.alive);
    w.winner = winner ? winner.id : -1;
    if (winner) winner.placement = 1;
    w.phase = 'over';
    if (winner) ctx.ev.emit({ type: 'win', fighter: winner.id });
  }
}

function tryGrab(ctx: SimCtx, a: FighterState, o: FighterState, m: MoveDef): boolean {
  const w = ctx.w;
  if (o.invulnUntil > w.time || isDown(o) || o.state === 'grapple') return false;
  if (inCounterStance(o)) {
    startThrow(ctx, o, a, getMove(o.move)!);
    return true;
  }
  if (passiveOf(o) === 'slippery' && ctx.rng.chance(0.35)) {
    // Slipped out
    setState(a, 'stun', 0.5);
    addHype(ctx, o, 8);
    return true;
  }
  if (o.state === 'block') addHype(ctx, a, 6); // grapple beats block
  startThrow(ctx, a, o, m);
  return true;
}

export function startThrow(ctx: SimCtx, a: FighterState, o: FighterState, m: MoveDef) {
  if (o.state === 'grapple') releaseGrab(ctx, o);
  setState(a, 'grapple', THROW_TIME);
  a.move = m.id;
  a.grappleWith = o.id;
  a.yaw = dirToYaw(o.pos.x - a.pos.x, o.pos.z - a.pos.z);
  a.vel.x = a.vel.z = 0;
  setState(o, 'grabbed', THROW_TIME);
  o.grappleWith = a.id;
  o.vel.x = o.vel.z = o.vel.y = 0;
  a.lastCombatAt = o.lastCombatAt = ctx.w.time;
}

/** Throw finished: slam the victim. */
export function finishThrow(ctx: SimCtx, a: FighterState) {
  const o = ctx.w.fighters[a.grappleWith];
  const m = getMove(a.move);
  setState(a, 'idle');
  if (!o || !m || o.state !== 'grabbed') return;
  const weak = MOVESETS[getFighter(o.rosterId).archetype].throwWeakness;
  const pg = passiveOf(a);
  const dmg = (m.throwDamage ?? 14) * baseDerived(a.rosterId).grapple * Math.sqrt(powerOf(a)) * defenseOf(o) * weak;
  const pos = { x: o.pos.x, y: o.pos.y + 0.5, z: o.pos.z };
  // Put the victim on the ground in front of the thrower
  o.state = 'idle';
  applyDamage(ctx, a, o, dmg, false);
  ctx.ev.emit({ type: 'throw', attacker: a.id, target: o.id, damage: dmg, ...pos });
  hitPause(ctx, a, o, 0.1);
  addHype(ctx, a, 12 + dmg * 0.3);
  if (pg === 'relentless') a.stamina = Math.min(a.maxStamina, a.stamina + 25);
  if (m.id === 'triangle_choke') o.stamina = 0;
  if (!o.alive) return;
  knockdown(ctx, o);
  knock(o, a, m.knockback, m.lift);
}

export function releaseGrab(ctx: SimCtx, a: FighterState) {
  const o = ctx.w.fighters[a.grappleWith];
  if (o && o.state === 'grabbed' && o.grappleWith === a.id) {
    setState(o, 'idle');
    o.invulnUntil = ctx.w.time + 0.3;
  }
  a.grappleWith = -1;
}

export function startGetup(f: FighterState, time: number) {
  setState(f, 'getup', 0.55);
  f.invulnUntil = time + GETUP_IFRAMES;
}
