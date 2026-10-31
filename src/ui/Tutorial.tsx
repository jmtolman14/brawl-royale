// Contextual first-match tips. Each tip fires once when its condition is met.
import { useEffect, useRef, useState } from 'react';
import { onFx } from '../game/fx';
import { session } from '../game/session';
import { PLAYER_ID } from '../sim/constants';
import { useSettings } from '../store/settings';
import { useUi } from '../store/ui';

interface Tip {
  id: string;
  title: string;
  body: string;
}

const TIPS: Record<string, Tip> = {
  land: { id: 'land', title: 'LOOT UP', body: 'Walk to glowing items and press E to pick them up. Crates (E) drop 2-3 items. Ring colour = rarity.' },
  item: { id: 'item', title: 'YOUR HOTBAR', body: 'Pick a slot with 1-5 or the mouse wheel, then press R to use it. Throw chairs and bottles with G.' },
  enemy: { id: 'enemy', title: 'FIGHT!', body: 'Left click = light, right click = heavy, E = grab. Light → Light → Heavy is a knockdown combo. Tab locks on.' },
  hit: { id: 'hit', title: 'DEFEND YOURSELF', body: 'Hold Q to block, and tap it right before a hit to PARRY. C dodges through strikes. Grabs beat blocks, and strikes beat grabs.' },
  hype: { id: 'hype', title: 'THE CROWD IS WATCHING', body: 'Style builds HYPE. At 100%, press F for your FINISHER. Until then, F is your signature move on a cooldown.' },
  storm: { id: 'storm', title: 'THE STORM IS COMING', body: 'Get inside the white dashed circle on your map (M). The purple storm hurts more each phase.' },
  belt: { id: 'belt', title: 'A CHAMPION APPEARS', body: 'The Championship Belt holder shows as a ★ on everyone\'s map. Beat them and take the belt!' },
};

export function Tutorial() {
  const seen = useSettings((s) => s.tutorialSeen);
  const training = useUi((s) => s.training);
  const [tip, setTip] = useState<Tip | null>(null);
  const shown = useRef(new Set<string>());
  const queue = useRef<Tip[]>([]);
  const active = !seen || training;

  useEffect(() => {
    if (!active) return;
    const push = (id: string) => {
      if (shown.current.has(id)) return;
      shown.current.add(id);
      queue.current.push(TIPS[id]);
    };
    if (training) {
      push('enemy');
      push('hit');
      push('item');
      push('hype');
    }
    const off = onFx((e) => {
      if (e.type === 'land' && e.fighter === PLAYER_ID) push('land');
      if (e.type === 'pickup' && e.fighter === PLAYER_ID) push('item');
      if ((e.type === 'hit' || e.type === 'throw') && e.target === PLAYER_ID) push('hit');
      if (e.type === 'ringPhase' && e.stage === 'wait' && e.phase === 1) push('storm');
      if (e.type === 'ringPhase' && e.stage === 'shrink' && e.phase === 0) push('storm');
      if (e.type === 'champion' && e.fighter !== PLAYER_ID) push('belt');
    });
    const iv = setInterval(() => {
      const r = session.runner;
      if (!r) return;
      const w = r.world;
      const p = w.fighters[PLAYER_ID];
      if (p.alive && p.state !== 'bus' && p.state !== 'glide') {
        if (w.fighters.some((f) => f.id !== PLAYER_ID && f.alive && f.state !== 'bus' && f.state !== 'glide' && Math.hypot(f.pos.x - p.pos.x, f.pos.z - p.pos.z) < 14)) push('enemy');
        if (p.hype > 40) push('hype');
      }
    }, 500);
    return () => {
      off();
      clearInterval(iv);
    };
  }, [active, training]);

  // Show queued tips one at a time
  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => {
      setTip((cur) => {
        if (cur) return cur;
        return queue.current.shift() ?? null;
      });
    }, 300);
    return () => clearInterval(iv);
  }, [active]);

  useEffect(() => {
    if (!tip) return;
    const t = setTimeout(() => setTip(null), 7500);
    return () => clearTimeout(t);
  }, [tip]);

  // Once a full match has been played, stop showing tips
  const results = useUi((s) => s.results);
  useEffect(() => {
    if (results && !training) useSettings.getState().set({ tutorialSeen: true });
  }, [results, training]);

  if (!active || !tip) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-[30%] z-10 w-[min(92vw,460px)] -translate-x-1/2" style={{ animation: 'tipIn .3s ease-out' }}>
      <div className="rounded-lg border-l-4 border-amber-400 bg-black/75 p-3 shadow-xl backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="font-display text-2xl tracking-wide text-amber-300">TIP · {tip.title}</div>
          <div className="text-[10px] font-bold opacity-50">turn off in Settings</div>
        </div>
        <div className="text-sm font-semibold leading-snug">{tip.body}</div>
      </div>
      <style>{`@keyframes tipIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
