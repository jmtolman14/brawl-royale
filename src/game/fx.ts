// Event → feedback hooks (screen shake, particles, damage numbers, audio).
// Renderers register listeners here so the sim stays decoupled.
import type { GameEvent } from '../sim/types';

type Listener = (e: GameEvent) => void;
const listeners = new Set<Listener>();

export function onFx(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function handleEventFx(e: GameEvent) {
  for (const l of listeners) l(e);
}
