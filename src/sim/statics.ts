// Static world colliders (buildings, trees, rocks), generated deterministically.
import { BUILDINGS, ZONES } from '../data/map';
import { Rng } from './rng';
import { heightAt, ISLAND_RADIUS, SEA_LEVEL } from './terrain';

export interface Box {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  baseY: number;
  topY: number;
}
export interface Circle {
  x: number;
  z: number;
  r: number;
  y: number;
  scale: number;
  kind: 'tree' | 'pine' | 'rock';
}

export const BOXES: Box[] = BUILDINGS.map((b) => {
  const corners = [
    heightAt(b.x - b.w / 2, b.z - b.d / 2),
    heightAt(b.x + b.w / 2, b.z - b.d / 2),
    heightAt(b.x - b.w / 2, b.z + b.d / 2),
    heightAt(b.x + b.w / 2, b.z + b.d / 2),
    heightAt(b.x, b.z),
  ];
  const baseY = Math.min(...corners) - 2;
  const topY = Math.max(...corners) + b.h;
  return { minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2, baseY, topY };
});

function insideAnyBox(x: number, z: number, pad: number) {
  return BOXES.some((b) => x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad);
}

function makeProps(): Circle[] {
  const rng = new Rng(4242);
  const out: Circle[] = [];
  const tryAdd = (x: number, z: number, kind: Circle['kind']) => {
    const y = heightAt(x, z);
    if (y < SEA_LEVEL + 1) return;
    if (Math.hypot(x, z) > ISLAND_RADIUS) return;
    if (insideAnyBox(x, z, 3)) return;
    // Keep town/arena/gym/docks plazas open
    for (const zn of ZONES) {
      if (zn.style === 'forest' || zn.style === 'mountain') continue;
      if (Math.hypot(x - zn.x, z - zn.z) < zn.r * 0.9 && kind !== 'rock') return;
    }
    const scale = kind === 'rock' ? rng.range(0.6, 2.2) : rng.range(0.8, 1.4);
    out.push({ x, z, y, r: kind === 'rock' ? 0.9 * scale : 0.45 * scale, scale, kind });
  };
  const forest = ZONES.find((z) => z.id === 'forest')!;
  for (let i = 0; i < 360; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = Math.sqrt(rng.next()) * forest.r * 1.3;
    tryAdd(forest.x + Math.cos(a) * r, forest.z + Math.sin(a) * r, rng.chance(0.6) ? 'pine' : 'tree');
  }
  for (let i = 0; i < 520; i++) {
    const x = rng.range(-ISLAND_RADIUS, ISLAND_RADIUS);
    const z = rng.range(-ISLAND_RADIUS, ISLAND_RADIUS);
    const h = heightAt(x, z);
    tryAdd(x, z, h > 22 ? 'pine' : rng.chance(0.25) ? 'rock' : rng.chance(0.5) ? 'pine' : 'tree');
  }
  return out;
}

export const PROPS: Circle[] = makeProps();

// Spatial grid for quick prop lookup
const CELL = 16;
const grid = new Map<number, Circle[]>();
const key = (cx: number, cz: number) => (cx + 100) * 1000 + (cz + 100);
for (const p of PROPS) {
  const k = key(Math.floor(p.x / CELL), Math.floor(p.z / CELL));
  let arr = grid.get(k);
  if (!arr) grid.set(k, (arr = []));
  arr.push(p);
}

export function propsNear(x: number, z: number, out: Circle[] = []): Circle[] {
  out.length = 0;
  const cx = Math.floor(x / CELL);
  const cz = Math.floor(z / CELL);
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++) {
      const arr = grid.get(key(cx + i, cz + j));
      if (arr) for (const p of arr) out.push(p);
    }
  return out;
}

/** Push a circle (x,z,r) out of buildings and props. Returns corrected position. */
export function resolveStatic(pos: { x: number; y: number; z: number }, r: number) {
  for (const b of BOXES) {
    if (pos.y > b.topY) continue;
    const nx = Math.max(b.minX, Math.min(pos.x, b.maxX));
    const nz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * r;
        pos.z = nz + (dz / d) * r;
      } else {
        // Centre inside the box: push out along the shallowest axis
        const l = pos.x - b.minX, rr = b.maxX - pos.x, t = pos.z - b.minZ, bb = b.maxZ - pos.z;
        const m = Math.min(l, rr, t, bb);
        if (m === l) pos.x = b.minX - r;
        else if (m === rr) pos.x = b.maxX + r;
        else if (m === t) pos.z = b.minZ - r;
        else pos.z = b.maxZ + r;
      }
    }
  }
  const near = propsNear(pos.x, pos.z, scratch);
  for (const p of near) {
    const dx = pos.x - p.x;
    const dz = pos.z - p.z;
    const rr = r + p.r;
    const d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 1e-6) {
      const d = Math.sqrt(d2);
      pos.x = p.x + (dx / d) * rr;
      pos.z = p.z + (dz / d) * rr;
    }
  }
}
const scratch: Circle[] = [];

/** True if the segment from a to b passes through a building (cheap line-of-sight for AI). */
export function blockedByBuilding(ax: number, az: number, bx: number, bz: number) {
  for (const b of BOXES) {
    // Slab test in 2D
    let tmin = 0, tmax = 1;
    const dx = bx - ax, dz = bz - az;
    for (const [o, d, mn, mx] of [[ax, dx, b.minX, b.maxX], [az, dz, b.minZ, b.maxZ]] as const) {
      if (Math.abs(d) < 1e-6) {
        if (o < mn || o > mx) { tmin = 2; break; }
      } else {
        let t1 = (mn - o) / d, t2 = (mx - o) / d;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) break;
      }
    }
    if (tmin <= tmax && tmin <= 1) return true;
  }
  return false;
}
