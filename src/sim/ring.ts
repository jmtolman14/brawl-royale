import type { SimCtx } from './ctx';
import { applyDamage } from './combat';
import { lerp } from './math';
import { heightAt, SEA_LEVEL } from './terrain';

export interface RingPhase {
  wait: number;
  shrink: number;
  radius: number;
  damage: number;
}

/** Storm schedule. The final circle becomes a wrestling ring ("Main Event"). */
export const RING_PHASES: RingPhase[] = [
  { wait: 75, shrink: 40, radius: 190, damage: 1 },
  { wait: 45, shrink: 30, radius: 120, damage: 2 },
  { wait: 40, shrink: 25, radius: 70, damage: 4 },
  { wait: 35, shrink: 20, radius: 38, damage: 6 },
  { wait: 30, shrink: 18, radius: 18, damage: 9 },
  { wait: 25, shrink: 15, radius: 10, damage: 12 },
  { wait: 40, shrink: 45, radius: 0, damage: 16 },
];
export const MAIN_EVENT_PHASE = 5;
export const ROPE_HALF = 7;

export function initRing(ctx: SimCtx) {
  const r = ctx.w.ring;
  r.phase = 0;
  r.cx = r.fromX = r.toX = 0;
  r.cz = r.fromZ = r.toZ = 0;
  r.r = r.fromR = r.toR = 330;
  r.stage = 'wait';
  r.stageTime = 0;
  r.stageDur = RING_PHASES[0].wait;
  r.damage = 0;
  pickNext(ctx);
}

function pickNext(ctx: SimCtx) {
  const r = ctx.w.ring;
  const ph = RING_PHASES[r.phase];
  if (ph.radius === 0) {
    r.toX = r.cx;
    r.toZ = r.cz;
    r.toR = 0;
    return;
  }
  const maxOff = Math.max(0, Math.min(r.r, 260) - ph.radius);
  for (let i = 0; i < 40; i++) {
    const a = ctx.rng.range(0, Math.PI * 2);
    const d = Math.sqrt(ctx.rng.next()) * maxOff;
    const x = (r.phase === 0 ? 0 : r.cx) + Math.cos(a) * d;
    const z = (r.phase === 0 ? 0 : r.cz) + Math.sin(a) * d;
    if (heightAt(x, z) > SEA_LEVEL + 1.5 || i === 39) {
      r.toX = x;
      r.toZ = z;
      break;
    }
  }
  r.toR = ph.radius;
  if (r.phase === MAIN_EVENT_PHASE) {
    ctx.w.mainEvent = true;
    ctx.ev.emit({ type: 'mainEvent' });
  }
}

export function tickRing(ctx: SimCtx, dt: number) {
  const w = ctx.w;
  const r = w.ring;
  if (r.phase < 0) return;
  r.stageTime += dt;
  if (r.stage === 'shrink') {
    const t = Math.min(1, r.stageTime / r.stageDur);
    r.cx = lerp(r.fromX, r.toX, t);
    r.cz = lerp(r.fromZ, r.toZ, t);
    r.r = lerp(r.fromR, r.toR, t);
  }
  if (r.stageTime >= r.stageDur && r.stage !== 'done') {
    r.stageTime = 0;
    if (r.stage === 'wait') {
      r.stage = 'shrink';
      r.stageDur = RING_PHASES[r.phase].shrink;
      r.fromX = r.cx;
      r.fromZ = r.cz;
      r.fromR = r.r;
      r.damage = RING_PHASES[r.phase].damage;
      ctx.ev.emit({ type: 'ringPhase', phase: r.phase, stage: 'shrink' });
    } else {
      r.phase++;
      if (r.phase >= RING_PHASES.length) {
        r.stage = 'done';
        r.phase = RING_PHASES.length - 1;
      } else {
        r.stage = 'wait';
        r.stageDur = RING_PHASES[r.phase].wait;
        pickNext(ctx);
        ctx.ev.emit({ type: 'ringPhase', phase: r.phase, stage: 'wait' });
      }
    }
  }
  // Storm damage, applied twice a second
  const dmg = Math.max(1, r.damage);
  const tickNow = Math.floor(w.time * 2) !== Math.floor((w.time - dt) * 2);
  if (!tickNow) return;
  for (const f of w.fighters) {
    if (!f.alive || f.state === 'bus' || f.state === 'glide') continue;
    if (Math.hypot(f.pos.x - r.cx, f.pos.z - r.cz) > r.r) applyDamage(ctx, null, f, dmg / 2, true);
  }
}

export const outsideRing = (ctx: SimCtx['w'], x: number, z: number) => Math.hypot(x - ctx.ring.cx, z - ctx.ring.cz) > ctx.ring.r;
