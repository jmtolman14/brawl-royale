// Drives the simulation from the R3F frame loop and bridges sim → HUD/audio/VFX.
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { getFighter } from '../data/fighters';
import { ITEM_BY_ID } from '../data/items';
import { SIGNATURES } from '../data/moves';
import { canBeTargeted } from '../sim/combat';
import { PLAYER_ID } from '../sim/constants';
import { nearestPickup } from '../sim/loot';
import { angleDiff, dirToYaw } from '../sim/math';
import { RING_PHASES } from '../sim/ring';
import type { GameEvent } from '../sim/types';
import { useUi } from '../store/ui';
import { session } from './session';
import { handleEventFx } from './fx';

export function toggleLock() {
  const r = session.runner;
  if (!r) return;
  if (session.lockTarget >= 0) {
    session.lockTarget = -1;
    return;
  }
  const w = r.world;
  const p = w.fighters[PLAYER_ID];
  let best = -1;
  let bestScore = Infinity;
  for (const f of w.fighters) {
    if (f.id === PLAYER_ID || !canBeTargeted(f)) continue;
    const dx = f.pos.x - p.pos.x, dz = f.pos.z - p.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 25) continue;
    const ang = Math.abs(angleDiff(session.input.yaw, dirToYaw(dx, dz)));
    const score = d + ang * 8;
    if (score < bestScore) {
      bestScore = score;
      best = f.id;
    }
  }
  session.lockTarget = best;
}

export function GameLoop() {
  const hudTimer = useRef(0);
  useEffect(() => {
    useUi.getState().set({ feed: [], banner: null, results: null, hud: null });
  }, []);

  useFrame((_, dt) => {
    const r = session.runner;
    if (!r) return;
    const ui = useUi.getState();
    const w = r.world;
    const p = w.fighters[PLAYER_ID];
    session.input.enabled = !ui.paused;
    // Drop lock if target died or got far away
    if (session.lockTarget >= 0) {
      const t = w.fighters[session.lockTarget];
      if (!t || !t.alive || Math.hypot(t.pos.x - p.pos.x, t.pos.z - p.pos.z) > 30) session.lockTarget = -1;
    }
    const input = session.input.sample(dt, session.lockTarget, p.slot);
    if (!ui.paused) r.update(dt, input);
    const events = r.events.drain();
    for (const e of events) handleEvent(e);

    hudTimer.current += dt;
    if (hudTimer.current > 0.1) {
      hudTimer.current = 0;
      publishHud();
    }
  }, -2);
  return null;
}

function nameOf(id: number) {
  const r = session.runner!;
  const f = r.world.fighters[id];
  if (!f) return '???';
  return f.id === PLAYER_ID ? 'YOU' : f.name;
}

function handleEvent(e: GameEvent) {
  const ui = useUi.getState();
  const r = session.runner!;
  const w = r.world;
  handleEventFx(e);
  switch (e.type) {
    case 'ko': {
      const killer = e.by >= 0 ? nameOf(e.by) : null;
      ui.pushFeed(killer ? `${killer} KO'd ${nameOf(e.target)}` : `${nameOf(e.target)} was taken by the storm`, 'ko');
      if (e.target === PLAYER_ID) {
        session.lockTarget = -1;
        if (e.by >= 0) session.cameraTarget = e.by;
        setTimeout(() => finishMatch(false, killer), 2500);
      } else if (e.by === PLAYER_ID) {
        ui.showBanner('KNOCKOUT!', `${nameOf(e.target)} eliminated · ${w.aliveCount} left`);
      }
      // Spectating: follow the killer of whoever we were watching
      if (e.target === session.cameraTarget && e.target !== PLAYER_ID && e.by >= 0) session.cameraTarget = e.by;
      break;
    }
    case 'win':
      if (e.fighter === PLAYER_ID) {
        ui.showBanner('WINNER WINNER', 'CHAMPION OF THE ISLAND');
        setTimeout(() => finishMatch(true, null), 3500);
      } else if (!w.fighters[PLAYER_ID].alive) {
        ui.pushFeed(`${nameOf(e.fighter)} wins the Brawl Royale!`, 'champ');
      }
      break;
    case 'ringPhase':
      if (e.stage === 'shrink') ui.pushFeed('The storm is closing in!', 'storm');
      else ui.pushFeed(`Next safe zone marked · phase ${e.phase + 1}/${RING_PHASES.length}`, 'storm');
      break;
    case 'mainEvent':
      ui.showBanner('MAIN EVENT', 'The final circle is a wrestling ring. Ropes bounce you back!');
      break;
    case 'champion':
      ui.pushFeed(`${nameOf(e.fighter)} claimed the CHAMPIONSHIP BELT`, 'champ');
      if (e.fighter === PLAYER_ID) ui.showBanner('NEW CHAMPION', 'Everyone can see you on the map. Defend the belt!');
      break;
    case 'hypeFull':
      if (e.fighter === PLAYER_ID) ui.showBanner('CROWD IS ON THEIR FEET', 'Press F for your FINISHER');
      break;
    case 'signature':
      if (e.fighter !== PLAYER_ID) break;
      break;
    case 'land':
      if (e.fighter === PLAYER_ID && !useUi.getState().training) ui.pushFeed('Landed. Loot up with E!', 'info');
      break;
    default:
      break;
  }
}

function finishMatch(won: boolean, killedBy: string | null) {
  const r = session.runner;
  if (!r) return;
  const w = r.world;
  const p = w.fighters[PLAYER_ID];
  const winner = w.winner >= 0 ? w.fighters[w.winner] : null;
  useUi.getState().set({
    results: {
      won,
      placement: won ? 1 : p.placement,
      total: w.fighters.length,
      kills: p.kills,
      damage: Math.round(p.damageDealt),
      time: w.time,
      killedBy,
      winnerName: winner ? (winner.id === PLAYER_ID ? 'YOU' : winner.name) : '',
    },
  });
}

export function publishHud() {
  const r = session.runner;
  if (!r) return;
  const w = r.world;
  const p = w.fighters[PLAYER_ID];
  const sig = SIGNATURES[getFighter(p.rosterId).signature];
  const lt = session.lockTarget >= 0 ? w.fighters[session.lockTarget] : null;
  const np = p.alive && p.state !== 'bus' && p.state !== 'glide' ? nearestPickup(w, p) : null;
  let prompt: string | null = null;
  if (np) {
    if (np.kind === 'crate') prompt = '[E] Open crate';
    else {
      const it = w.items[np.idx];
      prompt = `[E] Pick up ${ITEM_BY_ID[it.itemId]?.name ?? it.itemId}${it.count > 1 ? ` x${it.count}` : ''}`;
    }
  }
  const spect = session.cameraTarget !== PLAYER_ID ? w.fighters[session.cameraTarget] : null;
  useUi.getState().set({
    hud: {
      hp: p.hp, maxHp: p.maxHp, shield: p.shield, stamina: p.stamina, maxStamina: p.maxStamina, hype: p.hype,
      sigCooldown: Math.max(0, p.sigReadyAt - w.time), sigTotal: sig?.cooldown ?? 10,
      inventory: p.inventory.map((s) => (s ? { ...s } : null)), slot: p.slot,
      alive: w.aliveCount, total: w.fighters.length, kills: p.kills,
      ringPhase: w.ring.phase, ringStage: w.ring.stage, ringTime: Math.max(0, w.ring.stageDur - w.ring.stageTime),
      inStorm: p.alive && w.ring.phase >= 0 && Math.hypot(p.pos.x - w.ring.cx, p.pos.z - w.ring.cz) > w.ring.r && p.state !== 'bus' && p.state !== 'glide',
      phase: w.phase, playerState: p.state, prompt,
      lockName: lt && lt.alive ? lt.name : null, lockHp: lt ? lt.hp / lt.maxHp : 0,
      useProgress: p.state === 'use' ? p.stateTime / Math.max(0.01, p.stateDur) : 0,
      buffs: p.buffs.map((b) => b.kind), champion: w.championId === PLAYER_ID, mainEvent: w.mainEvent,
      spectating: spect ? spect.name : null,
      canJump: p.state === 'bus' && Math.hypot(w.bus.x, w.bus.z) < 290,
    },
  });
}
