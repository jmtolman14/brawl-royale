import { ITEMS, RARITY_COLOR } from '../data/items';
import { useUi } from '../store/ui';
import { ItemIcon } from './ItemIcon';

export const CONTROLS: [string, string, string][] = [
  ['Move', 'W A S D', 'Left stick'],
  ['Look', 'Mouse', 'Right stick'],
  ['Light attack', 'Left click', 'X / □'],
  ['Heavy attack', 'Right click', 'Y / △'],
  ['Block (tap to parry)', 'Q (hold)', 'LB'],
  ['Dodge / roll', 'C or Ctrl', 'B / ○'],
  ['Grab / pick up / open', 'E', 'RB'],
  ['Signature / Finisher', 'F', 'RT'],
  ['Sprint', 'Shift', 'L3'],
  ['Jump / drop from blimp', 'Space', 'A / ✕'],
  ['Use selected item', 'R', 'LT'],
  ['Throw prop (chair, bottle)', 'G', 'D-pad down'],
  ['Hotbar', '1-5 / mouse wheel', 'D-pad ← →'],
  ['Lock-on target', 'Tab', 'R3'],
  ['Map', 'M', 'Select'],
  ['Pause', 'Esc / P', 'Start'],
];

export function HowToContent() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <h2 className="mb-2 font-display text-3xl text-amber-300">THE GOAL</h2>
        <p className="text-sm opacity-90">
          30 fighters drop onto the island from the Battle Blimp. There are <b>no weapons</b>: every fight is hand-to-hand. Grab loot, stay inside the safe zone as the storm closes, and be the <b>last fighter standing</b>.
        </p>
        <h2 className="mb-2 mt-5 font-display text-3xl text-amber-300">THE FIGHTING TRIANGLE</h2>
        <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
          <div className="rounded bg-red-600/30 p-2 ring-1 ring-red-400/40"><div className="font-display text-2xl">STRIKE</div>beats GRAB<br />(hit them while they reach)</div>
          <div className="rounded bg-pink-600/30 p-2 ring-1 ring-pink-400/40"><div className="font-display text-2xl">GRAB</div>beats BLOCK<br />(throws ignore guards)</div>
          <div className="rounded bg-sky-600/30 p-2 ring-1 ring-sky-400/40"><div className="font-display text-2xl">DODGE</div>beats STRIKE<br />(roll through attacks)</div>
        </div>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm opacity-90">
          <li><b>Block</b> (hold Q) turns hits into tiny chip damage but drains stamina. Run out and your guard breaks.</li>
          <li><b>Parry:</b> start blocking just before a hit lands to stagger the attacker. Huge crowd hype.</li>
          <li><b>Combo:</b> Light → Light → Heavy fires your fighter's combo finisher, which knocks down.</li>
          <li><b>Stamina</b> powers attacks, blocks, dodges and sprinting. If you're gassed, back off and breathe.</li>
          <li>Each fighter has a <b>Signature move</b> on F with a cooldown and a passive trait. Check them on the select screen.</li>
          <li>Hits stack up and break <b>poise</b>, which knocks fighters down. Sumos are very hard to knock down.</li>
        </ul>
      </section>
      <section>
        <h2 className="mb-2 font-display text-3xl text-amber-300">WHAT MAKES BRAWL ROYALE DIFFERENT</h2>
        <div className="space-y-2 text-sm">
          <div className="rounded bg-white/5 p-3 ring-1 ring-white/10"><b className="text-pink-300">📣 Crowd Hype:</b> the crowd loves style. Combos, parries, throws, dodges and KOs fill your Hype meter. Avoiding fights makes them bored and the meter drains. At 100%, press <b>F</b> for a slow-motion <b>FINISHER</b>.</div>
          <div className="rounded bg-white/5 p-3 ring-1 ring-white/10"><b className="text-amber-300">🏆 Championship Belt:</b> one legendary belt waits in the Grand Arena. Wearing it gives +15% damage and defense and 2× hype, but every fighter can see the champ on the map and will come for you.</div>
          <div className="rounded bg-white/5 p-3 ring-1 ring-white/10"><b className="text-sky-300">🔔 Main Event:</b> the final safe zone turns into a wrestling ring. The bell rings, and fighters inside bounce off the ropes.</div>
        </div>
        <h2 className="mb-2 mt-5 font-display text-3xl text-amber-300">LOOT</h2>
        <div className="flex flex-wrap gap-2 text-[11px]">
          {(['common', 'uncommon', 'rare', 'epic', 'legendary'] as const).map((r) => (
            <span key={r} className="rounded px-2 py-0.5 font-extrabold uppercase text-black" style={{ background: RARITY_COLOR[r] }}>{r}</span>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
          {ITEMS.map((i) => (
            <div key={i.id} className="flex items-center gap-2 rounded bg-white/5 p-1.5 text-xs">
              <ItemIcon shape={i.shape} color={RARITY_COLOR[i.rarity]} size={24} />
              <div><b style={{ color: RARITY_COLOR[i.rarity] }}>{i.name}</b> <span className="opacity-80">{i.desc}</span></div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs opacity-75">Open crates and pick things up with <b>E</b>. Select a hotbar slot with 1-5 and use it with <b>R</b>. Throw chairs and bottles with <b>G</b>. Outside the safe zone the purple storm hurts, and it hurts more each phase.</p>
      </section>
      <section className="lg:col-span-2">
        <h2 className="mb-2 font-display text-3xl text-amber-300">CONTROLS</h2>
        <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          {CONTROLS.map(([a, k, g]) => (
            <div key={a} className="flex items-center justify-between border-b border-white/10 py-1 text-sm">
              <span className="opacity-90">{a}</span>
              <span className="flex gap-2"><kbd className="rounded bg-white/15 px-1.5 font-bold">{k}</kbd><span className="w-20 text-right text-xs opacity-60">{g}</span></span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs opacity-60">Tip: on Windows, Ctrl+W closes the browser tab, so use C to dodge.</p>
      </section>
    </div>
  );
}

export default function HowToPlay() {
  const set = useUi((s) => s.set);
  return (
    <div className="h-full overflow-y-auto bg-[#0b0d14] px-4 py-6 md:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-center justify-between">
          <button className="text-sm font-bold opacity-70 hover:opacity-100" onClick={() => set({ screen: 'menu' })}>← BACK</button>
          <h1 className="font-display text-5xl tracking-wider">HOW TO PLAY</h1>
          <button className="rounded bg-red-600 px-4 py-1 font-display text-2xl" onClick={() => set({ screen: 'select', training: true })}>TRY IT</button>
        </div>
        <HowToContent />
      </div>
    </div>
  );
}
