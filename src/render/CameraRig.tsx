import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { session } from '../game/session';
import { angleDiff, dirToYaw, lerp } from '../sim/math';
import { heightAt } from '../sim/terrain';
import { fighterPos } from './interp';

const target = new THREE.Vector3();
const desired = new THREE.Vector3();
const look = new THREE.Vector3();

export function CameraRig() {
  const camera = useThree((s) => s.camera);
  useFrame((_, dt) => {
    const r = session.runner;
    if (!r) return;
    const w = r.world;
    const inp = session.input;
    const f = w.fighters[session.cameraTarget] ?? w.fighters[0];
    fighterPos(f, r.alpha, target);
    const inAir = f.state === 'bus' || f.state === 'glide';
    // Lock-on: steer camera yaw toward the target
    const lt = session.lockTarget >= 0 ? w.fighters[session.lockTarget] : null;
    if (lt && lt.alive && session.cameraTarget === 0) {
      const want = dirToYaw(lt.pos.x - f.pos.x, lt.pos.z - f.pos.z);
      inp.yaw += angleDiff(inp.yaw, want) * Math.min(1, dt * 6);
      inp.pitch = lerp(inp.pitch, 0.22, Math.min(1, dt * 3));
    }
    const dist = f.state === 'bus' ? 48 : inAir ? 10 : w.mainEvent ? 6.5 : 5.2;
    const yaw = inp.yaw;
    const pitch = inp.pitch;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const h = Math.cos(pitch) * dist;
    // Over-the-shoulder offset
    const side = inAir ? 0 : 0.7;
    desired.set(target.x - fx * h - fz * side, target.y + 1.7 + Math.sin(pitch) * dist, target.z - fz * h + fx * side);
    const ground = heightAt(desired.x, desired.z) + 0.6;
    if (desired.y < ground) desired.y = ground;
    camera.position.lerp(desired, Math.min(1, dt * 14));
    look.set(target.x, target.y + 1.5, target.z);
    if (session.shake > 0) {
      const s = session.shake;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
      session.shake = Math.max(0, s - dt * 2.5);
    }
    camera.lookAt(look);
  }, -1);
  return null;
}
