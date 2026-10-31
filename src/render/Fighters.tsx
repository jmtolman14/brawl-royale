import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { session } from '../game/session';
import { fighterPos } from './interp';

const v = new THREE.Vector3();

/** Placeholder capsules (replaced by FighterModel in milestone 2). */
export function Fighters() {
  const r = session.runner!;
  return (
    <group>
      {r.world.fighters.map((f) => (
        <Capsule key={f.id} id={f.id} />
      ))}
    </group>
  );
}

function Capsule({ id }: { id: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const r = session.runner!;
    const f = r.world.fighters[id];
    const g = ref.current!;
    g.visible = f.state !== 'bus';
    fighterPos(f, r.alpha, v);
    g.position.copy(v);
    g.rotation.y = f.yaw;
  });
  return (
    <group ref={ref}>
      <mesh position-y={0.9} castShadow>
        <capsuleGeometry args={[0.4, 1, 4, 8]} />
        <meshToonMaterial color={id === 0 ? '#e63946' : '#999'} />
      </mesh>
      <mesh position={[0, 1.4, -0.4]}>
        <boxGeometry args={[0.2, 0.2, 0.3]} />
        <meshToonMaterial color="#222" />
      </mesh>
    </group>
  );
}
