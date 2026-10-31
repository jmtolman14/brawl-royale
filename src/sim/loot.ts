import { ITEMS, ITEM_BY_ID, type ItemDef } from '../data/items';
import { BUILDINGS, ZONES } from '../data/map';
import { FIGHTER_RADIUS, MAX_SHIELD, PICKUP_RANGE } from './constants';
import type { SimCtx } from './ctx';
import { addHype } from './hype';
import { yawToDir } from './math';
import { Rng } from './rng';
import { BOXES, resolveStatic } from './statics';
import { heightAt, ISLAND_RADIUS, SEA_LEVEL } from './terrain';
import type { FighterState, WorldState } from './types';

const RARITY_BIAS: Record<string, number> = { common: 1, uncommon: 1, rare: 1.6, epic: 2.4, legendary: 3 };

export function rollItem(rng: Rng, tier: number): ItemDef {
  let total = 0;
  const weights = ITEMS.map((i) => {
    const w = i.weight * (tier > 0 ? RARITY_BIAS[i.rarity] : 1);
    total += w;
    return w;
  });
  let r = rng.next() * total;
  for (let i = 0; i < ITEMS.length; i++) {
    r -= weights[i];
    if (r <= 0) return ITEMS[i];
  }
  return ITEMS[0];
}

function spawnItem(w: WorldState, itemId: string, count: number, x: number, z: number) {
  const p = { x, y: 0, z };
  resolveStatic(p, 0.6);
  w.items.push({ uid: w.nextUid++, itemId, count, x: p.x, y: heightAt(p.x, p.z), z: p.z });
}

/** Populate the island with crates and floor loot. */
export function spawnLoot(w: WorldState, seed: number) {
  const rng = new Rng(seed ^ 0x51ab);
  // Crates next to buildings
  for (const b of BUILDINGS) {
    const zone = ZONES.find((z) => z.id === b.zone)!;
    const n = rng.chance(0.5 * zone.loot) ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const side = rng.int(0, 3);
      const off = 1.6;
      const x = side === 0 ? b.x - b.w / 2 - off : side === 1 ? b.x + b.w / 2 + off : b.x + rng.range(-b.w / 2, b.w / 2);
      const z = side === 2 ? b.z - b.d / 2 - off : side === 3 ? b.z + b.d / 2 + off : b.z + rng.range(-b.d / 2, b.d / 2);
      if (heightAt(x, z) < SEA_LEVEL + 0.5) continue;
      w.crates.push({ uid: w.nextUid++, x, z, y: heightAt(x, z), opened: false, tier: rng.chance(0.12 * zone.loot) ? 1 : 0 });
    }
  }
  // Floor loot clustered in zones
  for (const zone of ZONES) {
    const n = Math.round(14 * zone.loot);
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = Math.sqrt(rng.next()) * zone.r;
      const x = zone.x + Math.cos(a) * r;
      const z = zone.z + Math.sin(a) * r;
      if (heightAt(x, z) < SEA_LEVEL + 0.5) continue;
      const it = rollItem(rng, 0);
      spawnItem(w, it.id, it.kind === 'throwable' ? it.stack : 1, x, z);
    }
  }
  // Sparse loot in the wilds
  for (let i = 0; i < 70; i++) {
    const x = rng.range(-ISLAND_RADIUS, ISLAND_RADIUS);
    const z = rng.range(-ISLAND_RADIUS, ISLAND_RADIUS);
    if (heightAt(x, z) < SEA_LEVEL + 1 || Math.hypot(x, z) > ISLAND_RADIUS - 20) continue;
    const it = rollItem(rng, 0);
    spawnItem(w, it.id, it.kind === 'throwable' ? it.stack : 1, x, z);
  }
  // A single Championship Belt in the arena, on a pedestal-crate
  const arena = ZONES.find((z) => z.id === 'arena')!;
  spawnItem(w, 'belt', 1, arena.x, arena.z);
}

/** Add an item stack to the fighter's hotbar. Returns leftover count (0 = all picked). */
export function addToInventory(f: FighterState, itemId: string, count: number): number {
  const def = ITEM_BY_ID[itemId];
  if (!def) return count;
  for (const s of f.inventory) {
    if (s && s.itemId === itemId && s.count < def.stack) {
      const take = Math.min(def.stack - s.count, count);
      s.count += take;
      count -= take;
      if (count === 0) return 0;
    }
  }
  for (let i = 0; i < f.inventory.length; i++) {
    if (!f.inventory[i]) {
      f.inventory[i] = { itemId, count: Math.min(count, def.stack) };
      count -= f.inventory[i]!.count;
      if (count <= 0) return 0;
    }
  }
  return count;
}

export function nearestPickup(w: WorldState, f: FighterState) {
  let best: { kind: 'item' | 'crate'; idx: number; d: number } | null = null;
  for (let i = 0; i < w.items.length; i++) {
    const it = w.items[i];
    const d = Math.hypot(it.x - f.pos.x, it.z - f.pos.z);
    if (d < PICKUP_RANGE && Math.abs(it.y - f.pos.y) < 2.5 && (!best || d < best.d)) best = { kind: 'item', idx: i, d };
  }
  for (let i = 0; i < w.crates.length; i++) {
    const c = w.crates[i];
    if (c.opened) continue;
    const d = Math.hypot(c.x - f.pos.x, c.z - f.pos.z);
    if (d < PICKUP_RANGE + 0.4 && (!best || d < best.d)) best = { kind: 'crate', idx: i, d };
  }
  return best;
}

/** Try to pick up an item or open a crate. Returns true if something happened. */
export function tryPickup(ctx: SimCtx, f: FighterState): boolean {
  const w = ctx.w;
  const np = nearestPickup(w, f);
  if (!np) return false;
  if (np.kind === 'crate') {
    const c = w.crates[np.idx];
    c.opened = true;
    const n = c.tier ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const it = rollItem(ctx.rng, c.tier);
      const a = (i / n) * Math.PI * 2 + ctx.rng.range(0, 1);
      spawnItem(w, it.id, it.kind === 'throwable' ? it.stack : 1, c.x + Math.cos(a) * 1.3, c.z + Math.sin(a) * 1.3);
    }
    ctx.ev.emit({ type: 'crate', fighter: f.id, x: c.x, y: c.y, z: c.z });
    return true;
  }
  const it = w.items[np.idx];
  const left = addToInventory(f, it.itemId, it.count);
  if (left === it.count) {
    // Full: swap with the selected slot
    const cur = f.inventory[f.slot];
    if (!cur) return false;
    f.inventory[f.slot] = { itemId: it.itemId, count: it.count };
    it.itemId = cur.itemId;
    it.count = cur.count;
    ctx.ev.emit({ type: 'pickup', fighter: f.id, itemId: f.inventory[f.slot]!.itemId });
    return true;
  }
  ctx.ev.emit({ type: 'pickup', fighter: f.id, itemId: it.itemId });
  if (left === 0) w.items.splice(np.idx, 1);
  else it.count = left;
  return true;
}

export function canUseSelected(f: FighterState): ItemDef | null {
  const s = f.inventory[f.slot];
  if (!s) return null;
  const def = ITEM_BY_ID[s.itemId];
  if (!def || def.kind === 'throwable') return null;
  if (def.kind === 'heal' && f.hp >= f.maxHp) return null;
  if (def.kind === 'shield' && f.shield >= MAX_SHIELD) return null;
  return def;
}

function consumeSlotItem(f: FighterState, itemId: string) {
  const idx = f.inventory[f.slot]?.itemId === itemId ? f.slot : f.inventory.findIndex((s) => s?.itemId === itemId);
  if (idx < 0) return false;
  const s = f.inventory[idx]!;
  s.count--;
  if (s.count <= 0) f.inventory[idx] = null;
  return true;
}

export function finishUse(ctx: SimCtx, f: FighterState) {
  const def = f.useItemId ? ITEM_BY_ID[f.useItemId] : null;
  f.useItemId = null;
  if (!def || !consumeSlotItem(f, def.id)) return;
  const setBuff = (kind: FighterState['buffs'][number]['kind'], time: number) => {
    f.buffs = f.buffs.filter((b) => b.kind !== kind);
    f.buffs.push({ kind, time });
  };
  switch (def.kind) {
    case 'heal':
      f.hp = Math.min(f.maxHp, f.hp + def.amount);
      break;
    case 'shield':
      f.shield = Math.min(MAX_SHIELD, f.shield + def.amount);
      break;
    case 'stamina':
      f.stamina = f.maxStamina;
      setBuff('energy', def.duration ?? 10);
      break;
    case 'adrenaline':
      setBuff('adrenaline', def.duration ?? 12);
      break;
    case 'wraps':
      if (!f.buffs.some((b) => b.kind === 'knucks')) setBuff('wraps', Infinity);
      break;
    case 'knucks':
      f.buffs = f.buffs.filter((b) => b.kind !== 'wraps');
      setBuff('knucks', Infinity);
      break;
    case 'belt':
      setBuff('champion', Infinity);
      ctx.w.championId = f.id;
      addHype(ctx, f, 30);
      ctx.ev.emit({ type: 'champion', fighter: f.id });
      break;
  }
  ctx.ev.emit({ type: 'use', fighter: f.id, itemId: def.id });
}

/** Throw the selected throwable (or the first one in the hotbar). */
export function throwItem(ctx: SimCtx, f: FighterState): boolean {
  let idx = f.inventory[f.slot] && ITEM_BY_ID[f.inventory[f.slot]!.itemId]?.kind === 'throwable' ? f.slot : -1;
  if (idx < 0) idx = f.inventory.findIndex((s) => s && ITEM_BY_ID[s.itemId]?.kind === 'throwable');
  if (idx < 0) return false;
  const s = f.inventory[idx]!;
  const dir = yawToDir(f.yaw);
  let vy = 3.5;
  const t = f.lockTarget >= 0 ? ctx.w.fighters[f.lockTarget] : null;
  if (t && t.alive) {
    const d = Math.hypot(t.pos.x - f.pos.x, t.pos.z - f.pos.z);
    vy = 2 + d * 0.18 + (t.pos.y - f.pos.y) * 0.5;
  }
  ctx.w.projectiles.push({
    uid: ctx.w.nextUid++, owner: f.id, itemId: s.itemId,
    pos: { x: f.pos.x + dir.x * 0.8, y: f.pos.y + 1.5, z: f.pos.z + dir.z * 0.8 },
    vel: { x: dir.x * 24, y: vy, z: dir.z * 24 }, life: 3,
  });
  s.count--;
  if (s.count <= 0) f.inventory[idx] = null;
  ctx.ev.emit({ type: 'swing', attacker: f.id, heavy: false });
  return true;
}

export function dropInventory(ctx: SimCtx, f: FighterState) {
  const w = ctx.w;
  let i = 0;
  const drop = (itemId: string, count: number) => {
    const a = i++ * 1.3;
    spawnItem(w, itemId, count, f.pos.x + Math.cos(a) * 1.4, f.pos.z + Math.sin(a) * 1.4);
  };
  for (let k = 0; k < f.inventory.length; k++) {
    const s = f.inventory[k];
    if (s) drop(s.itemId, s.count);
    f.inventory[k] = null;
  }
  if (f.buffs.some((b) => b.kind === 'champion')) drop('belt', 1);
  if (f.buffs.some((b) => b.kind === 'knucks')) drop('knucks', 1);
  f.buffs = [];
}

export function updateProjectiles(ctx: SimCtx, dt: number, applyHit: (owner: FighterState, target: FighterState, def: ItemDef, x: number, y: number, z: number) => void) {
  const w = ctx.w;
  for (let i = w.projectiles.length - 1; i >= 0; i--) {
    const p = w.projectiles[i];
    p.vel.y -= 14 * dt;
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;
    p.pos.z += p.vel.z * dt;
    p.life -= dt;
    let dead = p.life <= 0 || p.pos.y < heightAt(p.pos.x, p.pos.z);
    if (!dead) {
      for (const b of BOXES) {
        if (p.pos.x > b.minX && p.pos.x < b.maxX && p.pos.z > b.minZ && p.pos.z < b.maxZ && p.pos.y < b.topY) {
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const f of w.fighters) {
        if (f.id === p.owner || !f.alive || f.state === 'bus' || f.state === 'glide') continue;
        const dx = f.pos.x - p.pos.x;
        const dz = f.pos.z - p.pos.z;
        const dy = f.pos.y + 1 - p.pos.y;
        if (dx * dx + dz * dz < (FIGHTER_RADIUS + 0.4) ** 2 && Math.abs(dy) < 1.3) {
          const owner = w.fighters[p.owner];
          applyHit(owner, f, ITEM_BY_ID[p.itemId], p.pos.x, p.pos.y, p.pos.z);
          dead = true;
          break;
        }
      }
    }
    if (dead) w.projectiles.splice(i, 1);
  }
}
