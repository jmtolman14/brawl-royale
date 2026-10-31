import { useEffect, useRef } from 'react';
import { ZONES } from '../data/map';
import { session } from '../game/session';
import { PLAYER_ID } from '../sim/constants';
import { MAP_HALF } from '../sim/terrain';
import { getMapImage, MAP_PX } from './mapImage';

const PX_PER_M = MAP_PX / (MAP_HALF * 2);

/** Draws storm circles, the player arrow and the champion marker. `full` = whole island. */
function drawMap(ctx: CanvasRenderingContext2D, size: number, full: boolean) {
  const r = session.runner;
  if (!r) return;
  const w = r.world;
  const me = w.fighters[session.cameraTarget] ?? w.fighters[PLAYER_ID];
  const img = getMapImage();
  // View: metres visible across the canvas
  const span = full ? MAP_HALF * 2 : 220;
  const scale = size / span; // px per metre
  const cx = full ? 0 : me.pos.x;
  const cz = full ? 0 : me.pos.z;
  const toPx = (x: number, z: number) => ({ x: (x - cx) * scale + size / 2, y: (z - cz) * scale + size / 2 });
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#1e6eb4';
  ctx.fillRect(0, 0, size, size);
  const o = toPx(-MAP_HALF, -MAP_HALF);
  ctx.drawImage(img, o.x, o.y, MAP_PX / PX_PER_M * scale, MAP_PX / PX_PER_M * scale);
  // Storm: shade outside current circle
  const ring = w.ring;
  if (ring.phase >= 0) {
    const c = toPx(ring.cx, ring.cz);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, size, size);
    ctx.arc(c.x, c.y, Math.max(0, ring.r * scale), 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(126, 34, 206, 0.45)';
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c.x, c.y, Math.max(0, ring.r * scale), 0, Math.PI * 2);
    ctx.stroke();
    if (ring.stage === 'wait') {
      const n = toPx(ring.toX, ring.toZ);
      ctx.strokeStyle = '#ffffff';
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(n.x, n.y, ring.toR * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // Line from player to next zone if outside it
      const dm = Math.hypot(me.pos.x - ring.toX, me.pos.z - ring.toZ);
      if (dm > ring.toR && me.alive) {
        const p = toPx(me.pos.x, me.pos.z);
        ctx.strokeStyle = 'rgba(255,255,255,.6)';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(n.x + ((p.x - n.x) / (dm * scale)) * ring.toR * scale, n.y + ((p.y - n.y) / (dm * scale)) * ring.toR * scale);
        ctx.stroke();
      }
    }
  }
  if (full) {
    ctx.font = 'bold 13px Barlow, sans-serif';
    ctx.textAlign = 'center';
    for (const z of ZONES) {
      const p = toPx(z.x, z.z);
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      const tw = ctx.measureText(z.name.toUpperCase()).width;
      ctx.fillRect(p.x - tw / 2 - 4, p.y - 10, tw + 8, 16);
      ctx.fillStyle = '#fff';
      ctx.fillText(z.name.toUpperCase(), p.x, p.y + 2);
    }
  }
  // Bus path
  if (w.bus.active) {
    const b = w.bus;
    const s = toPx(b.x - b.dirX * b.t, b.z - b.dirZ * b.t);
    const e = toPx(b.x + b.dirX * (b.length - b.t), b.z + b.dirZ * (b.length - b.t));
    ctx.strokeStyle = 'rgba(251, 191, 36, .9)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(e.x, e.y);
    ctx.stroke();
    ctx.setLineDash([]);
    const bp = toPx(b.x, b.z);
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.ellipse(bp.x, bp.y, 7, 4, Math.atan2(b.dirZ, b.dirX), 0, Math.PI * 2);
    ctx.fill();
  }
  // Champion bounty marker (everyone can see the champ)
  if (w.championId >= 0 && w.championId !== PLAYER_ID) {
    const c = w.fighters[w.championId];
    const p = toPx(c.pos.x, c.pos.z);
    const pulse = 6 + Math.sin(performance.now() / 150) * 2;
    ctx.fillStyle = '#f59e0b';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(Math.max(6, Math.min(size - 6, p.x)), Math.max(6, Math.min(size - 6, p.y)), pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#000';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', Math.max(6, Math.min(size - 6, p.x)), Math.max(6, Math.min(size - 6, p.y)) + 3);
  }
  // Player arrow
  const p = toPx(me.pos.x, me.pos.z);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(-session.input.yaw);
  ctx.fillStyle = me.id === PLAYER_ID ? '#fde047' : '#f87171';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(6, 6);
  ctx.lineTo(0, 3);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function Minimap({ size, full = false }: { size: number; full?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last < 50) return; // ~20fps is plenty
      last = t;
      const ctx = ref.current?.getContext('2d');
      if (ctx) drawMap(ctx, size, full);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [size, full]);
  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      className={full ? 'rounded-lg ring-2 ring-white/30' : 'rounded-full ring-2 ring-white/40'}
      style={{ width: size, height: size }}
    />
  );
}
