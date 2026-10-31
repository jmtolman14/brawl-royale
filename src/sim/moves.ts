import { getFighter } from '../data/fighters';
import { FINISHER, MOVESETS, SIGNATURES, type MoveDef, type Moveset } from '../data/moves';
import type { FighterState } from './types';

const ALL: Record<string, MoveDef> = { [FINISHER.id]: FINISHER };
for (const ms of Object.values(MOVESETS)) {
  for (const m of [...ms.lights, ms.heavy, ms.comboHeavy, ms.grab]) ALL[m.id] = m;
}
for (const s of Object.values(SIGNATURES)) ALL[s.id] = s;

export const getMove = (id: string | null): MoveDef | null => (id ? ALL[id] ?? null : null);
export const movesetOf = (f: FighterState): Moveset => MOVESETS[getFighter(f.rosterId).archetype];

/** Phase timings for the fighter's current move, scaled by its move speed. */
export function moveTimes(f: FighterState, m: MoveDef) {
  const k = 1 / f.moveSpeed;
  const s = m.startup * k;
  const a = m.active * k;
  const r = m.recovery * k;
  return { s, a, r, total: s + a + r };
}
