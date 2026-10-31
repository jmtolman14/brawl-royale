# BRAWL ROYALE 🥊

A browser-based 3D battle royale with **no weapons**. Thirty fighters drop onto an island, loot up, and fight hand-to-hand as the storm closes in. The last fighter standing wins.

Built with Vite, React, TypeScript, React Three Fiber, Zustand and Tailwind. Everything is procedural: the low-poly fighters, the island, the animation and the WebAudio-synthesized sound. There are no external or copyrighted assets.

## Play locally

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build locally
npm test           # combat + full-match simulation tests (Vitest)
```

## How to play

**Goal:** drop from the Battle Blimp, loot, stay inside the safe zone, and be the last of 30 fighters standing.

| Action | Keyboard / mouse | Gamepad |
| --- | --- | --- |
| Move / look | WASD / mouse | Left / right stick |
| Light attack | Left click | X / □ |
| Heavy attack | Right click | Y / △ |
| Block (tap just before a hit to **parry**) | Q (hold) | LB |
| Dodge / roll | C (or Ctrl) | B / ○ |
| Grab · pick up · open crate | E | RB |
| Signature move / **Finisher** | F | RT |
| Sprint | Shift | L3 |
| Jump · drop from the blimp | Space | A / ✕ |
| Use selected item | R | LT |
| Throw prop (chair, bottle) | G | D-pad ↓ |
| Hotbar | 1–5 / mouse wheel | D-pad ← → |
| Lock on | Tab | R3 |
| Map | M | Select |
| Pause | Esc / P | Start |

**The fighting triangle**

- **Strike beats grab.** Hit people while they reach for you.
- **Grab beats block.** Throws go straight through a guard.
- **Dodge beats strike.** Rolling gives you invulnerability frames.

Light → Light → Heavy fires your combo finisher. Blocking turns hits into chip damage but drains stamina. Stamina powers attacks, blocks, dodges and sprinting.

The game also teaches itself. There's a **How to Play** screen on the main menu and in the pause menu, contextual **tutorial tips** during your first match, and a **Training** mode with a sparring partner and free loot.

## What makes it unique (not just a clone)

1. **Hand-to-hand only, with 14 combat-sports fighters.** Boxers, MMA strikers, wrestlers, sumo, pro-wrestling showmen, judo/BJJ and kickboxers. Each has its own stats, moveset, signature move and passive.
2. **Crowd Hype meter.** The crowd rewards style: combos, parries, throws, dodges and KOs. If you avoid fights they get bored and the meter drains. At 100% you can trigger a slow-motion **Finisher**.
3. **Championship Belt bounty.** One legendary belt spawns in the Grand Arena. It gives +15% damage and defense and 2× hype, but the champ shows as a ★ on everyone's map, and bots hunt them.
4. **The Main Event.** The final safe zone turns into a wrestling ring: the bell rings, spotlights sweep, and fighters bounce off the ropes.

## Roster is data-driven

All fighters live in [`src/data/fighters.ts`](src/data/fighters.ts). Game logic only reads from that array, so you can add, remove or redesign fighters without touching any other code. Movesets per archetype, signature moves and passives are in [`src/data/moves.ts`](src/data/moves.ts). Loot is in [`src/data/items.ts`](src/data/items.ts).

## Architecture

```
src/
  data/      roster, moves, items, map zones (pure data)
  sim/       pure TypeScript simulation: no React or three imports
             world/match runner, fighter state machine, combat, loot, ring, drop, bot AI
  input/     keyboard / mouse / gamepad → InputFrame
  render/    React Three Fiber scene: terrain, instanced props, fighters, VFX
  game/      glue: session singleton, game loop, event → fx/audio bridges
  ui/        menus, HUD, minimap, overlays (Tailwind)
  audio/     WebAudio synthesizer
```

The simulation runs at a fixed 60 Hz in `sim/match.ts`. Humans and bots both produce the same `InputFrame` shape, and `WorldState` is plain serializable data. To add multiplayer later (PartyKit or Colyseus), run `MatchRunner` on the server, send `InputFrame`s up, and replicate `WorldState` down. Rendering never mutates the sim.

## Deploy to Vercel

The build is a fully static site in `dist/`, and `vercel.json` already includes the SPA rewrite.

### Option A: GitHub + Vercel dashboard

```bash
git init && git add -A && git commit -m "Brawl Royale"
gh repo create brawl-royale --public --source=. --push   # or create the repo on github.com and `git push`
```

Then go to <https://vercel.com/new>, **Import** the `brawl-royale` repo, and keep the defaults (Framework: Vite, Build: `npm run build`, Output: `dist`). Click **Deploy**. You'll get a public `https://brawl-royale-xxxx.vercel.app` link to share.

### Option B: Vercel CLI

```bash
npm i -g vercel     # or use npx vercel
vercel login
vercel --prod       # accept the detected Vite settings
```

## Performance notes

- Trees, rocks, buildings, crates, loot and particles are all **instanced meshes**.
- Shadows come from one directional light whose shadow camera follows the player. Only fighters within 35 m cast shadows.
- Fighters beyond 70 m render as a single capsule LOD, and beyond 260 m they aren't drawn.
- Particles and damage numbers use capped pools.
- Settings → Graphics (Low / Medium / High) controls shadows, resolution, terrain detail, draw distance and particle caps. You can turn on an FPS counter in Settings.
- The 3D engine is code-split and lazy-loaded, so the main menu downloads about 50 KB gzipped.
