import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ITEM_BY_ID, RARITY_COLOR, type ItemDef } from '../data/items';
import { session } from '../game/session';
import type { GroundItem } from '../sim/types';

const MAX_ITEMS = 60;
const SHAPES: ItemDef['shape'][] = ['box', 'cross', 'can', 'syringe', 'belt', 'roll', 'knuck', 'chair', 'bottle', 'vest'];

const GEOM: Record<ItemDef['shape'], THREE.BufferGeometry> = {
  box: new THREE.BoxGeometry(0.45, 0.3, 0.3),
  cross: new THREE.BoxGeometry(0.5, 0.32, 0.3),
  can: new THREE.CylinderGeometry(0.11, 0.11, 0.32, 10),
  syringe: new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6).rotateZ(Math.PI / 2),
  belt: new THREE.TorusGeometry(0.28, 0.07, 6, 16),
  roll: new THREE.CylinderGeometry(0.16, 0.16, 0.14, 12).rotateX(Math.PI / 2),
  knuck: new THREE.TorusGeometry(0.16, 0.06, 6, 10),
  chair: new THREE.BoxGeometry(0.45, 0.6, 0.08),
  bottle: new THREE.CylinderGeometry(0.06, 0.1, 0.42, 8),
  vest: new THREE.BoxGeometry(0.45, 0.5, 0.2),
};
const BASE: Record<string, string> = {
  bandage: '#f5f5f4', medkit: '#ef4444', padding: '#60a5fa', vest: '#2563eb', energy: '#facc15', adrenaline: '#f97316',
  wraps: '#e7e5e4', knucks: '#9ca3af', belt: '#fbbf24', bottle: '#16a34a', chair: '#9ca3af',
};

const tmp = new THREE.Object3D();
const col = new THREE.Color();

export function LootMeshes() {
  const meshes = useRef<Partial<Record<ItemDef['shape'], THREE.InstancedMesh>>>({});
  const rings = useRef<THREE.InstancedMesh>(null);
  const beams = useRef<THREE.InstancedMesh>(null);
  const crates = useRef<THREE.InstancedMesh>(null);
  const lids = useRef<THREE.InstancedMesh>(null);
  const proj = useRef<THREE.InstancedMesh>(null);
  const near = useRef<GroundItem[]>([]);
  const frame = useRef(0);
  const crateCount = session.runner?.world.crates.length ?? 0;
  const ringGeom = useMemo(() => new THREE.RingGeometry(0.35, 0.55, 20).rotateX(-Math.PI / 2), []);

  useFrame((state) => {
    const r = session.runner;
    if (!r) return;
    const w = r.world;
    const t = state.clock.elapsedTime;
    const me = w.fighters[session.cameraTarget] ?? w.fighters[0];
    // Re-pick nearest items a few times per second
    if (frame.current++ % 10 === 0) {
      near.current = w.items
        .map((it) => ({ it, d: (it.x - me.pos.x) ** 2 + (it.z - me.pos.z) ** 2 }))
        .filter((e) => e.d < 90 * 90)
        .sort((a, b) => a.d - b.d)
        .slice(0, MAX_ITEMS)
        .map((e) => e.it);
    }
    const counts: Record<string, number> = {};
    let nRings = 0;
    let nBeams = 0;
    for (const it of near.current) {
      const def = ITEM_BY_ID[it.itemId];
      if (!def) continue;
      const m = meshes.current[def.shape];
      if (!m) continue;
      const i = (counts[def.shape] = (counts[def.shape] ?? 0) + 1) - 1;
      tmp.position.set(it.x, it.y + 0.55 + Math.sin(t * 2 + it.uid) * 0.08, it.z);
      tmp.rotation.set(0, t * 1.5 + it.uid, 0);
      tmp.scale.setScalar(def.rarity === 'legendary' ? 1.6 : 1.15);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
      m.setColorAt(i, col.set(BASE[def.id] ?? '#ffffff'));
      const rc = RARITY_COLOR[def.rarity];
      tmp.position.set(it.x, it.y + 0.06, it.z);
      tmp.rotation.set(0, 0, 0);
      tmp.scale.setScalar(1 + Math.sin(t * 3 + it.uid) * 0.08);
      tmp.updateMatrix();
      rings.current!.setMatrixAt(nRings, tmp.matrix);
      rings.current!.setColorAt(nRings++, col.set(rc));
      if (def.rarity !== 'common' && def.rarity !== 'uncommon') {
        tmp.position.set(it.x, it.y + 3, it.z);
        tmp.scale.set(1, 1, 1);
        tmp.updateMatrix();
        beams.current!.setMatrixAt(nBeams, tmp.matrix);
        beams.current!.setColorAt(nBeams++, col.set(rc));
      }
    }
    for (const s of SHAPES) {
      const m = meshes.current[s];
      if (!m) continue;
      m.count = counts[s] ?? 0;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    for (const m of [rings.current!, beams.current!]) {
      m.count = m === rings.current ? nRings : nBeams;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    // Crates (all; cheap single draw call each)
    const cm = crates.current, lm = lids.current;
    if (cm && lm) {
    w.crates.forEach((c, i) => {
      tmp.rotation.set(0, c.uid, 0);
      tmp.position.set(c.x, c.y + (c.opened ? 0.3 : 0.45), c.z);
      tmp.scale.set(1.1, c.opened ? 0.6 : 0.9, 0.8);
      tmp.updateMatrix();
      cm.setMatrixAt(i, tmp.matrix);
      cm.setColorAt(i, col.set(c.opened ? '#5c3d24' : c.tier ? '#b45309' : '#8b5a2b'));
      tmp.position.set(c.x, c.opened ? -50 : c.y + 0.92, c.z);
      tmp.scale.set(1.18, 0.1, 0.88);
      tmp.updateMatrix();
      lm.setMatrixAt(i, tmp.matrix);
      lm.setColorAt(i, col.set(c.tier ? '#fbbf24' : '#d4a373'));
    });
    cm.instanceMatrix.needsUpdate = lm.instanceMatrix.needsUpdate = true;
    if (cm.instanceColor) cm.instanceColor.needsUpdate = true;
    if (lm.instanceColor) lm.instanceColor.needsUpdate = true;
    }
    // Thrown props
    const pm = proj.current!;
    let n = 0;
    for (const p of w.projectiles) {
      if (n >= 16) break;
      tmp.position.set(p.pos.x, p.pos.y, p.pos.z);
      tmp.rotation.set(t * 12, t * 9, 0);
      const chair = p.itemId === 'chair';
      tmp.scale.set(chair ? 0.5 : 0.14, chair ? 0.6 : 0.42, chair ? 0.1 : 0.14);
      tmp.updateMatrix();
      pm.setMatrixAt(n, tmp.matrix);
      pm.setColorAt(n++, col.set(chair ? '#9ca3af' : '#16a34a'));
    }
    pm.count = n;
    pm.instanceMatrix.needsUpdate = true;
    if (pm.instanceColor) pm.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      {SHAPES.map((s) => (
        <instancedMesh key={s} ref={(m) => { if (m) meshes.current[s] = m; }} args={[GEOM[s], undefined, MAX_ITEMS]} frustumCulled={false}>
          <meshToonMaterial />
        </instancedMesh>
      ))}
      <instancedMesh ref={rings} args={[ringGeom, undefined, MAX_ITEMS]} frustumCulled={false}>
        <meshBasicMaterial transparent opacity={0.85} toneMapped={false} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={beams} args={[undefined, undefined, MAX_ITEMS]} frustumCulled={false}>
        <cylinderGeometry args={[0.08, 0.25, 6, 8, 1, true]} />
        <meshBasicMaterial transparent opacity={0.3} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
      </instancedMesh>
      {crateCount > 0 && (
        <>
          <instancedMesh ref={crates} args={[undefined, undefined, crateCount]}>
            <boxGeometry />
            <meshLambertMaterial />
          </instancedMesh>
          <instancedMesh ref={lids} args={[undefined, undefined, crateCount]}>
            <boxGeometry />
            <meshLambertMaterial />
          </instancedMesh>
        </>
      )}
      <instancedMesh ref={proj} args={[undefined, undefined, 16]} frustumCulled={false}>
        <boxGeometry />
        <meshToonMaterial />
      </instancedMesh>
    </group>
  );
}
