// Procedural animation: maps fighter sim state → joint angles. No keyframes,
// just sine waves and eased phase curves driven by the move's frame data.
import type { AnimName } from '../../data/moves';
import { GETUP_TIME, KNOCKDOWN_TIME } from '../../sim/constants';
import { GLIDE_DEPLOY_HEIGHT } from '../../sim/drop';
import { getMove, moveTimes } from '../../sim/moves';
import { heightAt, SEA_LEVEL } from '../../sim/terrain';
import type { FighterState } from '../../sim/types';

export interface Pose {
  bodyY: number; // vertical offset of hips
  bodyX: number; // whole-body pitch (knockdown, roll)
  bodyZ: number; // whole-body roll
  spin: number; // extra yaw (spin kicks)
  torsoX: number;
  torsoY: number;
  headX: number;
  lShX: number; lShZ: number; lElX: number;
  rShX: number; rShZ: number; rElX: number;
  lHipX: number; lHipZ: number; lKnX: number;
  rHipX: number; rHipZ: number; rKnX: number;
  glider: number; // 0..1 glider visibility
}

export const restPose = (): Pose => ({
  bodyY: 0, bodyX: 0, bodyZ: 0, spin: 0, torsoX: 0, torsoY: 0, headX: 0,
  lShX: 0, lShZ: 0.15, lElX: 0, rShX: 0, rShZ: -0.15, rElX: 0,
  lHipX: 0, lHipZ: 0, lKnX: 0, rHipX: 0, rHipZ: 0, rKnX: 0, glider: 0,
});

const ease = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));
const out = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

function guard(p: Pose, t: number, intensity = 1) {
  const bob = Math.sin(t * 5) * 0.03 * intensity;
  p.bodyY = -0.08 + bob;
  p.torsoX = 0.12;
  p.torsoY = 0.25;
  p.lShX = 0.75; p.lShZ = 0.3; p.lElX = 1.9;
  p.rShX = 0.55; p.rShZ = -0.3; p.rElX = 2.1;
  p.lHipX = 0.25; p.lKnX = -0.35; p.lHipZ = 0.08;
  p.rHipX = -0.15; p.rKnX = -0.3; p.rHipZ = -0.08;
}

function strike(p: Pose, anim: AnimName, phase: 'wind' | 'hit' | 'rec', k: number, t: number) {
  // k: 0..1 progress within the phase. `e` = how extended the strike is.
  const e = phase === 'wind' ? -0.35 * ease(k) : phase === 'hit' ? out(k * 2) : 1 - ease(k);
  const w = phase === 'wind' ? ease(k) : phase === 'hit' ? 1 : 1 - ease(k);
  switch (anim) {
    case 'jab':
      p.lShX = 0.75 + (1.6 - 0.75) * Math.max(0, e); p.lElX = 1.9 * (1 - Math.max(0, e)); p.lShZ = 0.3 - 0.25 * Math.max(0, e);
      p.torsoY = 0.25 + 0.25 * e;
      break;
    case 'cross':
      p.rShX = 0.55 + 1.05 * Math.max(0, e); p.rElX = 2.1 * (1 - Math.max(0, e)); p.rShZ = -0.3 + 0.25 * Math.max(0, e);
      p.torsoY = 0.25 - 0.85 * e; p.rHipX = -0.15 - 0.2 * e;
      break;
    case 'hook':
      p.rShX = 1.4 * w; p.rShZ = -1.3 * w + 0.4 * e; p.rElX = 1.4 * w;
      p.torsoY = 0.6 * w - 1.6 * Math.max(0, e);
      break;
    case 'uppercut':
      p.bodyY = -0.25 * w + 0.1 * Math.max(0, e);
      p.rShX = 0.2 + 2.3 * Math.max(0, e); p.rElX = 1.6; p.torsoY = -0.6 * Math.max(0, e); p.torsoX = 0.3 * w - 0.4 * Math.max(0, e);
      break;
    case 'elbow':
      p.rShX = 1.5 * w; p.rShZ = -1.4 * w; p.rElX = 2.4; p.torsoY = 0.5 * w - 1.4 * Math.max(0, e);
      break;
    case 'palm':
      p.lShX = p.rShX = 0.6 + 1.0 * Math.max(0, e); p.lElX = p.rElX = 1.6 * (1 - Math.max(0, e));
      p.lShZ = 0.1; p.rShZ = -0.1; p.torsoX = 0.15 + 0.3 * Math.max(0, e); p.bodyY = -0.18;
      p.lHipX = 0.6 * Math.max(0, e); p.lKnX = -0.6;
      break;
    case 'kick':
      p.rHipX = 1.6 * Math.max(0, e) - 0.3 * w * (e < 0 ? 1 : 0); p.rHipZ = -0.5 * Math.max(0, e); p.rKnX = -1.6 * (1 - Math.max(0, e)) * w;
      p.torsoX = -0.35 * w; p.torsoY = 0.6 * w; p.lKnX = -0.2;
      break;
    case 'lowkick':
      p.rHipX = 0.6 * Math.max(0, e); p.rHipZ = -0.6 * Math.max(0, e); p.rKnX = -0.4;
      p.torsoY = 0.9 * w; p.torsoX = -0.1;
      break;
    case 'knee':
      p.rHipX = 1.8 * Math.max(0, e); p.rKnX = -2.2 * w; p.torsoX = -0.25 * w;
      p.lShX = p.rShX = 1.5 * w; p.lElX = p.rElX = 1.2;
      break;
    case 'spinkick': {
      p.spin = phase === 'wind' ? 0 : phase === 'hit' ? -Math.PI * 2 * out(k) : 0;
      p.rHipX = 1.5 * w; p.rHipZ = -0.9 * w; p.rKnX = -0.3; p.torsoX = -0.4 * w; p.torsoY = 0.4;
      break;
    }
    case 'grab':
      p.lShX = p.rShX = 1.4 * w + 0.2; p.lElX = p.rElX = 0.6; p.lShZ = 0.35 * w; p.rShZ = -0.35 * w;
      p.torsoX = 0.35 * w; p.bodyY = -0.2 * w;
      break;
    case 'flurry': {
      const s = Math.sin(t * 38);
      p.lShX = 1.0 + 0.6 * Math.max(0, s) * w; p.lElX = 1.9 * (1 - Math.max(0, s) * w);
      p.rShX = 1.0 + 0.6 * Math.max(0, -s) * w; p.rElX = 1.9 * (1 - Math.max(0, -s) * w);
      p.torsoY = 0.4 * s * w; p.torsoX = 0.2;
      break;
    }
    case 'leap':
      p.bodyX = 0.6 * w; p.rShX = 2.6 * w; p.rElX = 0.1; p.lShX = -0.6 * w; p.lHipX = 0.8 * w; p.lKnX = -1.4 * w; p.rHipX = -0.5 * w;
      break;
    case 'stomp':
      p.rHipX = phase === 'wind' ? 1.4 * ease(k) : 1.4 * (1 - out(k * 3)); p.rHipZ = -0.8 * w; p.rKnX = -0.8;
      p.bodyY = -0.35 * w; p.lShZ = 1.2 * w; p.rShZ = -1.2 * w; p.lElX = p.rElX = 0.3;
      break;
    case 'dash':
      p.bodyX = 0.5 * w; p.torsoX = 0.3 * w; p.rShX = 0.9; p.rShZ = -0.2; p.rElX = 1.6; p.lShX = 0.9; p.lElX = 1.6;
      p.lHipX = Math.sin(t * 20) * 0.8 * w; p.rHipX = -Math.sin(t * 20) * 0.8 * w; p.lKnX = p.rKnX = -0.8;
      break;
    case 'elbowdrop':
      p.rShX = 2.8 * w; p.rElX = 2.2; p.lShZ = 1.2 * w; p.bodyX = phase === 'hit' ? 1.2 * out(k) : phase === 'rec' ? 1.2 * (1 - ease(k)) : -0.2 * w;
      p.lHipX = 0.5 * w; p.rHipX = 0.5 * w; p.lKnX = p.rKnX = -1.0 * w;
      break;
    case 'counter':
      p.bodyY = -0.25; p.lShX = 1.2; p.rShX = 1.2; p.lShZ = 0.8; p.rShZ = -0.8; p.lElX = p.rElX = 0.9; p.torsoX = 0.2;
      p.lHipZ = 0.3; p.rHipZ = -0.3; p.lKnX = p.rKnX = -0.6;
      break;
  }
}

/** Compute the target pose for a fighter this frame. `t` = render time. */
export function computePose(f: FighterState, t: number, winner: boolean): Pose {
  const p = restPose();
  const st = f.stateTime;
  const speed = Math.hypot(f.vel.x, f.vel.z);
  switch (f.state) {
    case 'idle':
    case 'move': {
      guard(p, t + f.id, 1);
      if (winner) {
        p.lShX = p.rShX = 2.9; p.lElX = p.rElX = 0.3; p.lShZ = 0.5; p.rShZ = -0.5;
        p.bodyY = Math.abs(Math.sin(t * 6)) * 0.25;
        p.torsoY = 0;
        break;
      }
      if (speed > 0.5) {
        const sprint = speed > 7.5;
        const ph = t * (sprint ? 13 : 10) + f.id;
        const s = Math.sin(ph);
        const amp = Math.min(1, speed / 6) * (sprint ? 1.1 : 0.8);
        p.lHipX = s * amp; p.rHipX = -s * amp;
        p.lKnX = -Math.max(0, -Math.cos(ph)) * 1.4 * amp - 0.2;
        p.rKnX = -Math.max(0, Math.cos(ph)) * 1.4 * amp - 0.2;
        p.bodyY = -0.05 + Math.abs(Math.cos(ph)) * 0.08;
        p.torsoX = sprint ? 0.35 : 0.15;
        p.torsoY = 0.1;
        if (sprint) {
          p.lShX = -s * 0.9; p.rShX = s * 0.9; p.lElX = p.rElX = 1.5;
          p.lShZ = 0.15; p.rShZ = -0.15;
        }
        p.lHipZ = p.rHipZ = 0;
      }
      if (!f.onGround) {
        p.lHipX = 0.7; p.lKnX = -1.2; p.rHipX = -0.2; p.rKnX = -0.6;
      }
      break;
    }
    case 'block':
      guard(p, t, 0.3);
      p.lShX = 1.4; p.lShZ = 0.15; p.lElX = 2.3;
      p.rShX = 1.4; p.rShZ = -0.15; p.rElX = 2.3;
      p.torsoX = 0.25; p.torsoY = 0; p.bodyY = -0.15; p.headX = 0.3;
      break;
    case 'attack': {
      const m = getMove(f.move);
      if (!m) break;
      guard(p, t, 0.2);
      const tm = moveTimes(f, m);
      if (st < tm.s) strike(p, m.anim, 'wind', st / tm.s, t);
      else if (st < tm.s + tm.a) strike(p, m.anim, 'hit', (st - tm.s) / tm.a, t);
      else strike(p, m.anim, 'rec', (st - tm.s - tm.a) / tm.r, t);
      if (!f.onGround && m.anim !== 'leap' && m.anim !== 'elbowdrop') {
        p.lHipX = 0.6; p.lKnX = -1.2;
      }
      break;
    }
    case 'grapple': {
      const k = Math.min(1, st / Math.max(0.01, f.stateDur));
      p.lShX = p.rShX = 1.3; p.lElX = p.rElX = 1.2; p.lShZ = 0.4; p.rShZ = -0.4;
      p.torsoX = 0.3 - 1.4 * Math.sin(k * Math.PI) ; p.bodyY = -0.3 * Math.sin(k * Math.PI);
      p.lKnX = p.rKnX = -0.7 * Math.sin(k * Math.PI);
      p.lHipX = p.rHipX = 0.4 * Math.sin(k * Math.PI);
      break;
    }
    case 'grabbed': {
      const k = Math.min(1, st / Math.max(0.01, f.stateDur));
      p.bodyX = -k * Math.PI * 1.1;
      p.lShX = 2 * k; p.rShX = 2 * k; p.lShZ = 0.8; p.rShZ = -0.8;
      p.lHipX = 0.4; p.rHipX = -0.2; p.lKnX = -0.5;
      break;
    }
    case 'dodge': {
      const k = Math.min(1, st / Math.max(0.01, f.stateDur));
      // Local dodge direction relative to facing
      const fx = -Math.sin(f.yaw), fz = -Math.cos(f.yaw);
      const fwd = f.dodgeX * fx + f.dodgeZ * fz;
      const right = f.dodgeX * -fz + f.dodgeZ * fx;
      const roll = Math.PI * 2 * out(k);
      p.bodyX = fwd * roll;
      p.bodyZ = -right * roll;
      p.bodyY = -0.45 * Math.sin(k * Math.PI);
      p.lHipX = p.rHipX = 1.4; p.lKnX = p.rKnX = -2.0; p.lShX = p.rShX = 1.2; p.lElX = p.rElX = 1.8; p.torsoX = 0.6;
      break;
    }
    case 'stun': {
      const k = Math.min(1, st / Math.max(0.01, f.stateDur));
      const s = Math.sin(k * Math.PI);
      guard(p, t, 0);
      p.torsoX = -0.5 * s; p.headX = -0.6 * s; p.bodyY = -0.1;
      p.lShX = 0.3; p.lShZ = 0.9 * s; p.rShX = 0.3; p.rShZ = -0.9 * s; p.lElX = p.rElX = 0.6;
      p.torsoY = Math.sin(t * 20) * 0.15 * s;
      break;
    }
    case 'knockdown':
    case 'ko': {
      const k = Math.min(1, st / 0.35);
      p.bodyX = -Math.PI / 2 * ease(k);
      p.bodyY = -0.75 * ease(k);
      p.lShZ = 1.3; p.rShZ = -1.3; p.lElX = p.rElX = 0.3;
      p.lHipZ = 0.25; p.rHipZ = -0.25; p.lKnX = -0.3;
      if (f.state === 'knockdown' && st > KNOCKDOWN_TIME * 0.7) p.headX = -0.4; // trying to get up
      break;
    }
    case 'getup': {
      const k = Math.min(1, st / GETUP_TIME);
      p.bodyX = -Math.PI / 2 * (1 - ease(k));
      p.bodyY = -0.75 * (1 - ease(k));
      p.lHipX = p.rHipX = 1.2 * Math.sin(k * Math.PI); p.lKnX = p.rKnX = -1.6 * Math.sin(k * Math.PI);
      p.lShX = p.rShX = -0.8 * (1 - k);
      break;
    }
    case 'use':
      guard(p, t, 0.4);
      p.rShX = 2.2; p.rElX = 2.0; p.rShZ = -0.2; p.headX = -0.2 + Math.sin(t * 8) * 0.05;
      p.lShX = 0.9; p.lElX = 1.5;
      break;
    case 'glide': {
      const ground = Math.max(heightAt(f.pos.x, f.pos.z), SEA_LEVEL);
      const deployed = f.pos.y - ground < GLIDE_DEPLOY_HEIGHT;
      if (deployed) {
        p.glider = 1;
        p.lShX = p.rShX = 2.9; p.lElX = p.rElX = 0.2; p.lShZ = 0.3; p.rShZ = -0.3;
        p.lHipX = 0.2 + Math.sin(t * 3) * 0.2; p.rHipX = 0.1 - Math.sin(t * 3) * 0.2; p.lKnX = p.rKnX = -0.3;
        p.bodyX = 0.15;
      } else {
        p.bodyX = 1.3;
        p.lShX = p.rShX = 1.6; p.lShZ = 1.3; p.rShZ = -1.3; p.lElX = p.rElX = 0.4;
        p.lHipZ = 0.35; p.rHipZ = -0.35; p.lKnX = p.rKnX = -0.6 + Math.sin(t * 9) * 0.1;
      }
      break;
    }
  }
  return p;
}

const ANGULAR = new Set<keyof Pose>(['bodyX', 'bodyZ', 'spin']);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Ease the current pose toward the target. Whole-body rotations take the shortest way round. */
export function blendPose(cur: Pose, target: Pose, k: number, snapAngles: boolean) {
  for (const key in target) {
    const kk = key as keyof Pose;
    if (ANGULAR.has(kk)) {
      cur[kk] = snapAngles ? target[kk] : cur[kk] + wrap(target[kk] - cur[kk]) * k;
    } else cur[kk] += (target[kk] - cur[kk]) * k;
  }
}
