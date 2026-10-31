import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { onFx } from '../../game/fx';
import { session } from '../../game/session';
import { PLAYER_ID } from '../../sim/constants';
import { useSettings } from '../../store/settings';

interface P {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; max: number; size: number;
  r: number; g: number; b: number;
  grav: number;
}

const tmp = new THREE.Object3D();
const col = new THREE.Color();

/** Pooled, capped particle system drawn as one instanced mesh. */
export function Particles() {
  const quality = useSettings((s) => s.quality);
  const cap = quality === 'low' ? 120 : quality === 'medium' ? 260 : 450;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const pool = useMemo(() => [] as P[], []);

  useEffect(() => {
    const burst = (x: number, y: number, z: number, n: number, color: string, speed: number, size: number, grav = 18, up = 2) => {
      col.set(color);
      for (let i = 0; i < n; i++) {
        if (pool.length >= cap) pool.shift();
        const a = Math.random() * Math.PI * 2;
        const e = (Math.random() - 0.3) * Math.PI;
        const s = speed * (0.4 + Math.random() * 0.6);
        pool.push({
          x, y, z,
          vx: Math.cos(a) * Math.cos(e) * s, vy: Math.sin(e) * s + up, vz: Math.sin(a) * Math.cos(e) * s,
          life: 0, max: 0.35 + Math.random() * 0.35, size: size * (0.6 + Math.random() * 0.6),
          r: col.r, g: col.g, b: col.b, grav,
        });
      }
    };
    return onFx((e) => {
      const w = session.runner?.world;
      if (!w) return;
      switch (e.type) {
        case 'hit':
          if (e.blocked) burst(e.x, e.y, e.z, 6, '#9ad1ff', 5, 0.08);
          else {
            burst(e.x, e.y, e.z, e.heavy ? 18 : 9, e.shield ? '#60a5fa' : '#fff3b0', e.heavy ? 9 : 6, 0.1);
            burst(e.x, e.y, e.z, e.heavy ? 6 : 3, '#ff6b35', 4, 0.12);
          }
          if (e.attacker === PLAYER_ID || e.target === PLAYER_ID) session.shake = Math.max(session.shake, e.blocked ? 0.06 : e.heavy ? 0.35 : 0.15);
          break;
        case 'parry':
          burst(e.x, e.y, e.z, 16, '#e0f2fe', 8, 0.09, 4, 0);
          if (e.attacker === PLAYER_ID || e.target === PLAYER_ID) session.shake = Math.max(session.shake, 0.2);
          break;
        case 'throw': {
          burst(e.x, e.y - 0.4, e.z, 22, '#c8b08a', 7, 0.16, 12, 3);
          if (e.attacker === PLAYER_ID || e.target === PLAYER_ID) session.shake = Math.max(session.shake, 0.45);
          break;
        }
        case 'knockdown': {
          const f = w.fighters[e.target];
          burst(f.pos.x, f.pos.y + 0.2, f.pos.z, 10, '#c8b08a', 4, 0.14, 8, 1);
          break;
        }
        case 'ko': {
          const f = w.fighters[e.target];
          burst(f.pos.x, f.pos.y + 1, f.pos.z, 30, '#ffd60a', 10, 0.12, 10, 4);
          break;
        }
        case 'crate':
          burst(e.x, e.y + 0.6, e.z, 16, '#a47148', 6, 0.14, 16, 4);
          break;
        case 'land': {
          const f = w.fighters[e.fighter];
          burst(f.pos.x, f.pos.y + 0.1, f.pos.z, 14, '#e9d8a6', 5, 0.15, 6, 1);
          break;
        }
        case 'finisher':
        case 'signature': {
          const f = w.fighters[e.fighter];
          burst(f.pos.x, f.pos.y + 1.2, f.pos.z, e.type === 'finisher' ? 40 : 14, e.type === 'finisher' ? '#ffd60a' : '#f72585', 7, 0.1, 2, 2);
          break;
        }
        case 'use': {
          const f = w.fighters[e.fighter];
          burst(f.pos.x, f.pos.y + 1, f.pos.z, 12, e.itemId === 'padding' || e.itemId === 'vest' ? '#60a5fa' : '#4ade80', 3, 0.08, -3, 1);
          break;
        }
      }
    });
  }, [cap, pool]);

  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    let n = 0;
    for (let i = pool.length - 1; i >= 0; i--) {
      const p = pool[i];
      p.life += dt;
      if (p.life >= p.max) {
        pool.splice(i, 1);
        continue;
      }
      p.vy -= p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
    }
    for (const p of pool) {
      const k = 1 - p.life / p.max;
      tmp.position.set(p.x, p.y, p.z);
      tmp.scale.setScalar(p.size * k);
      tmp.rotation.set(p.life * 7, p.life * 5, 0);
      tmp.updateMatrix();
      m.setMatrixAt(n, tmp.matrix);
      m.setColorAt(n, col.setRGB(p.r, p.g, p.b));
      n++;
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, cap]} frustumCulled={false}>
      <boxGeometry />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
