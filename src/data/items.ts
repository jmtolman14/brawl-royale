import type { ItemKind, Rarity } from '../sim/types';

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  rarity: Rarity;
  desc: string;
  /** Effect magnitude (hp, shield, % buff, damage) */
  amount: number;
  /** Seconds to consume (0 = instant). */
  useTime: number;
  /** Max per stack (or uses for throwables). */
  stack: number;
  /** Buff duration, seconds. */
  duration?: number;
  /** Visual shape for the 3D pickup. */
  shape: 'box' | 'cross' | 'can' | 'syringe' | 'belt' | 'roll' | 'knuck' | 'chair' | 'bottle' | 'vest';
  /** Spawn weight in the loot table. */
  weight: number;
}

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#b8bcc4',
  uncommon: '#4ade80',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

export const ITEMS: ItemDef[] = [
  { id: 'bandage', name: 'Bandage', kind: 'heal', rarity: 'common', desc: 'Restores 25 HP.', amount: 25, useTime: 1.5, stack: 5, shape: 'roll', weight: 30 },
  { id: 'medkit', name: 'Corner Medkit', kind: 'heal', rarity: 'rare', desc: 'Restores 75 HP.', amount: 75, useTime: 3, stack: 2, shape: 'cross', weight: 9 },
  { id: 'padding', name: 'Foam Padding', kind: 'shield', rarity: 'uncommon', desc: '+25 shield.', amount: 25, useTime: 1.5, stack: 4, shape: 'box', weight: 20 },
  { id: 'vest', name: 'Body Protector', kind: 'shield', rarity: 'epic', desc: '+60 shield.', amount: 60, useTime: 2.5, stack: 1, shape: 'vest', weight: 6 },
  { id: 'energy', name: 'Energy Drink', kind: 'stamina', rarity: 'common', desc: 'Refills stamina and boosts regen for 10s.', amount: 1, useTime: 0.8, stack: 3, duration: 10, shape: 'can', weight: 22 },
  { id: 'adrenaline', name: 'Adrenaline Shot', kind: 'adrenaline', rarity: 'epic', desc: '+25% speed and power for 12s.', amount: 0.25, useTime: 0.6, stack: 2, duration: 12, shape: 'syringe', weight: 6 },
  { id: 'wraps', name: 'Tape Wraps', kind: 'wraps', rarity: 'uncommon', desc: 'Equip for +12% strike damage for the rest of the match.', amount: 0.12, useTime: 1.2, stack: 1, shape: 'roll', weight: 12 },
  { id: 'knucks', name: 'Iron Knucks', kind: 'knucks', rarity: 'rare', desc: 'Equip for +25% strike damage (replaces wraps).', amount: 0.25, useTime: 1.2, stack: 1, shape: 'knuck', weight: 6 },
  { id: 'belt', name: 'Championship Belt', kind: 'belt', rarity: 'legendary', desc: '+15% damage, +15% defense, 2x hype. Everyone can see the champ on the map!', amount: 0.15, useTime: 1.0, stack: 1, shape: 'belt', weight: 1.2 },
  { id: 'bottle', name: 'Bottle', kind: 'throwable', rarity: 'common', desc: 'Throw with G. 10 damage. 3 uses.', amount: 10, useTime: 0, stack: 3, shape: 'bottle', weight: 16 },
  { id: 'chair', name: 'Folding Chair', kind: 'throwable', rarity: 'rare', desc: 'Throw with G. 20 damage + knockdown. 2 uses.', amount: 20, useTime: 0, stack: 2, shape: 'chair', weight: 8 },
];

export const ITEM_BY_ID: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
