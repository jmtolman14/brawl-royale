import { create } from 'zustand';
import type { ItemStack } from '../sim/types';

export type Screen = 'menu' | 'howto' | 'select' | 'settings' | 'game';

export interface FeedEntry {
  id: number;
  text: string;
  kind: 'ko' | 'info' | 'storm' | 'champ';
  time: number;
}

export interface Hud {
  hp: number;
  maxHp: number;
  shield: number;
  stamina: number;
  maxStamina: number;
  hype: number;
  sigCooldown: number; // seconds left
  sigTotal: number;
  inventory: (ItemStack | null)[];
  slot: number;
  alive: number;
  total: number;
  kills: number;
  ringPhase: number;
  ringStage: 'wait' | 'shrink' | 'done';
  ringTime: number;
  inStorm: boolean;
  phase: 'bus' | 'playing' | 'over';
  playerState: string;
  prompt: string | null;
  lockName: string | null;
  lockHp: number;
  useProgress: number;
  buffs: string[];
  champion: boolean;
  mainEvent: boolean;
  spectating: string | null;
  canJump: boolean;
}

export interface Results {
  won: boolean;
  placement: number;
  total: number;
  kills: number;
  damage: number;
  time: number;
  killedBy: string | null;
  winnerName: string;
}

interface UiState {
  screen: Screen;
  fighterId: string;
  training: boolean;
  matchKey: number;
  mapOpen: boolean;
  paused: boolean;
  hud: Hud | null;
  feed: FeedEntry[];
  banner: { text: string; sub?: string; id: number } | null;
  results: Results | null;
  set: (p: Partial<UiState>) => void;
  pushFeed: (text: string, kind: FeedEntry['kind']) => void;
  showBanner: (text: string, sub?: string) => void;
}

let feedId = 0;

export const useUi = create<UiState>((set) => ({
  screen: 'menu',
  fighterId: 'quickfire',
  training: false,
  matchKey: 0,
  mapOpen: false,
  paused: false,
  hud: null,
  feed: [],
  banner: null,
  results: null,
  set: (p) => set(p),
  pushFeed: (text, kind) =>
    set((s) => ({ feed: [...s.feed.slice(-5), { id: ++feedId, text, kind, time: performance.now() }] })),
  showBanner: (text, sub) => set({ banner: { text, sub, id: ++feedId } }),
}));
