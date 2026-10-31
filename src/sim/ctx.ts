import type { EventBus } from './world';
import type { Rng } from './rng';
import type { WorldState } from './types';

export interface SimCtx {
  w: WorldState;
  ev: EventBus;
  rng: Rng;
}
