// Pure data types for the simulation. Everything here is plain/serializable so a
// network layer can replicate WorldState and send InputFrames later.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** One tick of intent from a human (InputManager) or a bot (AI). Same shape for both. */
export interface InputFrame {
  /** Local movement: x = strafe right, z = forward. Range -1..1. */
  moveX: number;
  moveZ: number;
  /** Yaw that movement is relative to (camera yaw for humans). */
  yaw: number;
  sprint: boolean;
  block: boolean;
  // Edge-triggered (true only on the tick the button went down)
  light: boolean;
  heavy: boolean;
  dodge: boolean;
  grapple: boolean;
  jump: boolean;
  signature: boolean;
  throwItem: boolean;
  useItem: boolean;
  /** Hotbar slot to select this tick, or -1. */
  slot: number;
  /** Fighter id to face while locked on, or -1. */
  lockTarget: number;
}

export const emptyInput = (): InputFrame => ({
  moveX: 0,
  moveZ: 0,
  yaw: 0,
  sprint: false,
  block: false,
  light: false,
  heavy: false,
  dodge: false,
  grapple: false,
  jump: false,
  signature: false,
  throwItem: false,
  useItem: false,
  slot: -1,
  lockTarget: -1,
});

export type FighterStateName =
  | 'bus'
  | 'glide'
  | 'idle'
  | 'move'
  | 'attack'
  | 'block'
  | 'dodge'
  | 'grapple' // performing a grab attempt / throw
  | 'grabbed' // being held by someone
  | 'stun'
  | 'knockdown'
  | 'getup'
  | 'use' // consuming an item
  | 'ko';

export interface Buff {
  kind: 'adrenaline' | 'slow' | 'champion' | 'wraps' | 'knucks' | 'energy';
  time: number; // seconds remaining (Infinity for passive)
}

export interface ItemStack {
  itemId: string;
  count: number;
}

export interface FighterState {
  id: number;
  rosterId: string;
  name: string;
  isBot: boolean;
  skill: number; // 0..1 for bots

  pos: Vec3;
  prevPos: Vec3; // for render interpolation
  vel: Vec3;
  yaw: number;
  onGround: boolean;

  hp: number;
  maxHp: number;
  shield: number;
  stamina: number;
  maxStamina: number;
  /** Stamina regen is paused until this sim time. */
  staminaLockUntil: number;

  state: FighterStateName;
  stateTime: number;
  /** Current move id when attacking/grappling. */
  move: string | null;
  /** Total duration of the current state (for animation progress), 0 if open-ended. */
  stateDur: number;
  hitIds: number[];
  comboStep: number;
  comboUntil: number;
  /** Queued light/heavy input during recovery. */
  buffered: 'light' | 'heavy' | null;
  blockStart: number;
  poise: number;
  grappleWith: number; // partner id while grappling/grabbed
  invulnUntil: number;

  hype: number; // 0..100
  sigReadyAt: number;

  inventory: (ItemStack | null)[];
  slot: number;
  useItemId: string | null;
  buffs: Buff[];

  alive: boolean;
  kills: number;
  damageDealt: number;
  placement: number;
  lastHitBy: number;
  lastHitAt: number;
  lockTarget: number;
  /** Animation/timing speed multiplier for the current move. */
  moveSpeed: number;
  dodgeX: number;
  dodgeZ: number;
  lastCombatAt: number;
  /** counter_puncher passive: next strike is empowered. */
  counterReady: boolean;
  hitIndex: number;
  /** AI-only scratch data (opaque to the sim). */
  ai: Record<string, number>;
}

export type ItemKind = 'heal' | 'shield' | 'stamina' | 'adrenaline' | 'belt' | 'wraps' | 'knucks' | 'throwable';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface GroundItem {
  uid: number;
  itemId: string;
  count: number;
  x: number;
  y: number;
  z: number;
}

export interface Crate {
  uid: number;
  x: number;
  y: number;
  z: number;
  opened: boolean;
  tier: number; // 0 normal, 1 rare chest
}

export interface Projectile {
  uid: number;
  owner: number;
  itemId: string;
  pos: Vec3;
  vel: Vec3;
  life: number;
}

export interface RingState {
  phase: number; // index into phases; -1 before first close
  cx: number;
  cz: number;
  r: number;
  // Shrink interpolation
  fromX: number;
  fromZ: number;
  fromR: number;
  toX: number;
  toZ: number;
  toR: number;
  /** 'wait' before shrinking, 'shrink' while moving, 'done' after last phase. */
  stage: 'wait' | 'shrink' | 'done';
  stageTime: number;
  stageDur: number;
  damage: number;
}

export interface BusState {
  active: boolean;
  x: number;
  z: number;
  y: number;
  dirX: number;
  dirZ: number;
  t: number;
  length: number;
}

export type MatchPhase = 'bus' | 'playing' | 'over';

export interface WorldState {
  time: number;
  tick: number;
  phase: MatchPhase;
  fighters: FighterState[];
  items: GroundItem[];
  crates: Crate[];
  projectiles: Projectile[];
  ring: RingState;
  bus: BusState;
  aliveCount: number;
  winner: number;
  nextUid: number;
  /** Seconds of frozen sim remaining (hit-pause). */
  hitPause: number;
  /** Global time scale (finisher slow-mo). */
  timeScale: number;
  timeScaleUntil: number;
  /** Final circle has become a wrestling ring. */
  mainEvent: boolean;
  championId: number;
}

export type GameEvent =
  | { type: 'hit'; attacker: number; target: number; damage: number; x: number; y: number; z: number; heavy: boolean; blocked: boolean; shield: boolean }
  | { type: 'parry'; attacker: number; target: number; x: number; y: number; z: number }
  | { type: 'whiff'; attacker: number }
  | { type: 'swing'; attacker: number; heavy: boolean }
  | { type: 'throw'; attacker: number; target: number; damage: number; x: number; y: number; z: number }
  | { type: 'knockdown'; target: number }
  | { type: 'ko'; target: number; by: number; placement: number }
  | { type: 'pickup'; fighter: number; itemId: string }
  | { type: 'crate'; fighter: number; x: number; y: number; z: number }
  | { type: 'use'; fighter: number; itemId: string }
  | { type: 'signature'; fighter: number; name: string }
  | { type: 'finisher'; fighter: number }
  | { type: 'hypeFull'; fighter: number }
  | { type: 'ringPhase'; phase: number; stage: 'wait' | 'shrink' }
  | { type: 'mainEvent' }
  | { type: 'champion'; fighter: number }
  | { type: 'jump'; fighter: number }
  | { type: 'land'; fighter: number }
  | { type: 'win'; fighter: number };
