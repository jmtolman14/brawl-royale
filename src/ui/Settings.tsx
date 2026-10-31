import { useSettings, type Difficulty, type Quality } from '../store/settings';
import { useUi } from '../store/ui';

export function SettingsPanel() {
  const s = useSettings();
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 text-xs font-extrabold tracking-widest opacity-70">GRAPHICS QUALITY</div>
        <div className="flex gap-2">
          {(['low', 'medium', 'high'] as Quality[]).map((q) => (
            <button key={q} onClick={() => s.set({ quality: q })} className={`flex-1 rounded py-2 font-display text-xl uppercase tracking-wide ${s.quality === q ? 'bg-amber-400 text-black' : 'bg-white/10 hover:bg-white/20'}`}>
              {q}
            </button>
          ))}
        </div>
        <div className="mt-1 text-xs opacity-60">Low: no shadows, lower resolution. High: sharper shadows, full resolution.</div>
      </div>
      <div>
        <div className="mb-1 text-xs font-extrabold tracking-widest opacity-70">BOT DIFFICULTY</div>
        <div className="flex gap-2">
          {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
            <button key={d} onClick={() => s.set({ difficulty: d })} className={`flex-1 rounded py-2 font-display text-xl uppercase tracking-wide ${s.difficulty === d ? 'bg-amber-400 text-black' : 'bg-white/10 hover:bg-white/20'}`}>
              {d}
            </button>
          ))}
        </div>
        <div className="mt-1 text-xs opacity-60">Applies from the next match.</div>
      </div>
      <label className="block">
        <div className="mb-1 flex justify-between text-xs font-extrabold tracking-widest opacity-70"><span>MOUSE SENSITIVITY</span><span>{s.sensitivity.toFixed(2)}</span></div>
        <input type="range" min={0.2} max={3} step={0.05} value={s.sensitivity} onChange={(e) => s.set({ sensitivity: Number(e.target.value) })} className="w-full accent-amber-400" />
      </label>
      <label className="block">
        <div className="mb-1 flex justify-between text-xs font-extrabold tracking-widest opacity-70"><span>VOLUME</span><span>{Math.round(s.volume * 100)}%</span></div>
        <input type="range" min={0} max={1} step={0.01} value={s.volume} onChange={(e) => s.set({ volume: Number(e.target.value) })} className="w-full accent-amber-400" />
      </label>
      <label className="flex items-center gap-2 text-sm font-bold">
        <input type="checkbox" checked={s.invertY} onChange={(e) => s.set({ invertY: e.target.checked })} className="h-4 w-4 accent-amber-400" /> Invert camera Y
      </label>
      <label className="flex items-center gap-2 text-sm font-bold">
        <input type="checkbox" checked={!s.tutorialSeen} onChange={(e) => s.set({ tutorialSeen: !e.target.checked })} className="h-4 w-4 accent-amber-400" /> Show tutorial tips in matches
      </label>
      <label className="flex items-center gap-2 text-sm font-bold">
        <input type="checkbox" checked={s.showFps} onChange={(e) => s.set({ showFps: e.target.checked })} className="h-4 w-4 accent-amber-400" /> Show FPS counter
      </label>
    </div>
  );
}

export default function Settings() {
  const set = useUi((s) => s.set);
  return (
    <div className="grid h-full place-items-center overflow-y-auto bg-[#0b0d14] p-4">
      <div className="w-full max-w-md rounded-xl bg-white/5 p-6 ring-1 ring-white/10">
        <div className="mb-5 flex items-center justify-between">
          <button className="text-sm font-bold opacity-70 hover:opacity-100" onClick={() => set({ screen: 'menu' })}>← BACK</button>
          <h1 className="font-display text-4xl tracking-wider">SETTINGS</h1>
          <div className="w-12" />
        </div>
        <SettingsPanel />
      </div>
    </div>
  );
}
