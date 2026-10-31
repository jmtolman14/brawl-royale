import { ZONES } from '../data/map';
import { lerp, smoothstep } from './math';

export const MAP_HALF = 320;
export const ISLAND_RADIUS = 285;
export const SEA_LEVEL = 0;

function hash(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function valueNoise(x: number, z: number) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi);
  const b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1);
  const d = hash(xi + 1, zi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x: number, z: number) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < 4; i++) {
    sum += valueNoise(x * f, z * f) * amp;
    f *= 2;
    amp *= 0.5;
  }
  return sum;
}

/** Raw island shape before zone flattening. */
function rawHeight(x: number, z: number) {
  const d = Math.hypot(x, z);
  const warp = (fbm(x * 0.01 + 7, z * 0.01 - 3) - 0.5) * 70;
  const island = 1 - smoothstep(ISLAND_RADIUS - 70, ISLAND_RADIUS + 10, d + warp);
  let h = 3 + fbm(x * 0.012, z * 0.012) * 14;
  for (const zn of ZONES) {
    if (zn.peak) {
      const dd = Math.hypot(x - zn.x, z - zn.z);
      h += zn.peak * Math.exp(-(dd * dd) / (2 * (zn.r * 0.7) ** 2));
    }
  }
  return h * island - (1 - island) * 10;
}

/** Ground height at a world position. Shared by the simulation and the terrain mesh. */
export function heightAt(x: number, z: number): number {
  let h = rawHeight(x, z);
  for (const zn of ZONES) {
    if (zn.flat === undefined) continue;
    const dd = Math.hypot(x - zn.x, z - zn.z);
    const m = 1 - smoothstep(zn.r * 0.75, zn.r * 1.15, dd);
    if (m > 0) h = lerp(h, zn.flat, m);
  }
  return h;
}

export function isWater(x: number, z: number) {
  return heightAt(x, z) < SEA_LEVEL + 0.2;
}
