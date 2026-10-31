import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BUILDINGS, ZONES } from '../data/map';
import { BOXES, PROPS } from '../sim/statics';
import { heightAt } from '../sim/terrain';
import { useSettings } from '../store/settings';

const tmp = new THREE.Object3D();
const roofGeom = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4);
const col = new THREE.Color();

function useInstances(ref: React.RefObject<THREE.InstancedMesh>, count: number, fill: (i: number, o: THREE.Object3D, c: THREE.Color) => void, deps: unknown[]) {
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    for (let i = 0; i < count; i++) {
      tmp.position.set(0, 0, 0);
      tmp.rotation.set(0, 0, 0);
      tmp.scale.set(1, 1, 1);
      col.set('#ffffff');
      fill(i, tmp, col);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
      m.setColorAt(i, col);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

export function Buildings() {
  const walls = useRef<THREE.InstancedMesh>(null);
  const roofs = useRef<THREE.InstancedMesh>(null);
  const doors = useRef<THREE.InstancedMesh>(null);
  const shadows = useSettings((s) => s.quality === 'high');
  const n = BUILDINGS.length;
  useInstances(walls, n, (i, o, c) => {
    const b = BUILDINGS[i], box = BOXES[i];
    const h = box.topY - box.baseY;
    o.position.set(b.x, box.baseY + h / 2, b.z);
    o.scale.set(b.w, h, b.d);
    c.set(b.color);
  }, []);
  useInstances(roofs, n, (i, o, c) => {
    const b = BUILDINGS[i], box = BOXES[i];
    o.position.set(b.x, box.topY + 0.9, b.z);
    o.scale.set(b.w * 1.1, 1.8, b.d * 1.1);
    c.set(b.roof);
  }, []);
  useInstances(doors, n, (i, o, c) => {
    const b = BUILDINGS[i];
    const g = heightAt(b.x, b.z + b.d / 2);
    o.position.set(b.x, g + 1.2, b.z + b.d / 2 + 0.05);
    o.scale.set(1.4, 2.4, 0.1);
    c.set('#3d2b1f');
  }, []);
  return (
    <group>
      <instancedMesh ref={walls} args={[undefined, undefined, n]} castShadow={shadows} receiveShadow>
        <boxGeometry />
        <meshLambertMaterial />
      </instancedMesh>
      <instancedMesh ref={roofs} args={[roofGeom, undefined, n]} castShadow={shadows}>
        <meshLambertMaterial flatShading />
      </instancedMesh>
      <instancedMesh ref={doors} args={[undefined, undefined, n]}>
        <boxGeometry />
        <meshLambertMaterial />
      </instancedMesh>
      <Landmarks />
    </group>
  );
}

/** Decorative set pieces: boxing ring in the arena, gym sign, docks pier, dojo gate. */
function Landmarks() {
  const arena = ZONES.find((z) => z.id === 'arena')!;
  const docks = ZONES.find((z) => z.id === 'docks')!;
  const gym = ZONES.find((z) => z.id === 'gym')!;
  const ay = heightAt(arena.x, arena.z);
  const posts = [[-5, -5], [5, -5], [5, 5], [-5, 5]] as const;
  return (
    <group>
      <group position={[arena.x, ay, arena.z]}>
        <mesh position-y={0.4} receiveShadow>
          <boxGeometry args={[11, 0.8, 11]} />
          <meshLambertMaterial color="#1e3a8a" />
        </mesh>
        <mesh position-y={0.81}>
          <boxGeometry args={[10.4, 0.02, 10.4]} />
          <meshLambertMaterial color="#e5e7eb" />
        </mesh>
        {posts.map(([x, z], i) => (
          <mesh key={i} position={[x, 1.6, z]}>
            <cylinderGeometry args={[0.15, 0.15, 1.8]} />
            <meshLambertMaterial color={i % 2 ? '#dc2626' : '#2563eb'} />
          </mesh>
        ))}
        {[1.2, 1.7, 2.2].map((h) =>
          [0, 1, 2, 3].map((s) => (
            <mesh key={`${h}-${s}`} position={[s === 0 ? 0 : s === 1 ? 5 : s === 2 ? 0 : -5, h, s === 0 ? -5 : s === 1 ? 0 : s === 2 ? 5 : 0]} rotation-y={s % 2 ? Math.PI / 2 : 0}>
              <boxGeometry args={[10, 0.06, 0.06]} />
              <meshBasicMaterial color="#f8fafc" />
            </mesh>
          )),
        )}
      </group>
      <group position={[docks.x + 30, 0, docks.z + 25]} rotation-y={0.7}>
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[6, 0.4, 40]} />
          <meshLambertMaterial color="#8b5e34" />
        </mesh>
      </group>
      <mesh position={[gym.x, heightAt(gym.x, gym.z) + 11, gym.z + 9.2]}>
        <boxGeometry args={[14, 2.6, 0.4]} />
        <meshLambertMaterial color="#c9184a" emissive="#c9184a" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

export function Props() {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const crowns = useRef<THREE.InstancedMesh>(null);
  const pines = useRef<THREE.InstancedMesh>(null);
  const rocks = useRef<THREE.InstancedMesh>(null);
  const { trees, pineList, rockList } = useMemo(
    () => ({
      trees: PROPS.filter((p) => p.kind === 'tree'),
      pineList: PROPS.filter((p) => p.kind === 'pine'),
      rockList: PROPS.filter((p) => p.kind === 'rock'),
    }),
    [],
  );
  const woody = [...trees, ...pineList];
  useInstances(trunks, woody.length, (i, o, c) => {
    const p = woody[i];
    o.position.set(p.x, p.y + 1.2 * p.scale, p.z);
    o.scale.set(p.scale, p.scale, p.scale);
    c.set('#6f4e37');
  }, []);
  useInstances(crowns, trees.length, (i, o, c) => {
    const p = trees[i];
    o.position.set(p.x, p.y + 3.6 * p.scale, p.z);
    o.scale.setScalar(p.scale * 2.2);
    o.rotation.y = p.x;
    c.setHSL(0.27 + (Math.abs(p.z) % 7) * 0.008, 0.55, 0.36);
  }, []);
  useInstances(pines, pineList.length, (i, o, c) => {
    const p = pineList[i];
    o.position.set(p.x, p.y + 4.2 * p.scale, p.z);
    o.scale.set(p.scale * 1.9, p.scale * 5.2, p.scale * 1.9);
    c.setHSL(0.36, 0.45, p.y > 25 ? 0.42 : 0.26);
  }, []);
  useInstances(rocks, rockList.length, (i, o, c) => {
    const p = rockList[i];
    o.position.set(p.x, p.y + 0.3 * p.scale, p.z);
    o.scale.set(p.scale * 1.2, p.scale * 0.9, p.scale);
    o.rotation.set(p.x, p.z, 0);
    c.set('#8d99ae');
  }, []);
  return (
    <group>
      <instancedMesh ref={trunks} args={[undefined, undefined, woody.length]}>
        <cylinderGeometry args={[0.22, 0.32, 2.4, 5]} />
        <meshLambertMaterial flatShading />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, trees.length]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshLambertMaterial flatShading />
      </instancedMesh>
      <instancedMesh ref={pines} args={[undefined, undefined, pineList.length]}>
        <coneGeometry args={[1, 1, 6]} />
        <meshLambertMaterial flatShading />
      </instancedMesh>
      <instancedMesh ref={rocks} args={[undefined, undefined, rockList.length]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshLambertMaterial flatShading />
      </instancedMesh>
    </group>
  );
}
