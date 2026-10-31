import { FIGHTERS, getFighter } from '../data/fighters';
import { PLAYER_ID, HOTBAR_SLOTS } from './constants';
import { Rng } from './rng';
import { baseDerived } from './stats';
import { heightAt } from './terrain';
import type { FighterState, GameEvent, WorldState } from './types';

export interface MatchOptions {
  seed: number;
  playerRoster: string;
  playerName?: string;
  botCount: number;
  /** Skip the bus and spawn on the ground (training mode / tests). */
  skipBus?: boolean;
  /** Skip loot/ring (training). */
  training?: boolean;
  botSkill?: number; // 0..1 average
}

const BOT_NAMES = [
  'Slugger', 'Brickwall', 'Lefty', 'Mauler', 'Dynamo', 'Sledge', 'Viper', 'Rumble', 'Ox', 'Blitz',
  'Grizzly', 'Hammer', 'Jinx', 'Kodiak', 'Mongoose', 'Nitro', 'Onyx', 'Piston', 'Quake', 'Riot',
  'Saber', 'Tornado', 'Uppercut', 'Vandal', 'Wrecker', 'Yeti', 'Zephyr', 'Bulldog', 'Cobra', 'Diesel',
];

export function makeFighter(id: number, rosterId: string, name: string, isBot: boolean, skill: number, x: number, z: number): FighterState {
  const d = baseDerived(rosterId);
  const y = heightAt(x, z);
  return {
    id, rosterId, name, isBot, skill,
    pos: { x, y, z }, prevPos: { x, y, z }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, onGround: true,
    hp: d.maxHp, maxHp: d.maxHp, shield: 0, stamina: d.maxStamina, maxStamina: d.maxStamina, staminaLockUntil: 0,
    state: 'idle', stateTime: 0, stateDur: 0, move: null, hitIds: [], comboStep: 0, comboUntil: 0, buffered: null,
    blockStart: -10, poise: d.poiseMax, grappleWith: -1, invulnUntil: 0,
    hype: 0, sigReadyAt: 0,
    inventory: Array.from({ length: HOTBAR_SLOTS }, () => null), slot: 0, useItemId: null, buffs: [],
    alive: true, kills: 0, damageDealt: 0, placement: 0, lastHitBy: -1, lastHitAt: -10, lockTarget: -1,
    moveSpeed: 1, dodgeX: 0, dodgeZ: 0, lastCombatAt: -100, counterReady: false, hitIndex: -1, ai: {},
  };
}

export function createWorld(opts: MatchOptions): WorldState {
  const rng = new Rng(opts.seed);
  const fighters: FighterState[] = [];
  fighters.push(makeFighter(PLAYER_ID, opts.playerRoster, opts.playerName ?? 'YOU', false, 1, 10, 30));
  const names = [...BOT_NAMES];
  for (let i = 0; i < opts.botCount; i++) {
    const def = FIGHTERS[rng.int(0, FIGHTERS.length - 1)];
    const name = names.splice(rng.int(0, names.length - 1), 1)[0] ?? `Bot${i}`;
    const skill = Math.max(0.05, Math.min(1, (opts.botSkill ?? 0.5) + rng.range(-0.35, 0.35)));
    const a = rng.range(0, Math.PI * 2);
    fighters.push(makeFighter(i + 1, def.id, `${name}`, true, skill, 10 + Math.cos(a) * 6, 24 + Math.sin(a) * 6));
  }
  return {
    time: 0, tick: 0, phase: opts.skipBus ? 'playing' : 'bus', fighters, items: [], crates: [], projectiles: [],
    ring: { phase: -1, cx: 0, cz: 0, r: 400, fromX: 0, fromZ: 0, fromR: 400, toX: 0, toZ: 0, toR: 400, stage: 'wait', stageTime: 0, stageDur: 60, damage: 0 },
    bus: { active: false, x: 0, z: 0, y: 0, dirX: 1, dirZ: 0, t: 0, length: 0 },
    aliveCount: fighters.length, winner: -1, nextUid: 1, hitPause: 0, timeScale: 1, timeScaleUntil: 0,
    mainEvent: false, championId: -1,
  };
}

export const fighterDef = (f: FighterState) => getFighter(f.rosterId);

/** Collects events emitted during a step; consumers drain it each frame. */
export class EventBus {
  events: GameEvent[] = [];
  emit(e: GameEvent) {
    this.events.push(e);
  }
  drain(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}
