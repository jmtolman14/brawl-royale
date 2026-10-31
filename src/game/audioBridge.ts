// Maps sim events to synthesized sounds, attenuated and panned by distance from the camera.
import { sfx, setCrowd } from '../audio/sfx';
import { PLAYER_ID } from '../sim/constants';
import { angleDiff, dirToYaw } from '../sim/math';
import type { GameEvent } from '../sim/types';
import { onFx } from './fx';
import { session } from './session';

function spatial(x: number, z: number): [number, number] | null {
  const r = session.runner;
  if (!r) return null;
  const me = r.world.fighters[session.cameraTarget] ?? r.world.fighters[PLAYER_ID];
  const d = Math.hypot(x - me.pos.x, z - me.pos.z);
  if (d > 45) return null;
  const vol = 1 / (1 + d / 7);
  const rel = angleDiff(session.input.yaw, dirToYaw(x - me.pos.x, z - me.pos.z));
  return [-Math.sin(rel) * 0.8, vol];
}

const at = (id: number) => session.runner?.world.fighters[id]?.pos;

export function installAudio() {
  let lastCrowd = 0;
  const off = onFx((e: GameEvent) => {
    const w = session.runner?.world;
    if (!w) return;
    switch (e.type) {
      case 'hit': {
        const s = spatial(e.x, e.z);
        if (!s) return;
        if (e.blocked) sfx.block(s[0], s[1]);
        else sfx.punch(e.heavy, s[0], s[1]);
        break;
      }
      case 'swing': {
        const p = at(e.attacker);
        const s = p && spatial(p.x, p.z);
        if (s) sfx.whoosh(e.heavy, s[0], s[1]);
        break;
      }
      case 'parry': {
        const s = spatial(e.x, e.z);
        if (s) sfx.parry(s[0], s[1]);
        break;
      }
      case 'throw': {
        const s = spatial(e.x, e.z);
        if (s) sfx.slam(s[0], s[1]);
        if (e.attacker === PLAYER_ID) sfx.cheer(0.7);
        break;
      }
      case 'ko':
        if (e.by === PLAYER_ID || e.target === PLAYER_ID) {
          sfx.bell(e.by === PLAYER_ID ? 2 : 1);
          if (e.by === PLAYER_ID) sfx.cheer(1);
        }
        break;
      case 'crate': {
        const s = spatial(e.x, e.z);
        if (s) sfx.crate(s[0], s[1]);
        break;
      }
      case 'pickup':
        if (e.fighter === PLAYER_ID) sfx.pickup();
        break;
      case 'use':
        if (e.fighter === PLAYER_ID) sfx.use();
        break;
      case 'ringPhase':
        if (e.stage === 'shrink') sfx.storm();
        break;
      case 'mainEvent':
        sfx.bell(3);
        sfx.cheer(1.3);
        break;
      case 'jump':
        if (e.fighter === PLAYER_ID) sfx.jump();
        break;
      case 'land':
        if (e.fighter === PLAYER_ID) sfx.land(1);
        break;
      case 'finisher': {
        const p = at(e.fighter);
        if (p && spatial(p.x, p.z)) {
          sfx.finisher();
          sfx.cheer(1.4);
        }
        break;
      }
      case 'hypeFull':
        if (e.fighter === PLAYER_ID) sfx.cheer(1.2);
        break;
      case 'win':
        if (e.fighter === PLAYER_ID) {
          sfx.bell(3);
          sfx.cheer(2);
        }
        break;
    }
    // Crowd ambience tracks the player's hype (cheap: only on events)
    const p = w.fighters[PLAYER_ID];
    const lvl = p.alive ? p.hype / 100 : 0.2;
    if (Math.abs(lvl - lastCrowd) > 0.03) {
      lastCrowd = lvl;
      setCrowd(lvl);
    }
  });
  return off;
}
