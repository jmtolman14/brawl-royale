import { create } from 'zustand';

export type Quality = 'low' | 'medium' | 'high';

interface SettingsState {
  quality: Quality;
  sensitivity: number; // 0.2..3
  volume: number; // 0..1
  invertY: boolean;
  tutorialSeen: boolean;
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
  sensitivity: 1,
  volume: 0.7,
  invertY: false,
  tutorialSeen: false,
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
