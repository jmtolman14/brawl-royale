import { useUi } from '../store/ui';

export default function MainMenu() {
  const set = useUi((s) => s.set);
  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-[#0b0d14] px-4">
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 120%, #b91c1c 0%, transparent 55%), radial-gradient(circle at 50% -20%, #f59e0b33, transparent 50%)' }} />
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="relative text-center">
        <div className="mb-2 text-xs font-extrabold tracking-[0.5em] text-amber-300/90">30 FIGHTERS · ONE ISLAND · NO WEAPONS</div>
        <h1 className="font-display text-[clamp(4rem,14vw,10rem)] leading-[0.85] tracking-wide" style={{ textShadow: '0 6px 0 #7f1d1d, 0 0 60px rgba(239,68,68,.35)' }}>
          BRAWL
          <br />
          <span className="text-amber-300" style={{ textShadow: '0 6px 0 #78350f, 0 0 60px rgba(251,191,36,.35)' }}>ROYALE</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm font-semibold text-white/75">
          A battle royale where every fight is hand-to-hand. Drop in, loot up, win the crowd, and be the last fighter standing.
        </p>
      </div>
      <div className="relative mt-8 flex w-full max-w-xs flex-col gap-3">
        <button className="rounded-md bg-red-600 py-3 font-display text-4xl tracking-wider shadow-[0_6px_0_#7f1d1d] transition hover:bg-red-500 active:translate-y-1 active:shadow-[0_2px_0_#7f1d1d]" onClick={() => set({ screen: 'select', training: false })}>
          PLAY
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button className="rounded-md bg-white/10 py-2 font-display text-2xl tracking-wide ring-1 ring-white/15 hover:bg-white/20" onClick={() => set({ screen: 'select', training: true })}>
            TRAINING
          </button>
          <button className="rounded-md bg-white/10 py-2 font-display text-2xl tracking-wide ring-1 ring-white/15 hover:bg-white/20" onClick={() => set({ screen: 'howto' })}>
            HOW TO PLAY
          </button>
        </div>
        <button className="rounded-md bg-white/5 py-2 font-display text-xl tracking-wide ring-1 ring-white/10 hover:bg-white/15" onClick={() => set({ screen: 'settings' })}>
          SETTINGS
        </button>
      </div>
      <div className="absolute bottom-3 text-[11px] text-white/40">Best with mouse + keyboard or a gamepad · All fighters are fictional</div>
    </div>
  );
}
