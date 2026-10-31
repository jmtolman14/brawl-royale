import { BUS_HEIGHT, BUS_SPEED, FREEFALL_SPEED, GLIDE_FALL, GLIDE_SPEED } from './constants';
import type { SimCtx } from './ctx';
import { setState } from './combat';
import { resolveStatic } from './statics';
import { approachAngle, dirToYaw, yawToDir } from './math';
import { heightAt, SEA_LEVEL } from './terrain';
import type { FighterState, InputFrame } from './types';

export const GLIDE_DEPLOY_HEIGHT = 45;

export function initBus(ctx: SimCtx) {
  const w = ctx.w;
  const a = ctx.rng.range(0, Math.PI * 2);
  const off = ctx.rng.range(-80, 80);
  const dirX = Math.cos(a);
  const dirZ = Math.sin(a);
  // Perpendicular offset so the path doesn't always cross dead centre
  const px = -dirZ * off;
  const pz = dirX * off;
  w.bus = { active: true, dirX, dirZ, length: 640, t: 0, x: px - dirX * 320, z: pz - dirZ * 320, y: BUS_HEIGHT };
  for (const f of w.fighters) {
    setState(f, 'bus');
    f.pos = { x: w.bus.x, y: BUS_HEIGHT, z: w.bus.z };
    f.prevPos = { ...f.pos };
  }
}

function jump(ctx: SimCtx, f: FighterState) {
  const b = ctx.w.bus;
  setState(f, 'glide');
  f.pos = { x: b.x, y: b.y - 3, z: b.z };
  f.prevPos = { ...f.pos };
  f.vel = { x: b.dirX * 10, y: 0, z: b.dirZ * 10 };
  f.yaw = dirToYaw(b.dirX, b.dirZ);
  ctx.ev.emit({ type: 'jump', fighter: f.id });
}

export function tickBus(ctx: SimCtx, dt: number, inputs: InputFrame[]) {
  const w = ctx.w;
  const b = w.bus;
  if (!b.active) return;
  b.t += BUS_SPEED * dt;
  b.x += b.dirX * BUS_SPEED * dt;
  b.z += b.dirZ * BUS_SPEED * dt;
  // Can only jump once the bus is over the island-ish
  const overIsland = Math.hypot(b.x, b.z) < 290;
  let anyOnBus = false;
  for (const f of w.fighters) {
    if (f.state !== 'bus') continue;
    f.pos.x = b.x;
    f.pos.z = b.z;
    f.pos.y = b.y;
    f.prevPos = { ...f.pos };
    if ((inputs[f.id]?.jump && overIsland) || b.t >= b.length - 20) jump(ctx, f);
    else anyOnBus = true;
  }
  if (!anyOnBus) {
    b.active = false;
    w.phase = 'playing';
  }
}

export function busJump(ctx: SimCtx, f: FighterState) {
  if (f.state === 'bus' && Math.hypot(ctx.w.bus.x, ctx.w.bus.z) < 290) jump(ctx, f);
}

export function tickGlide(ctx: SimCtx, f: FighterState, input: InputFrame, dt: number) {
  const ground = Math.max(heightAt(f.pos.x, f.pos.z), SEA_LEVEL - 0.9);
  const above = f.pos.y - ground;
  const deployed = above < GLIDE_DEPLOY_HEIGHT;
  const fwd = yawToDir(input.yaw);
  const rx = -fwd.z, rz = fwd.x;
  let wx = fwd.x * input.moveZ + rx * input.moveX;
  let wz = fwd.z * input.moveZ + rz * input.moveX;
  const mag = Math.min(1, Math.hypot(wx, wz));
  if (mag > 0.01) {
    const l = Math.hypot(wx, wz);
    wx /= l;
    wz /= l;
    f.yaw = approachAngle(f.yaw, dirToYaw(wx, wz), 3 * dt);
  }
  const hs = deployed ? GLIDE_SPEED : GLIDE_SPEED * 1.4;
  f.vel.x += (wx * hs * mag - f.vel.x) * Math.min(1, 2 * dt);
  f.vel.z += (wz * hs * mag - f.vel.z) * Math.min(1, 2 * dt);
  // Holding forward in freefall dives faster
  const fall = deployed ? GLIDE_FALL : FREEFALL_SPEED * (input.moveZ > 0.5 ? 1.3 : 1);
  f.vel.y += (-fall - f.vel.y) * Math.min(1, 3 * dt);
  f.pos.x += f.vel.x * dt;
  f.pos.y += f.vel.y * dt;
  f.pos.z += f.vel.z * dt;
  const r = Math.hypot(f.pos.x, f.pos.z);
  if (r > 300) {
    f.pos.x *= 300 / r;
    f.pos.z *= 300 / r;
  }
  if (above < 4) resolveStatic(f.pos, 0.55);
  const g2 = Math.max(heightAt(f.pos.x, f.pos.z), SEA_LEVEL - 0.9);
  if (f.pos.y <= g2) {
    f.pos.y = g2;
    f.vel.y = 0;
    f.vel.x *= 0.3;
    f.vel.z *= 0.3;
    setState(f, 'idle');
    f.onGround = true;
    ctx.ev.emit({ type: 'land', fighter: f.id });
  }
}
