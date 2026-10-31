import { Rng } from '../sim/rng';

export interface Zone {
  id: string;
  name: string;
  x: number;
  z: number;
  r: number;
  /** Flatten ground to this height inside the zone (for buildings). */
  flat?: number;
  /** Add a mountain peak of this height. */
  peak?: number;
  /** Building style. */
  style: 'town' | 'gym' | 'arena' | 'docks' | 'forest' | 'mountain';
  /** Relative loot richness. */
  loot: number;
}

export const ZONES: Zone[] = [
  { id: 'town', name: 'Knuckle Town', x: 10, z: 20, r: 60, flat: 5, style: 'town', loot: 1.3 },
  { id: 'gym', name: 'Iron Gym', x: -150, z: -80, r: 38, flat: 6, style: 'gym', loot: 1.2 },
  { id: 'arena', name: 'Grand Arena', x: 150, z: -100, r: 42, flat: 5, style: 'arena', loot: 1.5 },
  { id: 'docks', name: 'Rusty Docks', x: 175, z: 150, r: 40, flat: 1.6, style: 'docks', loot: 1.0 },
  { id: 'forest', name: 'Whisper Woods', x: -150, z: 130, r: 70, style: 'forest', loot: 0.7 },
  { id: 'mountain', name: 'Summit Dojo', x: -10, z: -200, r: 60, peak: 42, style: 'mountain', loot: 1.1 },
];

export interface Building {
  x: number;
  z: number;
  w: number; // size along X
  d: number; // size along Z
  h: number;
  color: string;
  roof: string;
  zone: string;
}

const PALETTES: Record<Zone['style'], { walls: string[]; roofs: string[] }> = {
  town: { walls: ['#e8d6b0', '#d9a77a', '#c9d6df', '#f2c6a0', '#b7c9a8'], roofs: ['#b5443b', '#6b4e3d', '#3d5a80'] },
  gym: { walls: ['#4a4e69', '#6c757d'], roofs: ['#22223b', '#c9184a'] },
  arena: { walls: ['#e5e5e5', '#adb5bd'], roofs: ['#d00000', '#ffba08'] },
  docks: { walls: ['#7f5539', '#577590', '#9c6644'], roofs: ['#3a3a3a', '#264653'] },
  forest: { walls: ['#8d6346', '#a47148'], roofs: ['#4f3a2b', '#3a5a40'] },
  mountain: { walls: ['#f1e3d3', '#d8c3a5'], roofs: ['#9d0208', '#2b2d42'] },
};

function makeBuildings(): Building[] {
  const rng = new Rng(1337);
  const out: Building[] = [];
  const overlaps = (b: Building) =>
    out.some((o) => Math.abs(o.x - b.x) < (o.w + b.w) / 2 + 3 && Math.abs(o.z - b.z) < (o.d + b.d) / 2 + 3);
  const add = (zone: Zone, x: number, z: number, w: number, d: number, h: number) => {
    const p = PALETTES[zone.style];
    const b: Building = { x, z, w, d, h, color: rng.pick(p.walls), roof: rng.pick(p.roofs), zone: zone.id };
    if (!overlaps(b)) out.push(b);
  };
  for (const zone of ZONES) {
    switch (zone.style) {
      case 'town': {
        // Grid of houses around a central plaza.
        for (let gx = -2; gx <= 2; gx++)
          for (let gz = -2; gz <= 2; gz++) {
            if (Math.abs(gx) <= 0 && Math.abs(gz) <= 0) continue; // plaza
            if (rng.chance(0.2)) continue;
            add(zone, zone.x + gx * 20 + rng.range(-2, 2), zone.z + gz * 20 + rng.range(-2, 2), rng.range(7, 11), rng.range(7, 11), rng.range(4, 9));
          }
        break;
      }
      case 'gym':
        add(zone, zone.x, zone.z, 26, 18, 9);
        for (let i = 0; i < 4; i++) add(zone, zone.x + rng.range(-28, 28), zone.z + rng.range(-28, 28), rng.range(6, 9), rng.range(6, 9), rng.range(4, 6));
        break;
      case 'arena': {
        // Ring of stands with gaps (entrances).
        const n = 12;
        for (let i = 0; i < n; i++) {
          if (i % 3 === 0) continue;
          const a = (i / n) * Math.PI * 2;
          add(zone, zone.x + Math.cos(a) * 28, zone.z + Math.sin(a) * 28, 9, 9, 6);
        }
        break;
      }
      case 'docks':
        for (let i = 0; i < 5; i++) add(zone, zone.x + rng.range(-25, 25), zone.z + rng.range(-25, 25), rng.range(10, 16), rng.range(7, 10), rng.range(5, 8));
        break;
      case 'forest':
        for (let i = 0; i < 5; i++) add(zone, zone.x + rng.range(-55, 55), zone.z + rng.range(-55, 55), rng.range(5, 7), rng.range(5, 7), rng.range(3.5, 5));
        break;
      case 'mountain':
        for (let i = 0; i < 3; i++) {
          const a = rng.range(0, Math.PI * 2);
          add(zone, zone.x + Math.cos(a) * 55, zone.z + Math.sin(a) * 55, 8, 8, 5);
        }
        break;
    }
  }
  return out;
}

export const BUILDINGS: Building[] = makeBuildings();

export function zoneAt(x: number, z: number): Zone | null {
  for (const zn of ZONES) if (Math.hypot(x - zn.x, z - zn.z) < zn.r) return zn;
  return null;
}
