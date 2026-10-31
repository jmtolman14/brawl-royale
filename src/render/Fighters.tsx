import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { session } from '../game/session';
import { getFighter } from '../data/fighters';
import { FighterModel } from './FighterModel';

export function Fighters() {
  const r = session.runner!;
  const getAlpha = () => session.runner?.alpha ?? 0;
  return (
    <group>
      {r.world.fighters.map((f) => (
        <FighterLOD key={f.id} id={f.id}>
          <FighterModel fighter={f} getAlpha={getAlpha} isWinner={() => session.runner?.world.winner === f.id} />
        </FighterLOD>
      ))}
    </group>
  );
}

/** Hides far-away fighters' detailed rigs and disables their shadows. */
function FighterLOD({ id, children }: { id: number; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const far = useRef<THREE.Mesh>(null);
  const shadow = useRef<boolean | null>(null);
  const color = getFighter(session.runner!.world.fighters[id].rosterId).colors.primary;
  useFrame(({ camera }) => {
    const r = session.runner;
    const g = ref.current;
    if (!r || !g || !far.current) return;
    const f = r.world.fighters[id];
    const d = Math.hypot(f.pos.x - camera.position.x, f.pos.z - camera.position.z);
    const detailed = d < 70 || f.state === 'glide';
    g.visible = detailed;
    far.current.visible = !detailed && d < 260 && f.state !== 'bus';
    if (far.current.visible) far.current.position.set(f.pos.x, f.pos.y + 0.9, f.pos.z);
    // Only nearby fighters cast shadows
    const cast = d < 35;
    if (cast !== shadow.current) {
      shadow.current = cast;
      g.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.castShadow = cast;
      });
    }
  });
  return (
    <>
      <group ref={ref}>{children}</group>
      <mesh ref={far} visible={false}>
        <capsuleGeometry args={[0.45, 1, 2, 6]} />
        <meshLambertMaterial color={color} />
      </mesh>
    </>
  );
}
