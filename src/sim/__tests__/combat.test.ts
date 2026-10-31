import { describe, expect, it } from 'vitest';
import { MatchRunner } from '../match';
import { emptyInput, type InputFrame } from '../types';

/** Two fighters 1.4m apart facing each other on flat ground. */
function duel(a = 'cyclone', b = 'cyclone') {
  const r = new MatchRunner({ seed: 1, playerRoster: a, botCount: 1, skipBus: true, training: true });
  const [p, d] = r.world.fighters;
  d.rosterId = b;
  d.hp = d.maxHp = 200;
  p.pos = { x: 10, y: 5, z: 20 };
  d.pos = { x: 10, y: 5, z: 18.6 };
  p.yaw = 0; // facing -Z toward d
  d.yaw = Math.PI;
  p.prevPos = { ...p.pos };
  d.prevPos = { ...d.pos };
  const idle = emptyInput();
  r.overrides.set(1, idle);
  return { r, p, d };
}

const tick = (r: MatchRunner, player: Partial<InputFrame> = {}, bot: Partial<InputFrame> = {}, n = 1) => {
  for (let i = 0; i < n; i++) {
    r.overrides.set(1, { ...emptyInput(), yaw: Math.PI, ...bot });
    r.step({ ...emptyInput(), ...player });
    player = { block: player.block, sprint: player.sprint };
    bot = { block: bot.block };
  }
};

describe('combat core', () => {
  it('light attack damages an idle target', () => {
    const { r, d } = duel();
    tick(r, { light: true });
    tick(r, {}, {}, 30);
    expect(d.hp).toBeLessThan(200);
  });

  it('blocking reduces damage to chip and drains stamina', () => {
    const { r, d } = duel();
    tick(r, {}, { block: true }, 20); // holding block well past the parry window
    const st = d.stamina;
    tick(r, { light: true }, { block: true });
    tick(r, {}, { block: true }, 30);
    expect(200 - d.hp).toBeLessThan(2);
    expect(d.stamina).toBeLessThan(st);
  });

  it('perfect block (parry) staggers the attacker', () => {
    const { r, p } = duel();
    tick(r, { light: true });
    tick(r, {}, {}, 2); // jab startup is ~5 ticks
    tick(r, {}, { block: true }, 6);
    expect(p.state).toBe('stun');
  });

  it('grapple beats block', () => {
    const { r, d } = duel();
    tick(r, {}, { block: true }, 20);
    tick(r, { grapple: true }, { block: true });
    tick(r, {}, { block: true }, 20);
    expect(d.state).toBe('grabbed');
    tick(r, {}, {}, 60);
    expect(d.hp).toBeLessThan(200);
    expect(['knockdown', 'getup']).toContain(d.state);
  });

  it('strikes beat grapple startup', () => {
    const { r, p, d } = duel();
    tick(r, { grapple: true }, { light: true });
    tick(r, {}, {}, 20);
    expect(p.state === 'stun' || p.hp < p.maxHp).toBe(true);
    expect(d.state).not.toBe('grabbed');
  });

  it('dodge i-frames beat strikes', () => {
    const { r, d } = duel();
    tick(r, { heavy: true }, {});
    tick(r, {}, { dodge: true, moveX: 1 });
    tick(r, {}, {}, 30);
    expect(d.hp).toBe(200);
  });

  it('cannot attack with no stamina', () => {
    const { r, p, d } = duel();
    p.stamina = 0;
    p.staminaLockUntil = 999;
    tick(r, { heavy: true });
    tick(r, {}, {}, 30);
    expect(d.hp).toBe(200);
  });

  it('light, light, heavy uses the combo finisher', () => {
    const { r, p } = duel('quickfire');
    const seen = new Set<string>();
    tick(r, { light: true });
    for (let i = 0; i < 25; i++) { tick(r); if (p.move) seen.add(p.move); }
    tick(r, { light: true });
    for (let i = 0; i < 25; i++) { tick(r); if (p.move) seen.add(p.move); }
    tick(r, { heavy: true });
    for (let i = 0; i < 5; i++) { tick(r); if (p.move) seen.add(p.move); }
    expect(seen.has('b_upper')).toBe(true);
  });
});
