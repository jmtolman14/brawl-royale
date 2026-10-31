// Storm wall, the Battle Blimp, and the Main Event wrestling ring.
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { session } from '../game/session';
import { ROPE_HALF } from '../sim/ring';
import { heightAt } from '../sim/terrain';

export function StormWall() {
  const wall = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 } },
        vertexShader: `varying vec2 vUv; varying vec3 vPos; void main(){ vUv=uv; vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
        fragmentShader: `uniform float uTime; varying vec2 vUv; varying vec3 vPos;
          void main(){
            float bands = 0.5 + 0.5*sin(vUv.x*180.0 + vUv.y*30.0 - uTime*2.0);
            float fade = smoothstep(1.0, 0.0, vUv.y) * 0.75 + 0.1;
            vec3 c = mix(vec3(0.45,0.1,0.75), vec3(0.85,0.4,1.0), bands*0.5);
            gl_FragColor = vec4(c, (0.28 + bands*0.12) * fade);
          }`,
      }),
    [],
  );
  useFrame((state) => {
    const r = session.runner;
    const m = wall.current;
    if (!r || !m) return;
    const ring = r.world.ring;
    m.visible = ring.phase >= 0 && ring.r > 0.5;
    m.position.set(ring.cx, 60, ring.cz);
    m.scale.set(Math.max(ring.r, 0.1), 1, Math.max(ring.r, 0.1));
    mat.uniforms.uTime.value = state.clock.elapsedTime;
  });
  return (
    <mesh ref={wall} material={mat} renderOrder={5}>
      <cylinderGeometry args={[1, 1, 200, 96, 1, true]} />
    </mesh>
  );
}

export function Blimp() {
  const g = useRef<THREE.Group>(null);
  useFrame((state) => {
    const r = session.runner;
    const b = g.current;
    if (!r || !b) return;
    const bus = r.world.bus;
    b.visible = bus.active;
    if (!b.visible) return;
    b.position.set(bus.x, bus.y + 6 + Math.sin(state.clock.elapsedTime) * 0.6, bus.z);
    b.rotation.y = Math.atan2(-bus.dirX, -bus.dirZ);
  });
  return (
    <group ref={g}>
      <mesh scale={[7, 7, 20]}>
        <sphereGeometry args={[1, 20, 14]} />
        <meshToonMaterial color="#dc2626" />
      </mesh>
      <mesh scale={[7.05, 1.6, 20.05]}>
        <sphereGeometry args={[1, 20, 6]} />
        <meshToonMaterial color="#fbbf24" />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, 0, 17]} rotation-z={(i * Math.PI) / 2}>
          <boxGeometry args={[0.4, 12, 4]} />
          <meshToonMaterial color="#111827" />
        </mesh>
      ))}
      <mesh position={[0, -8, 0]}>
        <boxGeometry args={[4, 2.6, 9]} />
        <meshToonMaterial color="#1f2937" />
      </mesh>
    </group>
  );
}

const POSTS: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const POST_COLORS = ['#dc2626', '#f8fafc', '#2563eb', '#f8fafc'];

/** Appears at the final circle once the Main Event begins. */
export function MainEventRing() {
  const g = useRef<THREE.Group>(null);
  const posts = useRef<(THREE.Mesh | null)[]>([]);
  const ropes = useRef<(THREE.Mesh | null)[]>([]);
  const lights = useRef<THREE.Group>(null);
  useFrame((state) => {
    const r = session.runner;
    if (!r || !g.current) return;
    const w = r.world;
    g.current.visible = w.mainEvent;
    if (!w.mainEvent) return;
    const cx = w.ring.toX, cz = w.ring.toZ;
    const corner = POSTS.map(([sx, sz]) => {
      const x = cx + sx * ROPE_HALF, z = cz + sz * ROPE_HALF;
      return new THREE.Vector3(x, heightAt(x, z), z);
    });
    corner.forEach((c, i) => {
      const p = posts.current[i];
      if (p) p.position.set(c.x, c.y + 1.1, c.z);
    });
    // 4 sides × 3 rope heights
    for (let side = 0; side < 4; side++) {
      const a = corner[side], b = corner[(side + 1) % 4];
      for (let h = 0; h < 3; h++) {
        const m = ropes.current[side * 3 + h];
        if (!m) continue;
        const y = 0.75 + h * 0.5;
        const mid = new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2 + y, (a.z + b.z) / 2);
        m.position.copy(mid);
        const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
        m.scale.set(1, len, 1);
        m.lookAt(b.x, b.y + y, b.z);
        m.rotateX(Math.PI / 2);
      }
    }
    if (lights.current) {
      lights.current.position.set(cx, heightAt(cx, cz) + 18, cz);
      lights.current.rotation.y = state.clock.elapsedTime * 0.6;
    }
  });
  return (
    <group ref={g} visible={false}>
      {POSTS.map((_, i) => (
        <mesh key={i} ref={(m) => (posts.current[i] = m)}>
          <cylinderGeometry args={[0.18, 0.18, 2.2, 8]} />
          <meshToonMaterial color={POST_COLORS[i]} />
        </mesh>
      ))}
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} ref={(m) => (ropes.current[i] = m)}>
          <cylinderGeometry args={[0.045, 0.045, 1, 6]} />
          <meshBasicMaterial color={i % 3 === 1 ? '#f8fafc' : '#dc2626'} />
        </mesh>
      ))}
      <group ref={lights}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation-z={0.35} rotation-y={(i * Math.PI * 2) / 3} position={[0, -8, 0]}>
            <coneGeometry args={[3, 18, 16, 1, true]} />
            <meshBasicMaterial color="#fde68a" transparent opacity={0.12} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
