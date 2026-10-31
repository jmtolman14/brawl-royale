import type * as THREE from 'three';
import type { FighterState } from '../sim/types';

/** Interpolated render position between the last two sim ticks. */
export function fighterPos(f: FighterState, alpha: number, out: THREE.Vector3) {
  return out.set(
    f.prevPos.x + (f.pos.x - f.prevPos.x) * alpha,
    f.prevPos.y + (f.pos.y - f.prevPos.y) * alpha,
    f.prevPos.z + (f.pos.z - f.prevPos.z) * alpha,
  );
}
