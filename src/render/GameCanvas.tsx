import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { GameLoop } from '../game/GameLoop';
import { session } from '../game/session';
import { useSettings } from '../store/settings';
import { CameraRig } from './CameraRig';
import { Buildings, Props } from './Environment';
import { Fighters } from './Fighters';
import { Particles } from './vfx/Particles';
import { ScreenLabelDriver } from './vfx/ScreenLabels';
import { Terrain, Water } from './Terrain';

function Sun() {
  const light = useRef<THREE.DirectionalLight>(null);
  const scene = useThree((s) => s.scene);
  const quality = useSettings((s) => s.quality);
  useFrame(() => {
    const r = session.runner;
    const l = light.current;
    if (!r || !l) return;
    const f = r.world.fighters[session.cameraTarget] ?? r.world.fighters[0];
    // Shadow camera follows the action so a small shadow map stays crisp
    l.position.set(f.pos.x + 30, f.pos.y + 60, f.pos.z + 20);
    l.target.position.set(f.pos.x, f.pos.y, f.pos.z);
    if (!l.target.parent) scene.add(l.target);
  });
  const size = quality === 'high' ? 2048 : 1024;
  return (
    <directionalLight
      ref={light}
      intensity={2.2}
      color="#fff4e0"
      castShadow={quality !== 'low'}
      shadow-mapSize={[size, size]}
      shadow-camera-left={-30}
      shadow-camera-right={30}
      shadow-camera-top={30}
      shadow-camera-bottom={-30}
      shadow-camera-near={1}
      shadow-camera-far={150}
      shadow-bias={-0.0005}
    />
  );
}

export default function GameCanvas() {
  const quality = useSettings((s) => s.quality);
  const dpr: [number, number] = quality === 'low' ? [0.6, 0.8] : quality === 'medium' ? [1, 1.25] : [1, 2];
  const far = quality === 'low' ? 380 : quality === 'medium' ? 600 : 900;
  return (
    <Canvas
      shadows={quality !== 'low'}
      dpr={dpr}
      gl={{ antialias: quality !== 'low', powerPreference: 'high-performance' }}
      camera={{ fov: 60, near: 0.1, far, position: [0, 150, 0] }}
      onCreated={({ gl }) => {
        session.input.attach(gl.domElement);
      }}
    >
      <color attach="background" args={['#8ecae6']} />
      <fog attach="fog" args={['#a8d8ef', far * 0.35, far * 0.95]} />
      <hemisphereLight args={['#ddeeff', '#6b8f3a', 1.1]} />
      <Sun />
      <GameLoop />
      <Terrain />
      <Water />
      <Buildings />
      <Props />
      <Fighters />
      <Particles />
      <ScreenLabelDriver />
      <CameraRig />
    </Canvas>
  );
}
