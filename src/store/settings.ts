import { create } from 'zustand';

export type Quality = 'low' | 'medium' | 'high';
export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTY_SKILL: Record<Difficulty, number> = { easy: 0.28, normal: 0.5, hard: 0.78 };

interface SettingsState {
  quality: Quality;
  difficulty: Difficulty;
  sensitivity: number; // 0.2..3
  volume: number; // 0..1
  invertY: boolean;
  tutorialSeen: boolean;
  showFps: boolean;
  set: (p: Partial<Omit<SettingsState, 'set'>>) => void;
}

const KEY = 'brawl-royale-settings';

function load(): Partial<SettingsState> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

export const useSettings = create<SettingsState>((set, get) => ({
  quality: 'medium',
  difficulty: 'normal',
  sensitivity: 1,
  volume: 0.7,
  invertY: false,
  tutorialSeen: false,
  showFps: false,
  ...load(),
  set: (p) => {
    set(p);
    const { set: _s, ...rest } = { ...get(), ...p };
    try {
      localStorage.setItem(KEY, JSON.stringify(rest));
    } catch {
      /* storage unavailable */
    }
  },
}));
