import { useEffect, useState } from 'react';
import { getFighter } from '../data/fighters';
import { ITEM_BY_ID, RARITY_COLOR } from '../data/items';
import { PASSIVES, SIGNATURES } from '../data/moves';
import { RING_PHASES } from '../sim/ring';
import { useUi } from '../store/ui';
import { ItemIcon } from './ItemIcon';
import { Minimap } from './Minimap';
import { session } from '../game/session';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function Bar({ value, max, color, label, h = 'h-4', glow }: { value: number; max: number; color: string; label?: string; h?: string; glow?: boolean }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`relative ${h} w-full overflow-hidden rounded-sm bg-black/55 ring-1 ring-white/10`}>
      <div className="absolute inset-y-0 left-0 transition-[width] duration-100" style={{ width: `${pct}%`, background: color, boxShadow: glow ? `0 0 12px ${color}` : undefined }} />
      {label && <div className="absolute inset-0 flex items-center px-2 text-[11px] font-extrabold tracking-wide text-white drop-shadow">{label}</div>}
    </div>
  );
}

const BUFF_LABEL: Record<string, [string, string]> = {
  adrenaline: ['ADRENALINE', '#f97316'],
  slow: ['SLOWED', '#94a3b8'],
  champion: ['CHAMPION', '#f59e0b'],
  wraps: ['TAPE WRAPS', '#4ade80'],
  knucks: ['IRON KNUCKS', '#3b82f6'],
  energy: ['ENERGIZED', '#facc15'],
};

export function HUD() {
  const hud = useUi((s) => s.hud);
  const feed = useUi((s) => s.feed);
  const banner = useUi((s) => s.banner);
  const fighterId = useUi((s) => s.fighterId);
  const training = useUi((s) => s.training);
  const [showBanner, setShowBanner] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!banner) return;
    setShowBanner(true);
    const t = setTimeout(() => setShowBanner(false), 2600);
    return () => clearTimeout(t);
  }, [banner]);

  useEffect(() => {
    const onChange = () => setLocked(!!document.pointerLockElement);
    document.addEventListener('pointerlockchange', onChange);
    return () => document.removeEventListener('pointerlockchange', onChange);
  }, []);

  if (!hud) return null;
  const def = getFighter(fighterId);
  const sig = SIGNATURES[def.signature];
  const hypeFull = hud.hype >= 100;
  const now = performance.now();
  const ringLabel = hud.ringStage === 'shrink' ? 'STORM CLOSING' : hud.ringStage === 'done' ? 'FINAL STORM' : 'STORM SHRINKS IN';

  return (
    <div className="pointer-events-none absolute inset-0 select-none font-body text-white">
      {/* Storm vignette */}
      {hud.inStorm && <div className="absolute inset-0 animate-pulse" style={{ boxShadow: 'inset 0 0 160px 40px rgba(147, 51, 234, 0.55)' }} />}

      {/* Top-right: minimap + counters */}
      {!training && (
        <div className="absolute right-4 top-4 flex flex-col items-end gap-2">
          <Minimap size={190} />
          <div className="flex gap-2 text-sm font-extrabold">
            <div className="rounded bg-black/55 px-3 py-1">👥 {hud.alive} LEFT</div>
            <div className="rounded bg-black/55 px-3 py-1">💥 {hud.kills} KO</div>
          </div>
          <div className={`rounded px-3 py-1 text-right text-xs font-bold ${hud.ringStage === 'shrink' ? 'bg-purple-700/80' : 'bg-black/55'}`}>
            <div className="opacity-80">{ringLabel} · PHASE {Math.min(hud.ringPhase + 1, RING_PHASES.length)}/{RING_PHASES.length}</div>
            <div className="font-display text-2xl leading-6">{hud.ringStage === 'done' ? '—' : fmt(hud.ringTime)}</div>
          </div>
        </div>
      )}
      {training && (
        <div className="absolute right-4 top-4 max-w-xs rounded bg-black/60 p-3 text-sm">
          <div className="font-display text-2xl text-amber-300">TRAINING GROUND</div>
          <div className="opacity-80">Practice on the sparring partner. They fight back gently. Press Esc for the menu.</div>
        </div>
      )}

      {/* Kill feed */}
      <div className="absolute left-4 top-4 flex w-80 flex-col gap-1">
        {feed.filter((f) => now - f.time < 7000).map((f) => (
          <div
            key={f.id}
            className={`rounded px-2 py-1 text-sm font-semibold backdrop-blur-sm ${f.kind === 'ko' ? 'bg-black/55' : f.kind === 'storm' ? 'bg-purple-800/70' : f.kind === 'champ' ? 'bg-amber-600/80' : 'bg-sky-800/60'}`}
          >
            {f.text}
          </div>
        ))}
      </div>

      {/* Center banner */}
      {banner && showBanner && (
        <div key={banner.id} className="absolute left-1/2 top-[18%] -translate-x-1/2 text-center" style={{ animation: 'pop .35s ease-out' }}>
          <div className="font-display text-7xl tracking-wider text-amber-300" style={{ textShadow: '0 4px 0 #7c2d12, 0 0 30px rgba(251,191,36,.6)' }}>
            {banner.text}
          </div>
          {banner.sub && <div className="mt-1 text-lg font-bold drop-shadow">{banner.sub}</div>}
        </div>
      )}

      {/* Spectating */}
      {hud.spectating && (
        <div className="absolute left-1/2 top-24 -translate-x-1/2 rounded bg-black/60 px-4 py-1 font-bold">SPECTATING {hud.spectating}</div>
      )}

      {/* Bus */}
      {hud.playerState === 'bus' && (
        <div className="absolute bottom-40 left-1/2 -translate-x-1/2 text-center">
          <div className="font-display text-5xl drop-shadow-lg">{hud.canJump ? 'PRESS SPACE TO DROP' : 'BATTLE BLIMP INBOUND…'}</div>
          <div className="mt-1 text-sm font-semibold opacity-90">Open the map (M) to pick a landing spot. You'll auto-drop at the end of the route.</div>
        </div>
      )}
      {hud.playerState === 'glide' && (
        <div className="absolute bottom-40 left-1/2 -translate-x-1/2 rounded bg-black/40 px-4 py-1 text-sm font-bold">WASD to steer · hold W to dive</div>
      )}

      {/* Lock-on */}
      {hud.lockName && (
        <div className="absolute left-1/2 top-6 w-72 -translate-x-1/2 text-center">
          <div className="text-sm font-extrabold tracking-wider text-amber-300">◎ LOCKED: {hud.lockName}</div>
          <Bar value={hud.lockHp} max={1} color="#ef4444" h="h-2" />
        </div>
      )}

      {/* Interaction prompt */}
      {hud.prompt && hud.playerState !== 'bus' && (
        <div className="absolute left-1/2 top-[62%] -translate-x-1/2 rounded bg-black/65 px-3 py-1.5 text-sm font-bold ring-1 ring-white/20">{hud.prompt}</div>
      )}

      {/* Use progress */}
      {hud.useProgress > 0 && (
        <div className="absolute left-1/2 top-[56%] w-48 -translate-x-1/2">
          <Bar value={hud.useProgress} max={1} color="#4ade80" h="h-2" />
        </div>
      )}

      {/* Click to play */}
      {!locked && !session.input.usingPad && hud.phase !== 'over' && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-black/70 px-6 py-3 text-center">
          <div className="font-display text-3xl">CLICK TO FIGHT</div>
          <div className="text-xs opacity-80">Captures your mouse for camera control · Esc releases it</div>
        </div>
      )}

      {/* Bottom-left: vitals */}
      <div className="absolute bottom-5 left-5 w-80">
        <div className="mb-1 flex items-end justify-between">
          <div>
            <div className="font-display text-3xl leading-7" style={{ color: def.colors.primary === '#f2f2f2' || def.colors.primary === '#f8f9fa' ? '#fff' : def.colors.primary }}>
              {def.nickname.toUpperCase()}
            </div>
            <div className="text-[11px] font-bold opacity-70">{PASSIVES[def.passive]?.name}: {PASSIVES[def.passive]?.desc}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 pb-1">
          {hud.buffs.map((b) => (
            <span key={b} className="rounded px-1.5 text-[10px] font-extrabold" style={{ background: BUFF_LABEL[b]?.[1] ?? '#555' }}>
              {BUFF_LABEL[b]?.[0] ?? b}
            </span>
          ))}
        </div>
        <div className="space-y-1">
          <Bar value={hud.shield} max={100} color="linear-gradient(90deg,#2563eb,#60a5fa)" label={hud.shield > 0 ? `${Math.ceil(hud.shield)} SHIELD` : undefined} h="h-3" />
          <Bar value={hud.hp} max={hud.maxHp} color="linear-gradient(90deg,#16a34a,#4ade80)" label={`${Math.ceil(hud.hp)} / ${hud.maxHp}`} h="h-5" />
          <Bar value={hud.stamina} max={hud.maxStamina} color={hud.stamina < 20 ? '#ef4444' : 'linear-gradient(90deg,#ca8a04,#facc15)'} label="STAMINA" h="h-2.5" />
          <div className="pt-1">
            <div className="flex justify-between text-[10px] font-extrabold tracking-wider">
              <span className={hypeFull ? 'animate-pulse text-amber-300' : ''}>📣 CROWD HYPE {hypeFull ? '· FINISHER READY (F)' : ''}</span>
              <span>{Math.floor(hud.hype)}%</span>
            </div>
            <Bar value={hud.hype} max={100} color={hypeFull ? 'linear-gradient(90deg,#f59e0b,#fde047)' : 'linear-gradient(90deg,#db2777,#f472b6)'} h="h-2" glow={hypeFull} />
          </div>
        </div>
      </div>

      {/* Bottom-center: hotbar */}
      <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-1.5">
        {hud.inventory.map((s, i) => {
          const def = s ? ITEM_BY_ID[s.itemId] : null;
          const c = def ? RARITY_COLOR[def.rarity] : '#ffffff22';
          return (
            <div
              key={i}
              className={`relative h-16 w-16 rounded-md bg-black/55 transition-transform ${hud.slot === i ? '-translate-y-1.5 ring-2 ring-white' : 'ring-1 ring-white/15'}`}
              style={{ boxShadow: def ? `inset 0 -18px 24px -12px ${c}` : undefined }}
            >
              <span className="absolute left-1 top-0.5 text-[10px] font-bold opacity-70">{i + 1}</span>
              {def && (
                <>
                  <div className="absolute inset-0 grid place-items-center"><ItemIcon shape={def.shape} color={c} /></div>
                  <span className="absolute bottom-0.5 right-1 text-xs font-extrabold">{s!.count > 1 ? s!.count : ''}</span>
                  <div className="absolute inset-x-0 bottom-0 h-1 rounded-b-md" style={{ background: c }} />
                </>
              )}
            </div>
          );
        })}
      </div>
      {(() => {
        const s = hud.inventory[hud.slot];
        const d = s ? ITEM_BY_ID[s.itemId] : null;
        if (!d) return null;
        return (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 text-center text-xs font-bold">
            <span style={{ color: RARITY_COLOR[d.rarity] }}>{d.name}</span> <span className="opacity-80">— {d.desc} {d.kind === 'throwable' ? '' : '[R] to use'}</span>
          </div>
        );
      })()}

      {/* Bottom-right: signature */}
      <div className="absolute bottom-5 right-5 flex items-end gap-3">
        <div className="text-right text-xs font-semibold opacity-80">
          <div>LMB light · RMB heavy · E grab</div>
          <div>Q block · C dodge · Tab lock-on</div>
        </div>
        <div className={`relative grid h-20 w-20 place-items-center overflow-hidden rounded-full ring-2 ${hypeFull ? 'bg-amber-500/80 ring-amber-200' : 'bg-black/60 ring-white/20'}`}>
          {!hypeFull && hud.sigCooldown > 0 && (
            <div className="absolute inset-x-0 bottom-0 bg-white/15" style={{ height: `${(1 - hud.sigCooldown / hud.sigTotal) * 100}%` }} />
          )}
          <div className="relative px-1 text-center">
            <div className="text-[10px] font-extrabold leading-3">{hypeFull ? 'FINISHER' : sig?.name}</div>
            <div className="font-display text-2xl leading-6">{!hypeFull && hud.sigCooldown > 0 ? Math.ceil(hud.sigCooldown) : 'F'}</div>
          </div>
        </div>
      </div>
      <style>{`@keyframes pop{0%{transform:translate(-50%,0) scale(1.6);opacity:0}100%{transform:translate(-50%,0) scale(1);opacity:1}}`}</style>
    </div>
  );
}
