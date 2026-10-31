// THE ROSTER. Game logic only ever reads fighters from this array, so you can
// add, remove or redesign fighters here without touching any other code.
// Signature and passive ids map to registries in src/data/moves.ts.
// All names and designs are fictional.

export type Archetype = 'boxer' | 'mma' | 'wrestler' | 'sumo' | 'showman' | 'judo' | 'kickboxer';

export interface FighterStats {
  /** All stats are 1..10 */
  health: number;
  speed: number;
  power: number;
  stamina: number;
  grapple: number;
  defense: number;
}

export interface FighterDef {
  id: string;
  name: string;
  nickname: string;
  archetype: Archetype;
  bio: string;
  colors: {
    skin: string;
    primary: string; // shorts / singlet / gi
    secondary: string; // gloves / boots / trim
    hair: string;
  };
  /** Body proportions: 1 = average. */
  body: { height: number; width: number };
  /** Hair/head style used by the procedural model. */
  look: 'bald' | 'short' | 'mohawk' | 'topknot' | 'long' | 'mask' | 'headband';
  stats: FighterStats;
  signature: string; // id in SIGNATURES
  passive: string; // id in PASSIVES
}

export const ARCHETYPE_LABEL: Record<Archetype, string> = {
  boxer: 'Boxer',
  mma: 'MMA Striker',
  wrestler: 'Wrestler',
  sumo: 'Sumo',
  showman: 'Pro Wrestling Showman',
  judo: 'Judo / BJJ',
  kickboxer: 'Kickboxer',
};

export const FIGHTERS: FighterDef[] = [
  {
    id: 'quickfire',
    name: 'Marisol Reyes',
    nickname: 'Quickfire',
    archetype: 'boxer',
    bio: 'Fastest hands on the island. Jab-jab-cross before you blink, but hates getting grabbed.',
    colors: { skin: '#c68863', primary: '#e63946', secondary: '#f1faee', hair: '#1d1d1d' },
    body: { height: 0.95, width: 0.9 },
    look: 'long',
    stats: { health: 5, speed: 9, power: 6, stamina: 7, grapple: 2, defense: 6 },
    signature: 'flurry',
    passive: 'quick_hands',
  },
  {
    id: 'haymaker',
    name: 'Dutch Holloway',
    nickname: 'Haymaker',
    archetype: 'boxer',
    bio: 'Old-school heavyweight. Slow feet, cement chin, and a right hand that ends nights.',
    colors: { skin: '#f1c27d', primary: '#1d3557', secondary: '#e63946', hair: '#8d5524' },
    body: { height: 1.08, width: 1.12 },
    look: 'short',
    stats: { health: 7, speed: 5, power: 9, stamina: 5, grapple: 3, defense: 7 },
    signature: 'haymaker_punch',
    passive: 'counter_puncher',
  },
  {
    id: 'cyclone',
    name: 'Kenji Arata',
    nickname: 'Cyclone',
    archetype: 'mma',
    bio: 'Karate-style point fighter turned cage killer. Kicks from angles you never see.',
    colors: { skin: '#e0ac69', primary: '#2a9d8f', secondary: '#264653', hair: '#111111' },
    body: { height: 1.0, width: 0.95 },
    look: 'mohawk',
    stats: { health: 6, speed: 8, power: 7, stamina: 6, grapple: 5, defense: 5 },
    signature: 'superman_punch',
    passive: 'well_rounded',
  },
  {
    id: 'valkyrie',
    name: 'Valka Strand',
    nickname: 'The Valkyrie',
    archetype: 'mma',
    bio: 'Northern brawler with an engine that never quits. Flying knees are her calling card.',
    colors: { skin: '#ffe0bd', primary: '#3a0ca3', secondary: '#f72585', hair: '#f4d35e' },
    body: { height: 1.03, width: 1.0 },
    look: 'long',
    stats: { health: 6, speed: 7, power: 7, stamina: 9, grapple: 5, defense: 5 },
    signature: 'flying_knee',
    passive: 'cardio_machine',
  },
  {
    id: 'tank',
    name: 'Tank Mabry',
    nickname: 'Big Tank',
    archetype: 'wrestler',
    bio: 'Former farm boy who suplexes hay bales for fun. Gets you on the ground and keeps you there.',
    colors: { skin: '#a1665e', primary: '#ff7b00', secondary: '#222222', hair: '#222222' },
    body: { height: 1.05, width: 1.2 },
    look: 'bald',
    stats: { health: 8, speed: 5, power: 7, stamina: 6, grapple: 10, defense: 6 },
    signature: 'spear',
    passive: 'grip_strength',
  },
  {
    id: 'bearhug',
    name: 'Olga Petrova',
    nickname: 'Bearhug',
    archetype: 'wrestler',
    bio: 'Olympic folkstyle legend. Once she locks her hands, you are going for a ride.',
    colors: { skin: '#ffdbac', primary: '#c1121f', secondary: '#fdf0d5', hair: '#7f4f24' },
    body: { height: 1.0, width: 1.08 },
    look: 'topknot',
    stats: { health: 7, speed: 6, power: 6, stamina: 7, grapple: 9, defense: 6 },
    signature: 'german_suplex',
    passive: 'relentless',
  },
  {
    id: 'yamagoro',
    name: 'Yamagoro',
    nickname: 'The Mountain',
    archetype: 'sumo',
    bio: 'Three hundred kilos of ancient technique. Moving him is not an option.',
    colors: { skin: '#f0c08a', primary: '#f2f2f2', secondary: '#1b263b', hair: '#0d0d0d' },
    body: { height: 1.12, width: 1.55 },
    look: 'topknot',
    stats: { health: 10, speed: 3, power: 9, stamina: 5, grapple: 7, defense: 8 },
    signature: 'earthquake_stomp',
    passive: 'immovable',
  },
  {
    id: 'tsunami',
    name: 'Kaito Umi',
    nickname: 'Tsunami',
    archetype: 'sumo',
    bio: 'Young, hungry, and frighteningly quick for his size. His palm strikes send people flying.',
    colors: { skin: '#d8a47f', primary: '#0077b6', secondary: '#caf0f8', hair: '#1a1a1a' },
    body: { height: 1.08, width: 1.45 },
    look: 'topknot',
    stats: { health: 9, speed: 4, power: 8, stamina: 6, grapple: 6, defense: 7 },
    signature: 'tsuppari_rush',
    passive: 'heavyweight',
  },
  {
    id: 'thunderstrut',
    name: 'Captain Thunderstrut',
    nickname: 'The Captain',
    archetype: 'showman',
    bio: 'Sequined cape, golden boots, and an ego the size of the arena. The crowd LOVES him.',
    colors: { skin: '#e0ac69', primary: '#ffd60a', secondary: '#7b2cbf', hair: '#ffffff' },
    body: { height: 1.1, width: 1.15 },
    look: 'mask',
    stats: { health: 7, speed: 6, power: 7, stamina: 6, grapple: 7, defense: 5 },
    signature: 'thunder_elbow',
    passive: 'crowd_favorite',
  },
  {
    id: 'lightning',
    name: 'Lady Lightning',
    nickname: 'Lady L',
    archetype: 'showman',
    bio: 'High-flyer who never stays down. Every comeback is part of the show.',
    colors: { skin: '#8d5524', primary: '#00f5d4', secondary: '#f15bb5', hair: '#9b5de5' },
    body: { height: 0.98, width: 0.95 },
    look: 'mohawk',
    stats: { health: 6, speed: 8, power: 6, stamina: 7, grapple: 6, defense: 5 },
    signature: 'moonsault',
    passive: 'second_wind',
  },
  {
    id: 'armbar',
    name: 'Ines Moreau',
    nickname: 'Armbar',
    archetype: 'judo',
    bio: 'Black belt in three grappling arts. Uses your strength against you.',
    colors: { skin: '#f1c27d', primary: '#f8f9fa', secondary: '#212529', hair: '#3b2414' },
    body: { height: 0.96, width: 0.92 },
    look: 'topknot',
    stats: { health: 6, speed: 7, power: 5, stamina: 7, grapple: 9, defense: 7 },
    signature: 'ippon_counter',
    passive: 'redirect',
  },
  {
    id: 'softhands',
    name: 'Hiro Tanabe',
    nickname: 'Soft Hands',
    archetype: 'judo',
    bio: 'Calm, patient, impossible to pin down. Slips out of every hold like water.',
    colors: { skin: '#e0ac69', primary: '#1d4ed8', secondary: '#fefae0', hair: '#151515' },
    body: { height: 1.0, width: 0.98 },
    look: 'short',
    stats: { health: 6, speed: 7, power: 5, stamina: 8, grapple: 8, defense: 7 },
    signature: 'triangle_choke',
    passive: 'slippery',
  },
  {
    id: 'shinbreaker',
    name: 'Sakda Phrom',
    nickname: 'Shin Breaker',
    archetype: 'kickboxer',
    bio: 'Twelve-time stadium champion. His low kicks have ended careers.',
    colors: { skin: '#c68642', primary: '#d90429', secondary: '#edf2f4', hair: '#0b0b0b' },
    body: { height: 1.0, width: 0.92 },
    look: 'headband',
    stats: { health: 6, speed: 7, power: 7, stamina: 7, grapple: 4, defense: 6 },
    signature: 'tornado_kick',
    passive: 'leg_kicks',
  },
  {
    id: 'whiplash',
    name: 'Nadia Kova',
    nickname: 'Whiplash',
    archetype: 'kickboxer',
    bio: 'All legs, all angles. Keeps you at the end of her reach and picks you apart.',
    colors: { skin: '#ffe0bd', primary: '#06d6a0', secondary: '#073b4c', hair: '#ef476f' },
    body: { height: 1.07, width: 0.88 },
    look: 'long',
    stats: { health: 5, speed: 8, power: 6, stamina: 8, grapple: 3, defense: 6 },
    signature: 'spinning_back_kick',
    passive: 'long_limbs',
  },
];

export const FIGHTER_BY_ID: Record<string, FighterDef> = Object.fromEntries(FIGHTERS.map((f) => [f.id, f]));

export function getFighter(id: string): FighterDef {
  return FIGHTER_BY_ID[id] ?? FIGHTERS[0];
}
