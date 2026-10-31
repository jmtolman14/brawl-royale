import { useMemo } from 'react';
import * as THREE from 'three';
import { heightAt, MAP_HALF, SEA_LEVEL } from '../sim/terrain';
import { useSettings } from '../store/settings';

const SAND = new THREE.Color('#e9d8a6');
const GRASS = new THREE.Color('#7cb518');
const GRASS2 = new THREE.Color('#55a630');
const DIRT = new THREE.Color('#b08968');
const ROCK = new THREE.Color('#8a817c');
const SNOW = new THREE.Color('#f8f9fa');
const SEABED = new THREE.Color('#c2a878');

export function Terrain() {
  const quality = useSettings((s) => s.quality);
  const geom = useMemo(() => {
    const seg = quality === 'low' ? 120 : quality === 'medium' ? 180 : 240;
    const g = new THREE.PlaneGeometry(MAP_HALF * 2 + 120, MAP_HALF * 2 + 120, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = heightAt(x, z);
      pos.setY(i, h);
      const slope = Math.abs(heightAt(x + 2, z) - h) + Math.abs(heightAt(x, z + 2) - h);
      const n = (Math.sin(x * 0.11) * Math.cos(z * 0.13) + 1) * 0.5;
      if (h < SEA_LEVEL - 0.5) c.copy(SEABED);
      else if (h < SEA_LEVEL + 2.2) c.copy(SAND);
      else if (h > 40) c.copy(SNOW);
      else if (slope > 2.6 || h > 28) c.copy(ROCK);
      else c.copy(GRASS).lerp(GRASS2, n).lerp(DIRT, slope > 1.6 ? 0.4 : 0);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, [quality]);
  return (
    <mesh geometry={geom} receiveShadow>
      <meshLambertMaterial vertexColors flatShading />
    </mesh>
  );
}

export function Water() {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={SEA_LEVEL - 0.15}>
      <planeGeometry args={[3000, 3000]} />
      <meshLambertMaterial color="#2a9df4" transparent opacity={0.82} />
    </mesh>
  );
}
