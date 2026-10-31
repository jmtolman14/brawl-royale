import type { SimCtx } from '../ctx';
import { emptyInput, type FighterState, type InputFrame } from '../types';

export function initBots(_ctx: SimCtx) {}

export function botThink(_ctx: SimCtx, _f: FighterState, _dt: number): InputFrame {
  return emptyInput();
}
