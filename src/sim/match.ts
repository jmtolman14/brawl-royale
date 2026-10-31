// MatchRunner: owns the world state and steps the simulation at a fixed rate.
// Pure TypeScript: no React/three imports, so it can run headless (tests) or
// on a server later. Rendering reads `world`; input is fed in as InputFrames.
import { botThink, initBots } from './ai/bot';
import { applyDamage, knockdown, knock, setState } from './combat';
import { FIGHTER_RADIUS, PLAYER_ID, TICK } from './constants';
import type { SimCtx } from './ctx';
import { initBus, tickBus, tickGlide } from './drop';
import { tickFighter } from './fighter';
import { spawnLoot, spawnTrainingLoot, updateProjectiles } from './loot';
import { powerOf } from './stats';
import { initRing, ROPE_HALF, tickRing } from './ring';
import { Rng } from './rng';
import { emptyInput, type FighterState, type InputFrame, type WorldState } from './types';
import { createWorld, EventBus, type MatchOptions } from './world';

export class MatchRunner {
  world: WorldState;
  events = new EventBus();
  rng: Rng;
  ctx: SimCtx;
  opts: MatchOptions;
  private acc = 0;
  private inputs: InputFrame[];
  /** Fraction between the last two sim ticks (for render interpolation). */
  alpha = 0;
  /** Scripted inputs for specific fighters (tests, replays, future netcode). */
  overrides = new Map<number, InputFrame>();

  constructor(opts: MatchOptions) {
    this.opts = opts;
    this.rng = new Rng(opts.seed * 7 + 1);
    this.world = createWorld(opts);
    this.ctx = { w: this.world, ev: this.events, rng: this.rng };
    this.inputs = this.world.fighters.map(() => emptyInput());
    if (!opts.training) {
      spawnLoot(this.world, opts.seed);
      initRing(this.ctx);
    } else spawnTrainingLoot(this.world);
    if (!opts.skipBus) initBus(this.ctx);
    initBots(this.ctx);
  }

  /** Advance by real elapsed seconds. `player` is the human's input for this frame. */
  update(realDt: number, player: InputFrame) {
    this.acc += Math.min(realDt, 0.1);
    let steps = 0;
    let first = true;
    while (this.acc >= TICK && steps < 6) {
      this.acc -= TICK;
      steps++;
      this.step(first ? player : { ...player, ...EDGE_CLEAR });
      first = false;
    }
    if (steps === 0) this.pendingEdges(player);
    this.alpha = this.acc / TICK;
  }

  /** Edge-triggered presses that arrive between ticks are carried to the next tick. */
  private carry: Partial<InputFrame> = {};
  private pendingEdges(p: InputFrame) {
    for (const k of EDGE_KEYS) if (p[k]) (this.carry as Record<string, unknown>)[k] = true;
    if (p.slot >= 0) this.carry.slot = p.slot;
  }

  step(player: InputFrame) {
    const w = this.world;
    const ctx = this.ctx;
    const p: InputFrame = { ...player, ...this.carry };
    this.carry = {};
    if (w.hitPause > 0) {
      w.hitPause -= TICK;
      this.pendingEdges(p);
      return;
    }
    let dt = TICK;
    if (w.timeScale !== 1) {
      if (w.time >= w.timeScaleUntil) w.timeScale = 1;
      else dt *= w.timeScale;
    }
    w.time += dt;
    w.tick++;
    for (const f of w.fighters) {
      f.prevPos.x = f.pos.x;
      f.prevPos.y = f.pos.y;
      f.prevPos.z = f.pos.z;
    }
    // Inputs: human + bots
    this.inputs[PLAYER_ID] = p;
    for (const f of w.fighters) {
      if (f.isBot) this.inputs[f.id] = f.alive && w.phase !== 'over' ? botThink(ctx, f, dt) : emptyInput();
      const o = this.overrides.get(f.id);
      if (o) this.inputs[f.id] = o;
    }
    if (w.phase === 'over') {
      for (const f of w.fighters) if (f.id !== PLAYER_ID || !f.alive) this.inputs[f.id] = emptyInput();
    }
    tickBus(ctx, dt, this.inputs);
    for (const f of w.fighters) {
      if (f.state === 'glide') tickGlide(ctx, f, this.inputs[f.id], dt);
      else tickFighter(ctx, f, this.inputs[f.id], dt);
    }
    separate(w);
    if (w.mainEvent) ropes(w);
    updateProjectiles(ctx, dt, (owner, target, def, x, y, z) => {
      if (target.invulnUntil > w.time) return;
      const dmg = def.amount * Math.sqrt(powerOf(owner));
      const hadShield = target.shield > 0;
      applyDamage(ctx, owner, target, dmg, false);
      ctx.ev.emit({ type: 'hit', attacker: owner.id, target: target.id, damage: dmg, x, y, z, heavy: def.id === 'chair', blocked: false, shield: hadShield });
      target.lastCombatAt = owner.lastCombatAt = w.time;
      if (!target.alive) return;
      if (target.state === 'grapple' || target.state === 'grabbed') return;
      if (def.id === 'chair') {
        knockdown(ctx, target);
        knock(target, owner, 6, 4);
      } else {
        setState(target, 'stun', 0.4);
        knock(target, owner, 3, 0);
      }
    });
    if (!this.opts.training) tickRing(ctx, dt);
  }
}

const EDGE_KEYS = ['light', 'heavy', 'dodge', 'grapple', 'jump', 'signature', 'throwItem', 'useItem'] as const;
const EDGE_CLEAR: Partial<InputFrame> = { light: false, heavy: false, dodge: false, grapple: false, jump: false, signature: false, throwItem: false, useItem: false, slot: -1 };

/** Soft push-apart between fighters. */
function separate(w: WorldState) {
  const fs = w.fighters;
  const min = FIGHTER_RADIUS * 2;
  for (let i = 0; i < fs.length; i++) {
    const a = fs[i];
    if (!a.alive || a.state === 'bus' || a.state === 'glide' || a.state === 'grabbed') continue;
    for (let j = i + 1; j < fs.length; j++) {
      const b = fs[j];
      if (!b.alive || b.state === 'bus' || b.state === 'glide' || b.state === 'grabbed') continue;
      const dx = b.pos.x - a.pos.x;
      const dz = b.pos.z - a.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min || Math.abs(a.pos.y - b.pos.y) > 1.8) continue;
      const d = Math.sqrt(d2) || 0.01;
      const push = (min - d) / 2;
      const nx = dx / d, nz = dz / d;
      a.pos.x -= nx * push;
      a.pos.z -= nz * push;
      b.pos.x += nx * push;
      b.pos.z += nz * push;
    }
  }
}

/** Main Event: the final circle has wrestling ropes. Fighters inside bounce off them. */
function ropes(w: WorldState) {
  const cx = w.ring.toX, cz = w.ring.toZ;
  for (const f of w.fighters) {
    if (!f.alive || f.state === 'bus' || f.state === 'glide' || f.state === 'grabbed') continue;
    if (Math.abs(f.prevPos.x - cx) >= ROPE_HALF || Math.abs(f.prevPos.z - cz) >= ROPE_HALF) continue;
    bounce(f, 'x', f.pos.x - cx, cx);
    bounce(f, 'z', f.pos.z - cz, cz);
  }
}
function bounce(f: FighterState, axis: 'x' | 'z', rel: number, c: number) {
  if (Math.abs(rel) < ROPE_HALF) return;
  f.pos[axis] = c + Math.sign(rel) * (ROPE_HALF - 0.05);
  f.vel[axis] = -f.vel[axis] * 1.2 - Math.sign(rel) * 3;
}
