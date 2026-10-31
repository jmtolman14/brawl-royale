// The live match, shared between the R3F scene, the HUD and input (non-React singleton).
import { InputManager } from '../input/InputManager';
import { MatchRunner } from '../sim/match';
import type { MatchOptions } from '../sim/world';

export const session = {
  runner: null as MatchRunner | null,
  input: new InputManager(),
  lockTarget: -1,
  /** Fighter id the camera follows (switches to killer when spectating). */
  cameraTarget: 0,
  shake: 0,
};

export function startMatch(opts: MatchOptions) {
  session.runner = new MatchRunner(opts);
  session.lockTarget = -1;
  session.cameraTarget = 0;
  session.shake = 0;
  return session.runner;
}

if (import.meta.env.DEV) (window as unknown as { __session: typeof session }).__session = session;
