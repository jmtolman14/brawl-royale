import { lazy, Suspense } from 'react';
import { ARCHETYPE_LABEL, FIGHTERS, getFighter, type FighterStats } from '../data/fighters';
import { PASSIVES, SIGNATURES } from '../data/moves';
import { useUi } from '../store/ui';

const FighterPreview = lazy(() => import('./FighterPreview'));

const STAT_LABEL: Record<keyof FighterStats, string> = {
  health: 'Health',
  speed: 'Speed',
  power: 'Power',
  stamina: 'Stamina',
  grapple: 'Grapple',
  defense: 'Defense',
};

export default function CharacterSelect() {
  const { fighterId, training, set } = useUi();
  const def = getFighter(fighterId);
  const sig = SIGNATURES[def.signature];
  const pas = PASSIVES[def.passive];
  const start = () => set({ screen: 'game', matchKey: Date.now(), results: null, paused: false, mapOpen: false });
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[#0b0d14] font-body">
      <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: `radial-gradient(ellipse at 70% 40%, ${def.colors.primary}55, transparent 60%)` }} />
      <header className="relative flex items-center justify-between px-6 pt-5 md:px-10">
        <button className="text-sm font-bold opacity-70 hover:opacity-100" onClick={() => set({ screen: 'menu' })}>
          ← BACK
        </button>
        <h1 className="font-display text-4xl tracking-wider md:text-5xl">{training ? 'TRAINING · ' : ''}CHOOSE YOUR FIGHTER</h1>
        <div className="w-16" />
      </header>
      <div className="relative flex min-h-0 flex-1 flex-col gap-4 p-4 md:flex-row md:p-8">
        {/* Roster grid */}
        <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 md:max-w-[52%]">
          {FIGHTERS.map((f) => {
            const sel = f.id === fighterId;
            return (
              <button
                key={f.id}
                onClick={() => set({ fighterId: f.id })}
                onDoubleClick={start}
                className={`group relative overflow-hidden rounded-md p-2 text-left transition ${sel ? 'scale-[1.03] ring-2 ring-amber-300' : 'ring-1 ring-white/10 hover:ring-white/40'}`}
                style={{ background: `linear-gradient(160deg, ${f.colors.primary}cc, ${f.colors.secondary}55 70%, #0008)` }}
              >
                <div className="mx-auto mb-1 grid h-14 w-14 place-items-center rounded-full ring-2 ring-black/30" style={{ background: f.colors.skin }}>
                  <div className="h-3 w-9 rounded-sm" style={{ background: f.look === 'mask' ? f.colors.secondary : f.colors.hair, marginTop: -26 }} />
                </div>
                <div className="truncate font-display text-lg leading-5 text-white drop-shadow">{f.nickname}</div>
                <div className="truncate text-[10px] font-bold uppercase text-white/80">{ARCHETYPE_LABEL[f.archetype]}</div>
              </button>
            );
          })}
        </div>
        {/* Detail */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
          <div className="relative h-64 shrink-0 md:h-auto md:flex-1">
            <Suspense fallback={<div className="grid h-full place-items-center opacity-50">Loading…</div>}>
              <FighterPreview id={fighterId} />
            </Suspense>
          </div>
          <div className="flex w-full flex-col gap-3 overflow-y-auto lg:w-80">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-widest" style={{ color: def.colors.primary === '#f8f9fa' || def.colors.primary === '#f2f2f2' ? '#fde68a' : def.colors.primary }}>
                {ARCHETYPE_LABEL[def.archetype]}
              </div>
              <div className="font-display text-5xl leading-[0.9]">{def.nickname}</div>
              <div className="text-sm font-semibold opacity-70">{def.name}</div>
              <p className="mt-2 text-sm opacity-90">{def.bio}</p>
            </div>
            <div className="space-y-1.5">
              {(Object.keys(STAT_LABEL) as (keyof FighterStats)[]).map((k) => (
                <div key={k} className="flex items-center gap-2 text-xs font-bold">
                  <div className="w-16 uppercase opacity-80">{STAT_LABEL[k]}</div>
                  <div className="flex flex-1 gap-0.5">
                    {Array.from({ length: 10 }, (_, i) => (
                      <div key={i} className="h-2.5 flex-1 rounded-[1px]" style={{ background: i < def.stats[k] ? (k === 'grapple' ? '#f472b6' : k === 'power' ? '#f87171' : k === 'speed' ? '#34d399' : '#fbbf24') : '#ffffff1a' }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-md bg-white/5 p-3 ring-1 ring-white/10">
              <div className="text-[10px] font-extrabold tracking-widest text-pink-400">SIGNATURE · F · {sig?.cooldown}s</div>
              <div className="font-display text-2xl leading-6">{sig?.name}</div>
              <div className="text-xs opacity-80">{sig?.desc}</div>
            </div>
            <div className="rounded-md bg-white/5 p-3 ring-1 ring-white/10">
              <div className="text-[10px] font-extrabold tracking-widest text-sky-400">PASSIVE</div>
              <div className="font-display text-2xl leading-6">{pas?.name}</div>
              <div className="text-xs opacity-80">{pas?.desc}</div>
            </div>
            <button onClick={start} className="mt-auto rounded-md bg-red-600 py-3 font-display text-4xl tracking-wider shadow-[0_6px_0_#7f1d1d] transition hover:bg-red-500 active:translate-y-1 active:shadow-[0_2px_0_#7f1d1d]">
              {training ? 'ENTER TRAINING' : 'DROP IN'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
