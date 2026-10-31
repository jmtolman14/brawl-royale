// Pre-rendered top-down island image shared by the minimap and full map.
import { BUILDINGS } from '../data/map';
import { heightAt, MAP_HALF, SEA_LEVEL } from '../sim/terrain';

let cached: HTMLCanvasElement | null = null;
export const MAP_PX = 512;

export function worldToMap(x: number, z: number, size = MAP_PX) {
  return { x: ((x + MAP_HALF) / (MAP_HALF * 2)) * size, y: ((z + MAP_HALF) / (MAP_HALF * 2)) * size };
}

export function getMapImage(): HTMLCanvasElement {
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = c.height = MAP_PX;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(MAP_PX, MAP_PX);
  for (let py = 0; py < MAP_PX; py++) {
    for (let px = 0; px < MAP_PX; px++) {
      const x = (px / MAP_PX) * MAP_HALF * 2 - MAP_HALF;
      const z = (py / MAP_PX) * MAP_HALF * 2 - MAP_HALF;
      const h = heightAt(x, z);
      let r: number, g: number, b: number;
      if (h < SEA_LEVEL - 4) [r, g, b] = [30, 110, 190];
      else if (h < SEA_LEVEL) [r, g, b] = [56, 150, 220];
      else if (h < SEA_LEVEL + 2.2) [r, g, b] = [233, 216, 166];
      else if (h > 40) [r, g, b] = [240, 240, 245];
      else if (h > 26) [r, g, b] = [138, 129, 124];
      else {
        const k = Math.min(1, h / 26);
        [r, g, b] = [110 - k * 30, 175 - k * 40, 40 + k * 10];
      }
      const i = (py * MAP_PX + px) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  ctx.fillStyle = '#4b5563';
  for (const b of BUILDINGS) {
    const p = worldToMap(b.x - b.w / 2, b.z - b.d / 2);
    const s = (MAP_PX / (MAP_HALF * 2));
    ctx.fillRect(p.x, p.y, b.w * s, b.d * s);
  }
  cached = c;
  return c;
}
