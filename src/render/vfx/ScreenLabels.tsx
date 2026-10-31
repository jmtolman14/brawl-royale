// Damage numbers and enemy health bars, drawn as DOM elements positioned by
// projecting world points each frame (cheaper than <Html> per fighter).
import { useFrame } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { onFx } from '../../game/fx';
import { session } from '../../game/session';
import { PLAYER_ID } from '../../sim/constants';

interface Num {
  x: number; y: number; z: number;
  text: string; color: string; life: number; big: boolean; dx: number;
}
const nums: Num[] = [];
const MAX_NUMS = 24;
const MAX_BARS = 8;

export const labelEls: { nums: HTMLDivElement[]; bars: HTMLDivElement[] } = { nums: [], bars: [] };

const v = new THREE.Vector3();

/** Lives inside the Canvas: updates DOM element positions each frame. */
export function ScreenLabelDriver() {
  useEffect(
    () =>
      onFx((e) => {
        if (e.type === 'hit' || e.type === 'throw') {
          const mine = e.attacker === PLAYER_ID;
          const onMe = e.target === PLAYER_ID;
          if (!mine && !onMe) return;
          if (nums.length >= MAX_NUMS) nums.shift();
          const blocked = e.type === 'hit' && e.blocked;
          nums.push({
            x: e.x, y: e.y + 0.4, z: e.z,
            text: blocked ? `${Math.max(1, Math.round(e.damage))}` : `${Math.round(e.damage)}`,
            color: onMe ? '#f87171' : blocked ? '#94a3b8' : e.type === 'hit' && e.shield ? '#60a5fa' : e.type === 'throw' || e.damage >= 18 ? '#fbbf24' : '#ffffff',
            life: 0, big: e.type === 'throw' || e.damage >= 18, dx: (Math.random() - 0.5) * 40,
          });
        } else if (e.type === 'parry' && (e.attacker === PLAYER_ID || e.target === PLAYER_ID)) {
          nums.push({ x: e.x, y: e.y + 0.6, z: e.z, text: 'PARRY!', color: '#7dd3fc', life: 0, big: true, dx: 0 });
        }
      }),
    [],
  );

  useFrame(({ camera, size }, dt) => {
    const r = session.runner;
    if (!r) return;
    const project = (x: number, y: number, z: number) => {
      v.set(x, y, z).project(camera);
      return { sx: (v.x * 0.5 + 0.5) * size.width, sy: (-v.y * 0.5 + 0.5) * size.height, vis: v.z < 1 && v.z > -1 };
    };
    // Damage numbers
    for (let i = nums.length - 1; i >= 0; i--) {
      nums[i].life += dt;
      if (nums[i].life > 0.9) nums.splice(i, 1);
    }
    labelEls.nums.forEach((el, i) => {
      const n = nums[i];
      if (!n) {
        el.style.display = 'none';
        return;
      }
      const p = project(n.x, n.y + n.life * 1.4, n.z);
      if (!p.vis) {
        el.style.display = 'none';
        return;
      }
      el.style.display = 'block';
      el.textContent = n.text;
      el.style.color = n.color;
      el.style.opacity = String(1 - Math.max(0, n.life - 0.5) / 0.4);
      const sc = (n.big ? 1.5 : 1) * (1 + Math.max(0, 0.15 - n.life) * 4);
      el.style.transform = `translate(${p.sx + n.dx * n.life}px, ${p.sy}px) translate(-50%, -50%) scale(${sc})`;
    });
    // Health bars over nearby enemies that are damaged or locked
    const w = r.world;
    const me = w.fighters[PLAYER_ID];
    const cands = w.fighters
      .filter((f) => f.id !== PLAYER_ID && f.alive && f.state !== 'bus' && Math.hypot(f.pos.x - me.pos.x, f.pos.z - me.pos.z) < 22 && (f.hp < f.maxHp || f.id === session.lockTarget || w.time - f.lastCombatAt < 5))
      .sort((a, b) => (a.id === session.lockTarget ? -1 : b.id === session.lockTarget ? 1 : 0))
      .slice(0, MAX_BARS);
    labelEls.bars.forEach((el, i) => {
      const f = cands[i];
      if (!f) {
        el.style.display = 'none';
        return;
      }
      const p = project(f.pos.x, f.pos.y + 2.5, f.pos.z);
      if (!p.vis) {
        el.style.display = 'none';
        return;
      }
      el.style.display = 'block';
      el.style.transform = `translate(${p.sx}px, ${p.sy}px) translate(-50%, -100%)`;
      const hp = el.children[1].firstElementChild as HTMLDivElement;
      const sh = el.children[1].lastElementChild as HTMLDivElement;
      hp.style.width = `${(f.hp / f.maxHp) * 100}%`;
      sh.style.width = `${f.shield}%`;
      (el.children[0] as HTMLDivElement).textContent = (f.id === session.lockTarget ? '◎ ' : '') + f.name + (w.championId === f.id ? ' 🏆' : '');
      el.style.outline = f.id === session.lockTarget ? '1px solid #fbbf24' : 'none';
    });
  });
  return null;
}

/** Lives in the DOM over the canvas. */
export function ScreenLabels() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: MAX_BARS }, (_, i) => (
        <div key={`b${i}`} ref={(el) => el && (labelEls.bars[i] = el)} className="absolute left-0 top-0 hidden w-24 rounded bg-black/40 px-1 pb-1 text-center" style={{ display: 'none' }}>
          <div className="truncate text-[11px] font-bold leading-4 text-white">.</div>
          <div className="relative h-1.5 w-full overflow-hidden rounded bg-black/60">
            <div className="absolute left-0 top-0 h-full bg-red-500" />
            <div className="absolute left-0 top-0 h-[40%] bg-sky-400" />
          </div>
        </div>
      ))}
      {Array.from({ length: MAX_NUMS }, (_, i) => (
        <div
          key={`n${i}`}
          ref={(el) => el && (labelEls.nums[i] = el)}
          className="absolute left-0 top-0 font-display text-3xl"
          style={{ display: 'none', textShadow: '0 2px 0 #000, 0 0 8px rgba(0,0,0,.6)', WebkitTextStroke: '1px #000' }}
        />
      ))}
    </div>
  );
}
