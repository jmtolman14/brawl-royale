import { getFighter } from '../data/fighters';
import type { FighterState } from './types';

export interface Derived {
  maxHp: number;
  speed: number;
  power: number;
  defense: number; // damage multiplier taken (lower = tankier)
  maxStamina: number;
  staminaRegen: number;
  grapple: number;
  range: number;
  knockbackTaken: number;
  knockbackDealt: number;
  poiseMax: number;
  hype: number;
  lightSpeed: number; // animation speed multiplier for lights
}

const cache = new Map<string, Derived>();

/** Stats that only depend on the roster entry (stats + passive). */
export function baseDerived(rosterId: string): Derived {
  const hit = cache.get(rosterId);
  if (hit) return hit;
  const def = getFighter(rosterId);
  const s = def.stats;
  const p = def.passive;
  const d: Derived = {
    maxHp: 80 + s.health * 8,
    speed: 4.4 + s.speed * 0.33,
    power: 0.7 + s.power * 0.06,
    defense: 1 - s.defense * 0.025,
    maxStamina: 60 + s.stamina * 8,
    staminaRegen: 0.75 + s.stamina * 0.05,
    grapple: 0.6 + s.grapple * 0.07,
    range: 1,
    knockbackTaken: 1.25 - def.body.width * 0.25,
    knockbackDealt: 0.8 + def.body.width * 0.2,
    poiseMax: 30 + s.defense * 4 + (def.body.width - 1) * 60,
    hype: 1,
    lightSpeed: 1,
  };
  if (p === 'quick_hands') d.lightSpeed = 1.25;
  if (p === 'well_rounded') {
    d.power *= 1.1;
    d.defense *= 0.9;
  }
  if (p === 'cardio_machine') d.staminaRegen *= 1.4;
  if (p === 'grip_strength') d.grapple *= 1.2;
  if (p === 'immovable') {
    d.knockbackTaken *= 0.4;
    d.poiseMax *= 2;
  }
  if (p === 'heavyweight') d.knockbackDealt *= 1.5;
  if (p === 'crowd_favorite') d.hype *= 2;
  if (p === 'long_limbs') d.range = 1.2;
  cache.set(rosterId, d);
  return d;
}

export const hasBuff = (f: FighterState, kind: FighterState['buffs'][number]['kind']) => f.buffs.some((b) => b.kind === kind);
export const passiveOf = (f: FighterState) => getFighter(f.rosterId).passive;

/** Effective speed including buffs/debuffs. */
export function speedOf(f: FighterState) {
  let s = baseDerived(f.rosterId).speed;
  if (hasBuff(f, 'adrenaline')) s *= 1.25;
  if (hasBuff(f, 'slow')) s *= 0.6;
  return s;
}

export function powerOf(f: FighterState) {
  let p = baseDerived(f.rosterId).power;
  if (hasBuff(f, 'adrenaline')) p *= 1.25;
  if (hasBuff(f, 'champion')) p *= 1.15;
  if (hasBuff(f, 'knucks')) p *= 1.25;
  else if (hasBuff(f, 'wraps')) p *= 1.12;
  return p;
}

export function defenseOf(f: FighterState) {
  let d = baseDerived(f.rosterId).defense;
  if (hasBuff(f, 'champion')) d *= 0.85;
  return d;
}

export function hypeMulOf(f: FighterState) {
  let h = baseDerived(f.rosterId).hype;
  if (hasBuff(f, 'champion')) h *= 2;
  return h;
}
