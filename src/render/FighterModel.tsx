import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getFighter, type FighterDef } from '../data/fighters';
import type { FighterState } from '../sim/types';
import { blendPose, computePose, restPose, type Pose } from './anim/procedural';
import { fighterPos } from './interp';
import { session } from '../game/session';

// Shared geometry (one copy for all 30 fighters)
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.IcosahedronGeometry(0.5, 1),
  cap: new THREE.CapsuleGeometry(0.5, 1, 3, 8).scale(1, 0.5, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  cone: new THREE.ConeGeometry(0.5, 1, 6),
  glider: (() => {
    const s = new THREE.Shape();
    s.moveTo(-2.2, 0);
    s.quadraticCurveTo(0, 1.4, 2.2, 0);
    s.lineTo(0, 0.5);
    s.closePath();
    const g = new THREE.ShapeGeometry(s);
    g.rotateX(-Math.PI / 2);
    return g;
  })(),
};

const SHIRTLESS = new Set(['boxer', 'mma', 'sumo', 'kickboxer']);

export interface FighterRig {
  root: THREE.Group;
  body: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  lSh: THREE.Group; lEl: THREE.Group; rSh: THREE.Group; rEl: THREE.Group;
  lHip: THREE.Group; lKn: THREE.Group; rHip: THREE.Group; rKn: THREE.Group;
  glider: THREE.Mesh;
  belt: THREE.Group;
  mats: THREE.Material[];
}

function useMats(def: FighterDef) {
  return useMemo(() => {
    const m = (c: string) => new THREE.MeshToonMaterial({ color: c });
    const torsoColor = SHIRTLESS.has(def.archetype) ? def.colors.skin : def.colors.primary;
    const gold = new THREE.MeshToonMaterial({ color: '#f5b800', emissive: '#6b4f00' });
    gold.userData.keep = true;
    return {
      skin: m(def.colors.skin),
      primary: m(def.colors.primary),
      secondary: m(def.colors.secondary),
      hair: m(def.colors.hair),
      torso: m(torsoColor),
      dark: m('#1f1f1f'),
      white: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      gold,
      gliderMat: new THREE.MeshToonMaterial({ color: def.colors.primary, side: THREE.DoubleSide }),
    };
  }, [def]);
}

/** Static procedural body. Joint groups are exposed through `rigRef` for animation. */
export function FighterBody({ def, rigRef }: { def: FighterDef; rigRef: React.MutableRefObject<FighterRig | null> }) {
  const M = useMats(def);
  const W = def.body.width;
  const H = def.body.height;
  const sumo = def.archetype === 'sumo';
  const gloveSize = def.archetype === 'boxer' ? 0.26 : def.archetype === 'mma' ? 0.17 : def.archetype === 'kickboxer' ? 0.23 : 0.14;
  const refs = useRef<Partial<FighterRig>>({});
  refs.current.mats = Object.values(M);
  const set = (k: keyof FighterRig) => (o: THREE.Object3D | null) => {
    if (o) (refs.current as Record<string, unknown>)[k] = o;
    if (Object.keys(refs.current).length >= 15) rigRef.current = refs.current as FighterRig;
  };
  const armLen = 0.32 * H;
  const legLen = 0.44 * H;
  const shoulderX = 0.27 * W + 0.06;
  const hipY = 0.95 * H;
  return (
    <group ref={set('root')}>
      <group ref={set('body')} position-y={hipY}>
        {/* Pelvis / shorts / mawashi */}
        <mesh material={sumo ? M.secondary : M.primary} position-y={0.02} scale={[0.42 * W, 0.24, 0.28 * W]} geometry={G.box} castShadow />
        <group ref={set('belt')} visible={false} position-y={0.14}>
          <mesh material={M.gold} scale={[0.46 * W, 0.11, 0.32 * W]} geometry={G.box} />
          <mesh material={M.gold} position-z={-0.17 * W} scale={[0.2, 0.17, 0.03]} geometry={G.box} />
        </group>
        {def.archetype === 'judo' && <mesh material={M.secondary} position-y={0.14} scale={[0.44 * W, 0.07, 0.3 * W]} geometry={G.box} />}
        <group ref={set('torso')} position-y={0.12}>
          {/* Chest + belly */}
          {sumo ? (
            <>
              <mesh material={M.skin} position-y={0.36 * H} scale={[0.5 * W, 0.5 * H, 0.42 * W]} geometry={G.sphere} castShadow />
              <mesh material={M.skin} position={[0, 0.12, -0.04]} scale={[0.6 * W, 0.55, 0.5 * W]} geometry={G.sphere} castShadow />
            </>
          ) : (
            <mesh material={M.torso} position-y={0.3 * H} scale={[0.58 * W, 0.5 * H, 0.34 * W]} geometry={G.box} castShadow />
          )}
          {def.archetype === 'showman' && <mesh material={M.secondary} position={[0, 0.22 * H, 0.2 * W]} rotation-x={0.12} scale={[0.6 * W, 0.7 * H, 0.04]} geometry={G.box} />}
          {/* Head */}
          <group ref={set('head')} position-y={0.6 * H}>
            <mesh material={def.look === 'mask' ? M.secondary : M.skin} position-y={0.14} scale={[0.26, 0.3, 0.26]} geometry={G.sphere} castShadow />
            {/* Eyes (facing -Z) */}
            <mesh material={M.white} position={[-0.055, 0.17, -0.125]} scale={[0.05, 0.035, 0.02]} geometry={G.box} />
            <mesh material={M.white} position={[0.055, 0.17, -0.125]} scale={[0.05, 0.035, 0.02]} geometry={G.box} />
            {def.look === 'short' && <mesh material={M.hair} position={[0, 0.24, 0.02]} scale={[0.27, 0.12, 0.27]} geometry={G.sphere} />}
            {def.look === 'mohawk' && <mesh material={M.hair} position={[0, 0.3, 0.02]} scale={[0.05, 0.16, 0.26]} geometry={G.box} />}
            {def.look === 'topknot' && (
              <>
                <mesh material={M.hair} position={[0, 0.24, 0.03]} scale={[0.27, 0.1, 0.27]} geometry={G.sphere} />
                <mesh material={M.hair} position={[0, 0.33, 0.06]} scale={[0.1, 0.1, 0.1]} geometry={G.sphere} />
              </>
            )}
            {def.look === 'long' && (
              <>
                <mesh material={M.hair} position={[0, 0.24, 0.02]} scale={[0.28, 0.12, 0.28]} geometry={G.sphere} />
                <mesh material={M.hair} position={[0, 0.08, 0.1]} scale={[0.26, 0.3, 0.1]} geometry={G.box} />
              </>
            )}
            {def.look === 'headband' && <mesh material={M.primary} position={[0, 0.22, 0]} scale={[0.27, 0.06, 0.27]} geometry={G.cyl} />}
            {def.look === 'mask' && <mesh material={M.primary} position={[0, 0.17, -0.12]} scale={[0.22, 0.08, 0.04]} geometry={G.box} />}
          </group>
          {/* Arms: shoulder → elbow → glove */}
          {(['l', 'r'] as const).map((s) => {
            const sx = s === 'l' ? -shoulderX : shoulderX;
            return (
              <group key={s} ref={set(s === 'l' ? 'lSh' : 'rSh')} position={[sx, 0.48 * H, 0]}>
                <mesh material={def.archetype === 'judo' ? M.primary : M.skin} position-y={-armLen / 2} scale={[0.17 * W, armLen + 0.08, 0.17 * W]} geometry={G.cap} castShadow />
                <group ref={set(s === 'l' ? 'lEl' : 'rEl')} position-y={-armLen}>
                  <mesh material={M.skin} position-y={-armLen / 2} scale={[0.15 * W, armLen, 0.15 * W]} geometry={G.cap} castShadow />
                  <mesh material={M.secondary} position-y={-armLen - 0.02} scale={[gloveSize, gloveSize * 1.1, gloveSize]} geometry={G.sphere} castShadow />
                </group>
              </group>
            );
          })}
        </group>
        {/* Legs: hip → knee → boot */}
        {(['l', 'r'] as const).map((s) => {
          const hx = (s === 'l' ? -1 : 1) * 0.12 * W;
          const thigh = sumo || def.archetype === 'wrestler' || def.archetype === 'showman' ? M.skin : M.skin;
          return (
            <group key={s} ref={set(s === 'l' ? 'lHip' : 'rHip')} position={[hx, -0.05, 0]}>
              <mesh material={def.archetype === 'judo' || def.archetype === 'wrestler' || def.archetype === 'showman' ? M.primary : thigh} position-y={-legLen / 2} scale={[0.23 * W, legLen + 0.08, 0.23 * W]} geometry={G.cap} castShadow />
              <group ref={set(s === 'l' ? 'lKn' : 'rKn')} position-y={-legLen}>
                <mesh material={def.archetype === 'judo' ? M.primary : def.archetype === 'kickboxer' ? M.secondary : M.skin} position-y={-legLen / 2} scale={[0.18 * W, legLen, 0.18 * W]} geometry={G.cap} castShadow />
                <mesh material={sumo || def.archetype === 'judo' ? M.skin : def.archetype === 'kickboxer' ? M.skin : M.dark} position={[0, -legLen + 0.04, -0.06]} scale={[0.15 * W, 0.1, 0.26]} geometry={G.box} castShadow />
              </group>
            </group>
          );
        })}
      </group>
      <mesh ref={set('glider')} geometry={G.glider} material={M.gliderMat} position-y={hipY + 1.6} visible={false} />
    </group>
  );
}

export function applyPose(rig: FighterRig, p: Pose, hipY: number) {
  rig.body.position.y = hipY + p.bodyY;
  rig.body.rotation.set(p.bodyX, p.spin, p.bodyZ, 'YXZ');
  rig.torso.rotation.set(p.torsoX, p.torsoY, 0);
  rig.head.rotation.x = p.headX;
  rig.lSh.rotation.set(p.lShX, 0, p.lShZ);
  rig.rSh.rotation.set(p.rShX, 0, p.rShZ);
  rig.lEl.rotation.x = p.lElX;
  rig.rEl.rotation.x = p.rElX;
  rig.lHip.rotation.set(p.lHipX, 0, p.lHipZ);
  rig.rHip.rotation.set(p.rHipX, 0, p.rHipZ);
  rig.lKn.rotation.x = p.lKnX;
  rig.rKn.rotation.x = p.rKnX;
  rig.glider.visible = p.glider > 0.5;
}

const v = new THREE.Vector3();

/** A fighter in the match: reads sim state each frame and animates the rig. */
export function FighterModel({ fighter, getAlpha, isWinner }: { fighter: FighterState; getAlpha: () => number; isWinner: () => boolean }) {
  const def = getFighter(fighter.rosterId);
  const rig = useRef<FighterRig | null>(null);
  const pose = useRef<Pose>(restPose());
  const flashed = useRef(0);
  const champRef = useRef<boolean | null>(null);
  const hipY = 0.95 * def.body.height;
  useFrame((state, dt) => {
    const r = rig.current;
    if (!r) return;
    const f = fighter;
    r.root.visible = f.state !== 'bus';
    if (!r.root.visible) return;
    fighterPos(f, getAlpha(), v);
    r.root.position.copy(v);
    r.root.rotation.y = f.yaw;
    const target = computePose(f, state.clock.elapsedTime, isWinner());
    const fast = f.state === 'attack' || f.state === 'dodge' || f.state === 'stun';
    blendPose(pose.current, target, 1 - Math.exp(-dt * (fast ? 40 : 16)), f.state === 'dodge' || (f.state === 'attack' && target.spin !== 0));
    applyPose(r, pose.current, hipY);
    // Hit flash
    const w = session.runner?.world;
    const flash = w && f.alive && w.time - f.lastHitAt < 0.09 ? 1 : 0;
    if (flash !== flashed.current) {
      flashed.current = flash;
      for (const m of r.mats) {
        if (m.userData.keep) continue;
        const e = (m as THREE.MeshToonMaterial).emissive;
        if (e) e.setRGB(flash, flash * 0.9, flash * 0.8);
      }
    }
    // Ghostly when invulnerable during getup
    const champ = w?.championId === f.id;
    if (champ !== champRef.current) {
      champRef.current = champ;
      r.belt.visible = champ;
    }
  });
  return <FighterBody def={def} rigRef={rig} />;
}
