// Crowd Hype: the crowd rewards style (combos, parries, throws, dodges) and
// gets bored when you avoid fights. Full hype unlocks your FINISHER.
import { HYPE_MAX } from './constants';
import type { SimCtx } from './ctx';
import { hypeMulOf } from './stats';
import type { FighterState } from './types';

export function addHype(ctx: SimCtx, f: FighterState, amount: number) {
  if (!f.alive) return;
  const before = f.hype;
  f.hype = Math.max(0, Math.min(HYPE_MAX, f.hype + (amount > 0 ? amount * hypeMulOf(f) : amount)));
  if (before < HYPE_MAX && f.hype >= HYPE_MAX) ctx.ev.emit({ type: 'hypeFull', fighter: f.id });
}

export function tickHype(ctx: SimCtx, f: FighterState, dt: number) {
  // Bored crowd: drains slowly if you haven't been in a fight for a while.
  if (ctx.w.time - f.lastCombatAt > 12 && f.hype < HYPE_MAX) f.hype = Math.max(0, f.hype - 1.2 * dt);
}
