import { getFighter } from '../data/fighters';
import { FINISHER, SIGNATURES, type MoveDef } from '../data/moves';
import {
  BLOCK_DRAIN, COMBO_WINDOW, DODGE_COST, DODGE_IFRAMES, DODGE_SPEED, DODGE_TIME, FIGHTER_RADIUS, GRAVITY, HYPE_MAX,
  JUMP_VEL, PLAYER_ID, SPRINT_DRAIN, SPRINT_MUL, STAMINA_DELAY, STAMINA_REGEN,
} from './constants';
import type { SimCtx } from './ctx';
import { canBeTargeted, finishThrow, processAttack, setState, startGetup } from './combat';
import { addHype, tickHype } from './hype';
import { canUseSelected, finishUse, tryPickup, throwItem } from './loot';
import { angleDiff, approachAngle, dirToYaw, yawToDir } from './math';
import { getMove, movesetOf, moveTimes } from './moves';
import { baseDerived, hasBuff, passiveOf, speedOf } from './stats';
import { resolveStatic } from './statics';
import { heightAt, SEA_LEVEL } from './terrain';
import type { FighterState, InputFrame } from './types';

const TURN_RATE = 14;

function startMove(ctx: SimCtx, f: FighterState, m: MoveDef, faceYaw: number) {
  if (f.stamina < m.stamina * 0.5) return false; // too gassed
  f.stamina -= m.stamina;
  f.staminaLockUntil = ctx.w.time + STAMINA_DELAY;
  const light = movesetOf(f).lights.some((l) => l.id === m.id);
  f.moveSpeed = (light ? baseDerived(f.rosterId).lightSpeed : 1) * (hasBuff(f, 'adrenaline') ? 1.15 : 1);
  setState(f, 'attack', 0);
  f.move = m.id;
  f.stateDur = moveTimes(f, m).total;
  f.hitIds.length = 0;
  f.hitIndex = -1;
  f.yaw = faceYaw;
  ctx.ev.emit({ type: 'swing', attacker: f.id, heavy: !!m.heavy });
  return true;
}

/** Yaw to face: lock target if valid, else the input yaw. */
function aimYaw(ctx: SimCtx, f: FighterState, input: InputFrame) {
  const t = f.lockTarget >= 0 ? ctx.w.fighters[f.lockTarget] : null;
  if (t && t.alive && Math.hypot(t.pos.x - f.pos.x, t.pos.z - f.pos.z) < 30) return dirToYaw(t.pos.x - f.pos.x, t.pos.z - f.pos.z);
  // When moving, attacks go where you're walking; otherwise where the camera looks
  if (Math.abs(input.moveX) + Math.abs(input.moveZ) > 0.1) return f.yaw;
  return input.yaw;
}

function tryAttack(ctx: SimCtx, f: FighterState, input: InputFrame, kind: 'light' | 'heavy') {
  const ms = movesetOf(f);
  const yaw = aimYaw(ctx, f, input);
  const inCombo = ctx.w.time < f.comboUntil;
  if (kind === 'light') {
    const step = inCombo ? f.comboStep % ms.lights.length : 0;
    if (startMove(ctx, f, ms.lights[step], yaw)) {
      f.comboStep = (inCombo ? f.comboStep : 0) + 1;
    }
  } else {
    const combo = inCombo && f.comboStep >= 2;
    if (startMove(ctx, f, combo ? ms.comboHeavy : ms.heavy, yaw)) {
      if (combo) addHype(ctx, f, 6);
      f.comboStep = 0;
    }
  }
}

/** E: grab an enemy in front if there is one, otherwise pick up loot. */
function grappleOrPickup(ctx: SimCtx, f: FighterState, input: InputFrame) {
  const g = movesetOf(f).grab;
  const yaw = aimYaw(ctx, f, input);
  let enemyNear = false;
  for (const o of ctx.w.fighters) {
    if (o === f || !canBeTargeted(o)) continue;
    const dx = o.pos.x - f.pos.x;
    const dz = o.pos.z - f.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < g.range + 1.2 && Math.abs(angleDiff(yaw, dirToYaw(dx, dz))) < 1.3) {
      enemyNear = true;
      break;
    }
  }
  if (!enemyNear && tryPickup(ctx, f)) return;
  startMove(ctx, f, g, yaw);
}

function trySignature(ctx: SimCtx, f: FighterState, input: InputFrame) {
  const yaw = aimYaw(ctx, f, input);
  if (f.hype >= HYPE_MAX) {
    f.stamina += FINISHER.stamina;
    if (startMove(ctx, f, FINISHER, yaw)) {
      f.hype = 0;
      f.invulnUntil = ctx.w.time + 0.7;
      const p = ctx.w.fighters[PLAYER_ID];
      if (Math.hypot(p.pos.x - f.pos.x, p.pos.z - f.pos.z) < 30) {
        ctx.w.timeScale = 0.35;
        ctx.w.timeScaleUntil = ctx.w.time + 0.45;
      }
      ctx.ev.emit({ type: 'finisher', fighter: f.id });
    }
    return;
  }
  if (ctx.w.time < f.sigReadyAt) return;
  const sig = SIGNATURES[getFighter(f.rosterId).signature];
  if (!sig) return;
  if (startMove(ctx, f, sig, yaw)) {
    f.sigReadyAt = ctx.w.time + sig.cooldown;
    ctx.ev.emit({ type: 'signature', fighter: f.id, name: sig.name });
  }
}

/** Free-state (idle/move/block) input handling. Returns true if a new action started. */
function handleActions(ctx: SimCtx, f: FighterState, input: InputFrame): boolean {
  if (input.slot >= 0 && input.slot < f.inventory.length) f.slot = input.slot;
  if (input.signature) {
    trySignature(ctx, f, input);
    if (f.state === 'attack') return true;
  }
  if (input.dodge && f.stamina >= DODGE_COST * 0.5 && f.onGround) {
    const slip = passiveOf(f) === 'slippery';
    f.stamina -= DODGE_COST * (slip ? 0.6 : 1);
    f.staminaLockUntil = ctx.w.time + STAMINA_DELAY;
    let dx = input.moveX, dz = input.moveZ;
    if (Math.abs(dx) + Math.abs(dz) < 0.1) dz = -1; // backstep
    const fwd = yawToDir(input.yaw);
    const rx = -fwd.z, rz = fwd.x;
    const wx = fwd.x * dz + rx * dx;
    const wz = fwd.z * dz + rz * dx;
    const l = Math.hypot(wx, wz) || 1;
    f.dodgeX = wx / l;
    f.dodgeZ = wz / l;
    setState(f, 'dodge', DODGE_TIME);
    f.invulnUntil = ctx.w.time + DODGE_IFRAMES * (slip ? 1.4 : 1);
    return true;
  }
  if (input.light) return tryAttack(ctx, f, input, 'light'), true;
  if (input.heavy) return tryAttack(ctx, f, input, 'heavy'), true;
  if (input.grapple) return grappleOrPickup(ctx, f, input), true;
  if (input.throwItem && throwItem(ctx, f)) return true;
  if (input.useItem) {
    const def = canUseSelected(f);
    if (def) {
      f.useItemId = def.id;
      setState(f, 'use', def.useTime);
      return true;
    }
  }
  return false;
}

/** Ground locomotion toward the input direction. */
function locomote(ctx: SimCtx, f: FighterState, input: InputFrame, dt: number, speedMul: number, allowSprint: boolean) {
  const fwd = yawToDir(input.yaw);
  const rx = -fwd.z, rz = fwd.x;
  let wx = fwd.x * input.moveZ + rx * input.moveX;
  let wz = fwd.z * input.moveZ + rz * input.moveX;
  const mag = Math.min(1, Math.hypot(wx, wz));
  let speed = speedOf(f) * speedMul;
  const sprinting = allowSprint && input.sprint && mag > 0.1 && f.stamina > 1;
  if (sprinting) {
    speed *= SPRINT_MUL;
    f.stamina -= SPRINT_DRAIN * dt;
    f.staminaLockUntil = ctx.w.time + 0.3;
  }
  if (f.pos.y < SEA_LEVEL - 0.3) speed *= 0.55; // swimming
  if (mag > 0.01) {
    const l = Math.hypot(wx, wz);
    wx /= l;
    wz /= l;
  }
  const tx = wx * speed * mag;
  const tz = wz * speed * mag;
  const accel = f.onGround ? 40 : 10;
  f.vel.x += Math.max(-accel * dt, Math.min(accel * dt, tx - f.vel.x));
  f.vel.z += Math.max(-accel * dt, Math.min(accel * dt, tz - f.vel.z));
  // Facing
  const t = f.lockTarget >= 0 ? ctx.w.fighters[f.lockTarget] : null;
  if (t && t.alive && !sprinting && Math.hypot(t.pos.x - f.pos.x, t.pos.z - f.pos.z) < 30) {
    f.yaw = approachAngle(f.yaw, dirToYaw(t.pos.x - f.pos.x, t.pos.z - f.pos.z), TURN_RATE * dt);
  } else if (mag > 0.1) {
    f.yaw = approachAngle(f.yaw, dirToYaw(wx, wz), TURN_RATE * dt);
  }
  return mag > 0.1;
}

function friction(f: FighterState, dt: number, k: number) {
  const m = Math.max(0, 1 - k * dt);
  f.vel.x *= m;
  f.vel.z *= m;
}

export function integrate(f: FighterState, dt: number) {
  f.vel.y -= GRAVITY * dt;
  f.pos.x += f.vel.x * dt;
  f.pos.y += f.vel.y * dt;
  f.pos.z += f.vel.z * dt;
  resolveStatic(f.pos, FIGHTER_RADIUS);
  const r = Math.hypot(f.pos.x, f.pos.z);
  if (r > 310) {
    f.pos.x *= 310 / r;
    f.pos.z *= 310 / r;
  }
  let ground = heightAt(f.pos.x, f.pos.z);
  if (ground < SEA_LEVEL - 0.9) ground = SEA_LEVEL - 0.9; // float in water
  if (f.pos.y <= ground) {
    f.pos.y = ground;
    if (f.vel.y < 0) f.vel.y = 0;
    f.onGround = true;
  } else {
    f.onGround = f.pos.y - ground < 0.05;
  }
}

export function tickFighter(ctx: SimCtx, f: FighterState, input: InputFrame, dt: number) {
  const w = ctx.w;
  // Buffs
  for (let i = f.buffs.length - 1; i >= 0; i--) {
    f.buffs[i].time -= dt;
    if (f.buffs[i].time <= 0) f.buffs.splice(i, 1);
  }
  if (!f.alive) {
    friction(f, dt, 4);
    integrate(f, dt);
    f.stateTime += dt;
    return;
  }
  f.stateTime += dt;
  f.lockTarget = input.lockTarget;
  const d = baseDerived(f.rosterId);

  // Stamina regen (not while blocking or exhausted-locked)
  if (w.time > f.staminaLockUntil && f.state !== 'block') {
    const boost = hasBuff(f, 'energy') ? 1.8 : 1;
    f.stamina = Math.min(f.maxStamina, f.stamina + STAMINA_REGEN * d.staminaRegen * boost * dt);
  }
  // Poise recovers when not being hit
  if (w.time - f.lastHitAt > 1.5) f.poise = Math.min(d.poiseMax, f.poise + 25 * dt);
  if (passiveOf(f) === 'second_wind' && f.hp < f.maxHp * 0.3) f.hp = Math.min(f.maxHp, f.hp + 2.5 * dt);
  tickHype(ctx, f, dt);

  switch (f.state) {
    case 'bus':
    case 'glide':
      return; // handled by drop.ts
    case 'idle':
    case 'move': {
      if (input.block && f.stamina > 2) {
        setState(f, 'block');
        f.blockStart = w.time;
        break;
      }
      if (handleActions(ctx, f, input)) break;
      if (input.jump && f.onGround) {
        f.vel.y = JUMP_VEL;
        f.onGround = false;
      }
      const moving = locomote(ctx, f, input, dt, 1, true);
      const ns = moving ? 'move' : 'idle';
      if (ns !== f.state) {
        f.state = ns;
        f.stateTime = 0;
      }
      break;
    }
    case 'block': {
      f.stamina -= BLOCK_DRAIN * dt;
      if (!input.block || f.stamina <= 0) {
        setState(f, 'idle');
        break;
      }
      if (input.grapple || input.dodge || input.light || input.heavy || input.signature) {
        // Allow actions straight out of block (feels responsive)
        setState(f, 'idle');
        handleActions(ctx, f, input);
        break;
      }
      locomote(ctx, f, input, dt, 0.35, false);
      if (f.lockTarget < 0) f.yaw = approachAngle(f.yaw, input.yaw, TURN_RATE * dt);
      break;
    }
    case 'attack': {
      const m = getMove(f.move);
      if (!m) {
        setState(f, 'idle');
        break;
      }
      const t = moveTimes(f, m);
      // Buffer the next combo input during recovery
      if (f.stateTime > t.s && (input.light || input.heavy)) f.buffered = input.light ? 'light' : 'heavy';
      if (f.stateTime < t.s + t.a && m.lunge) {
        const dir = yawToDir(f.yaw);
        f.vel.x = dir.x * m.lunge;
        f.vel.z = dir.z * m.lunge;
        if (m.anim === 'leap' || m.anim === 'elbowdrop' || m.id === 'flying_knee') {
          if (f.onGround && f.stateTime < t.s * 0.5) {
            f.vel.y = 7;
            f.onGround = false;
          }
        }
      } else {
        friction(f, dt, 12);
      }
      // Aim tracking during startup (only toward lock target)
      if (f.stateTime < t.s && f.lockTarget >= 0) f.yaw = approachAngle(f.yaw, aimYaw(ctx, f, input), 6 * dt);
      processAttack(ctx, f, m);
      if (f.state !== 'attack') break;
      // Dodge-cancel recovery
      if (f.stateTime > t.s + t.a && input.dodge) {
        setState(f, 'idle');
        handleActions(ctx, f, input);
        break;
      }
      if (f.stateTime >= t.total) {
        if (f.hitIds.length === 0 && !m.counter) ctx.ev.emit({ type: 'whiff', attacker: f.id });
        const buf = f.buffered;
        f.comboUntil = w.time + COMBO_WINDOW;
        setState(f, 'idle');
        if (buf) tryAttack(ctx, f, input, buf);
      }
      break;
    }
    case 'grapple': {
      friction(f, dt, 20);
      if (f.stateTime >= f.stateDur) finishThrow(ctx, f);
      break;
    }
    case 'grabbed': {
      const h = w.fighters[f.grappleWith];
      if (!h || !h.alive || h.state !== 'grapple' || h.grappleWith !== f.id) {
        setState(f, 'idle');
        break;
      }
      // Held in front of the thrower, lifted in an arc (rendered as a throw)
      const p = Math.min(1, f.stateTime / f.stateDur);
      const dir = yawToDir(h.yaw);
      const reach = 1.1 - p * 1.6;
      f.pos.x = h.pos.x + dir.x * reach;
      f.pos.z = h.pos.z + dir.z * reach;
      f.pos.y = h.pos.y + Math.sin(p * Math.PI) * 1.8;
      f.yaw = h.yaw + Math.PI;
      f.vel.x = f.vel.y = f.vel.z = 0;
      return; // skip integrate
    }
    case 'dodge': {
      const k = 1 - f.stateTime / f.stateDur;
      f.vel.x = f.dodgeX * DODGE_SPEED * (0.4 + 0.6 * k);
      f.vel.z = f.dodgeZ * DODGE_SPEED * (0.4 + 0.6 * k);
      if (f.stateTime >= f.stateDur) setState(f, 'idle');
      break;
    }
    case 'stun': {
      friction(f, dt, f.onGround ? 7 : 1);
      if (f.stateTime >= f.stateDur) setState(f, 'idle');
      break;
    }
    case 'knockdown': {
      friction(f, dt, f.onGround ? 5 : 0.5);
      if (f.stateTime >= f.stateDur && f.onGround) startGetup(f, w.time);
      break;
    }
    case 'getup': {
      friction(f, dt, 10);
      if (f.stateTime >= f.stateDur) setState(f, 'idle');
      break;
    }
    case 'use': {
      locomote(ctx, f, input, dt, 0.45, false);
      if (input.dodge || input.block) {
        f.useItemId = null;
        setState(f, 'idle');
        break;
      }
      if (f.stateTime >= f.stateDur) {
        finishUse(ctx, f);
        setState(f, 'idle');
      }
      break;
    }
    case 'ko':
      break;
  }
  integrate(f, dt);
}
