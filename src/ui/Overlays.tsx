import { useEffect, useState } from 'react';
import { session } from '../game/session';
import { useUi } from '../store/ui';
import { HowToContent } from './HowToPlay';
import { Minimap } from './Minimap';
import { SettingsPanel } from './Settings';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function FullMap() {
  const open = useUi((s) => s.mapOpen);
  const [size, setSize] = useState(() => Math.min(window.innerWidth, window.innerHeight) * 0.82);
  useEffect(() => {
    const on = () => setSize(Math.min(window.innerWidth, window.innerHeight) * 0.82);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  if (!open) return null;
  return (
    <div className="absolute inset-0 grid place-items-center bg-black/50" onClick={() => useUi.getState().set({ mapOpen: false })}>
      <div className="relative">
        <Minimap size={Math.round(size)} full />
        <div className="absolute -top-8 left-0 font-display text-2xl">ISLAND MAP <span className="text-sm opacity-70">· M to close · ★ = champion · dashed = next safe zone</span></div>
      </div>
    </div>
  );
}

export function PauseMenu() {
  const paused = useUi((s) => s.paused);
  const results = useUi((s) => s.results);
  const [tab, setTab] = useState<'main' | 'settings' | 'help'>('main');
  // Losing pointer lock (Esc) pauses the game
  useEffect(() => {
    const on = () => {
      const ui = useUi.getState();
      if (!document.pointerLockElement && !ui.results && session.runner?.world.phase !== 'over' && ui.screen === 'game') ui.set({ paused: true });
    };
    document.addEventListener('pointerlockchange', on);
    return () => document.removeEventListener('pointerlockchange', on);
  }, []);
  if (!paused || results) return null;
  const resume = () => {
    useUi.getState().set({ paused: false });
    setTab('main');
    session.input.requestLock();
  };
  const quit = () => {
    useUi.getState().set({ paused: false, screen: 'menu' });
    session.runner = null;
  };
  return (
    <div className="absolute inset-0 z-20 grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <div className={`w-full rounded-xl bg-[#11131c] p-6 ring-1 ring-white/10 ${tab === 'help' ? 'max-w-5xl' : 'max-w-sm'}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-4xl tracking-wider">{tab === 'main' ? 'PAUSED' : tab === 'settings' ? 'SETTINGS' : 'HOW TO PLAY'}</h2>
          {tab !== 'main' && <button className="text-sm font-bold opacity-70 hover:opacity-100" onClick={() => setTab('main')}>← BACK</button>}
        </div>
        {tab === 'main' && (
          <div className="flex flex-col gap-2">
            <button className="rounded bg-red-600 py-2 font-display text-3xl hover:bg-red-500" onClick={resume}>RESUME</button>
            <button className="rounded bg-white/10 py-2 font-display text-2xl hover:bg-white/20" onClick={() => setTab('help')}>HOW TO PLAY</button>
            <button className="rounded bg-white/10 py-2 font-display text-2xl hover:bg-white/20" onClick={() => setTab('settings')}>SETTINGS</button>
            <button className="rounded bg-white/5 py-2 font-display text-2xl hover:bg-white/15" onClick={quit}>QUIT TO MENU</button>
          </div>
        )}
        {tab === 'settings' && <SettingsPanel />}
        {tab === 'help' && <HowToContent />}
      </div>
    </div>
  );
}

export function ResultsScreen() {
  const results = useUi((s) => s.results);
  const set = useUi((s) => s.set);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (results) {
      setHidden(false);
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }, [results]);
  if (!results) return null;
  if (hidden)
    return (
      <button className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 rounded bg-black/70 px-4 py-2 font-display text-2xl ring-1 ring-white/20" onClick={() => setHidden(false)}>
        SHOW RESULTS
      </button>
    );
  const r = results;
  const stats: [string, string][] = [
    ['PLACEMENT', `#${r.placement} of ${r.total}`],
    ['KNOCKOUTS', String(r.kills)],
    ['DAMAGE DEALT', String(r.damage)],
    ['TIME SURVIVED', fmt(r.time)],
  ];
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-black/60 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-lg text-center">
        <div className="text-sm font-extrabold tracking-[0.4em] text-white/70">{r.won ? 'THE CROWD GOES WILD' : r.killedBy ? `KNOCKED OUT BY ${r.killedBy.toUpperCase()}` : 'ELIMINATED'}</div>
        <div
          className={`font-display text-[clamp(4rem,12vw,8rem)] leading-[0.9] ${r.won ? 'text-amber-300' : 'text-white'}`}
          style={{ textShadow: r.won ? '0 6px 0 #78350f, 0 0 50px rgba(251,191,36,.5)' : '0 6px 0 #7f1d1d' }}
        >
          {r.won ? 'VICTORY' : `#${r.placement}`}
        </div>
        {!r.won && r.winnerName && <div className="text-sm font-bold opacity-80">Winner: {r.winnerName}</div>}
        <div className="mt-5 grid grid-cols-2 gap-2">
          {stats.map(([k, v]) => (
            <div key={k} className="rounded-lg bg-white/10 p-3 ring-1 ring-white/10">
              <div className="text-[10px] font-extrabold tracking-widest opacity-70">{k}</div>
              <div className="font-display text-3xl">{v}</div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button className="flex-1 rounded-md bg-red-600 py-3 font-display text-3xl shadow-[0_5px_0_#7f1d1d] hover:bg-red-500" onClick={() => set({ matchKey: Date.now(), results: null, paused: false, mapOpen: false })}>
            REMATCH
          </button>
          <button className="flex-1 rounded-md bg-white/10 py-3 font-display text-2xl hover:bg-white/20" onClick={() => set({ screen: 'select', results: null })}>
            CHANGE FIGHTER
          </button>
        </div>
        <div className="mt-2 flex justify-center gap-4 text-sm font-bold">
          {!r.won && <button className="opacity-70 hover:opacity-100" onClick={() => setHidden(true)}>Spectate</button>}
          <button className="opacity-70 hover:opacity-100" onClick={() => { set({ screen: 'menu', results: null }); session.runner = null; }}>Main menu</button>
        </div>
      </div>
    </div>
  );
}
