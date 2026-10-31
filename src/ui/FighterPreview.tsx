import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getFighter } from '../data/fighters';
import { SIGNATURES } from '../data/moves';
import { movesetOf, moveTimes } from '../sim/moves';
import { makeFighter } from '../sim/world';
import { blendPose, computePose, restPose } from '../render/anim/procedural';
import { applyPose, FighterBody, type FighterRig } from '../render/FighterModel';

/** Rotating showcase that loops through the fighter's moves. */
function Showcase({ id }: { id: string }) {
  const def = getFighter(id);
  const f = useMemo(() => makeFighter(0, id, '', false, 1, 0, 0), [id]);
  const rig = useRef<FighterRig | null>(null);
  const pose = useRef(restPose());
  const turn = useRef<THREE.Group>(null);
  const clock = useRef({ t: 0, step: 0 });
  useFrame((state, dt) => {
    const c = clock.current;
    c.t += dt;
    f.stateTime += dt;
    f.pos.y = 0;
    f.onGround = true;
    if (f.state === 'attack' && f.stateTime >= f.stateDur) {
      f.state = 'idle';
      f.stateTime = 0;
      f.move = null;
    }
    if (f.state === 'idle' && c.t > 1.3) {
      c.t = 0;
      const ms = movesetOf(f);
      const seq = [ms.lights[0], ms.lights[1 % ms.lights.length], ms.comboHeavy, ms.heavy, SIGNATURES[def.signature]];
      const m = seq[c.step++ % seq.length];
      f.state = 'attack';
      f.move = m.id;
      f.moveSpeed = 0.7;
      f.stateTime = 0;
      f.stateDur = moveTimes(f, m).total;
    }
    if (turn.current) turn.current.rotation.y += dt * 0.5;
    if (!rig.current) return;
    const target = computePose(f, state.clock.elapsedTime, false);
    blendPose(pose.current, target, 1 - Math.exp(-dt * 18), target.spin !== 0);
    applyPose(rig.current, pose.current, 0.95 * def.body.height);
    rig.current.root.rotation.y = 0;
  });
  return (
    <group ref={turn} rotation-y={Math.PI * 0.85}>
      <FighterBody key={id} def={def} rigRef={rig} />
    </group>
  );
}

export default function FighterPreview({ id }: { id: string }) {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 1.4, 4.2], fov: 38 }} gl={{ antialias: true, alpha: true }}>
      <hemisphereLight args={['#ffffff', '#3b0d0d', 1.4]} />
      <directionalLight position={[3, 5, 4]} intensity={2.4} />
      <directionalLight position={[-4, 2, -3]} intensity={1.2} color="#f43f5e" />
      <group position-y={-0.15}>
        <Showcase id={id} />
        <mesh rotation-x={-Math.PI / 2} position-y={-0.01}>
          <circleGeometry args={[1.4, 40]} />
          <meshBasicMaterial color="#000" transparent opacity={0.35} />
        </mesh>
      </group>
      <CamLook />
    </Canvas>
  );
}

function CamLook() {
  useFrame(({ camera }) => camera.lookAt(0, 1.0, 0));
  return null;
}
