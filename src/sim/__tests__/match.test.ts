import { describe, expect, it } from 'vitest';
import { MatchRunner } from '../match';
import { emptyInput } from '../types';

function runMatch(seed: number) {
  const r = new MatchRunner({ seed, playerRoster: 'tank', botCount: 29, botSkill: 0.5 });
  r.world.fighters[0].isBot = true; // let the AI drive the "player" too
  r.world.fighters[0].skill = 0.5;
  // initBots skipped the player; re-init so it has AI state
  const p = r.world.fighters[0];
  p.ai = { ...r.world.fighters[1].ai, mode: 0 };
  const t0 = performance.now();
  let steps = 0;
  const kills = new Map<string, number>();
  while (r.world.phase !== 'over' && r.world.time < 1200) {
    r.step(emptyInput());
    steps++;
    for (const e of r.events.drain()) if (e.type === 'ko') kills.set(e.by >= 0 ? 'fighter' : 'storm', (kills.get(e.by >= 0 ? 'fighter' : 'storm') ?? 0) + 1);
  }
  const ms = performance.now() - t0;
  return { r, steps, ms, kills };
}

describe('full match (headless)', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    it(`seed ${seed} ends with exactly one winner`, () => {
      const { r, steps, ms, kills } = runMatch(seed);
      const w = r.world;
      const alive = w.fighters.filter((f) => f.alive);
      const bad = w.fighters.filter((f) => !Number.isFinite(f.pos.x) || !Number.isFinite(f.pos.y) || !Number.isFinite(f.hp));
      console.log(`seed ${seed}: ${w.time.toFixed(0)}s sim, ${steps} steps, ${(ms / steps).toFixed(3)} ms/step, KOs by fighters ${kills.get('fighter') ?? 0}, by storm ${kills.get('storm') ?? 0}, ring phase ${w.ring.phase}`);
      expect(bad.length).toBe(0);
      expect(w.phase).toBe('over');
      expect(alive.length).toBe(1);
      expect(w.winner).toBe(alive[0].id);
      const places = w.fighters.map((f) => f.placement).sort((a, b) => a - b);
      expect(places).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    }, 60000);
  }
});
