import type { Archetype } from './fighters';

export type AnimName =
  | 'jab'
  | 'cross'
  | 'hook'
  | 'uppercut'
  | 'kick'
  | 'lowkick'
  | 'knee'
  | 'palm'
  | 'elbow'
  | 'spinkick'
  | 'grab'
  | 'flurry'
  | 'leap'
  | 'stomp'
  | 'dash'
  | 'elbowdrop'
  | 'counter';

export interface MoveDef {
  id: string;
  name: string;
  anim: AnimName;
  /** Seconds */
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  stamina: number;
  /** Reach in metres from the attacker's centre. */
  range: number;
  /** Half-angle of the hit cone in radians. */
  arc: number;
  knockback: number;
  lift: number;
  hitstun: number;
  poise: number;
  heavy?: boolean;
  /** Forward speed during startup + active (m/s). */
  lunge?: number;
  /** Seconds of slow applied on hit. */
  slow?: number;
  knockdown?: boolean;
  /** Split the active window into N separate hits. */
  hits?: number;
  /** Hit everything in range regardless of facing. */
  aoe?: boolean;
  /** Grapple: connecting grabs the target and throws them. */
  grab?: boolean;
  throwDamage?: number;
  /** Counter stance: being struck during the active window auto-throws the attacker. */
  counter?: boolean;
  unblockable?: boolean;
}

export interface Moveset {
  lights: MoveDef[];
  heavy: MoveDef;
  /** Heavy used as the finisher of a light → light → heavy combo. */
  comboHeavy: MoveDef;
  grab: MoveDef;
  /** Extra damage multiplier this archetype takes from throws. */
  throwWeakness: number;
}

const PI = Math.PI;

const jab = (id: string, dmg: number, range = 1.9): MoveDef => ({
  id, name: 'Jab', anim: 'jab', startup: 0.09, active: 0.08, recovery: 0.14, damage: dmg, stamina: 5,
  range, arc: PI / 4, knockback: 1.5, lift: 0, hitstun: 0.3, poise: 8,
});
const cross = (id: string, dmg: number, range = 2.0): MoveDef => ({
  id, name: 'Cross', anim: 'cross', startup: 0.11, active: 0.08, recovery: 0.18, damage: dmg, stamina: 6,
  range, arc: PI / 4, knockback: 2.5, lift: 0, hitstun: 0.35, poise: 10,
});
const grab = (id: string, throwDamage: number, range = 1.8): MoveDef => ({
  id, name: 'Grab', anim: 'grab', startup: 0.22, active: 0.12, recovery: 0.45, damage: 0, stamina: 14,
  range, arc: PI / 3.5, knockback: 7, lift: 5, hitstun: 0, poise: 0, grab: true, throwDamage, unblockable: true,
});

export const MOVESETS: Record<Archetype, Moveset> = {
  boxer: {
    lights: [jab('b_jab', 5), jab('b_jab2', 5), cross('b_cross', 7)],
    heavy: { id: 'b_hook', name: 'Hook', anim: 'hook', startup: 0.2, active: 0.1, recovery: 0.3, damage: 14, stamina: 14, range: 2.0, arc: PI / 3, knockback: 5, lift: 1, hitstun: 0.5, poise: 30, heavy: true, lunge: 2 },
    comboHeavy: { id: 'b_upper', name: 'Uppercut', anim: 'uppercut', startup: 0.16, active: 0.1, recovery: 0.35, damage: 18, stamina: 16, range: 1.9, arc: PI / 4, knockback: 4, lift: 8, hitstun: 0.6, poise: 60, heavy: true, knockdown: true },
    grab: grab('b_clinch', 10, 1.6),
    throwWeakness: 1.3,
  },
  mma: {
    lights: [jab('m_jab', 5), cross('m_cross', 6), { id: 'm_knee', name: 'Knee', anim: 'knee', startup: 0.12, active: 0.08, recovery: 0.2, damage: 8, stamina: 8, range: 1.6, arc: PI / 4, knockback: 3, lift: 2, hitstun: 0.4, poise: 15 }],
    heavy: { id: 'm_kick', name: 'Roundhouse', anim: 'kick', startup: 0.24, active: 0.12, recovery: 0.32, damage: 15, stamina: 15, range: 2.6, arc: PI / 2.5, knockback: 6, lift: 1, hitstun: 0.5, poise: 32, heavy: true },
    comboHeavy: { id: 'm_headkick', name: 'Head Kick', anim: 'spinkick', startup: 0.2, active: 0.12, recovery: 0.38, damage: 19, stamina: 17, range: 2.6, arc: PI / 2.5, knockback: 7, lift: 3, hitstun: 0.6, poise: 60, heavy: true, knockdown: true },
    grab: grab('m_takedown', 14),
    throwWeakness: 1.0,
  },
  wrestler: {
    lights: [{ id: 'w_forearm', name: 'Forearm', anim: 'elbow', startup: 0.11, active: 0.08, recovery: 0.18, damage: 6, stamina: 6, range: 1.7, arc: PI / 3.5, knockback: 2, lift: 0, hitstun: 0.35, poise: 12 }, cross('w_punch', 6, 1.8)],
    heavy: { id: 'w_clothes', name: 'Clothesline', anim: 'hook', startup: 0.24, active: 0.14, recovery: 0.35, damage: 14, stamina: 15, range: 2.1, arc: PI / 2.5, knockback: 5, lift: 3, hitstun: 0.5, poise: 40, heavy: true, lunge: 4 },
    comboHeavy: { id: 'w_shoulder', name: 'Shoulder Tackle', anim: 'dash', startup: 0.16, active: 0.2, recovery: 0.35, damage: 16, stamina: 16, range: 1.8, arc: PI / 3, knockback: 9, lift: 3, hitstun: 0.6, poise: 60, heavy: true, lunge: 9, knockdown: true },
    grab: grab('w_suplex', 20, 2.0),
    throwWeakness: 0.8,
  },
  sumo: {
    lights: [{ id: 's_slap', name: 'Slap', anim: 'palm', startup: 0.13, active: 0.1, recovery: 0.2, damage: 6, stamina: 6, range: 2.0, arc: PI / 3, knockback: 5, lift: 0, hitstun: 0.35, poise: 14 }, { id: 's_slap2', name: 'Slap', anim: 'palm', startup: 0.13, active: 0.1, recovery: 0.22, damage: 7, stamina: 7, range: 2.0, arc: PI / 3, knockback: 6, lift: 0, hitstun: 0.35, poise: 16 }],
    heavy: { id: 's_shove', name: 'Shove', anim: 'palm', startup: 0.3, active: 0.14, recovery: 0.4, damage: 12, stamina: 16, range: 2.3, arc: PI / 2.5, knockback: 16, lift: 3, hitstun: 0.6, poise: 50, heavy: true, lunge: 3 },
    comboHeavy: { id: 's_bigshove', name: 'Oshi-dashi', anim: 'palm', startup: 0.24, active: 0.16, recovery: 0.45, damage: 16, stamina: 18, range: 2.4, arc: PI / 2.2, knockback: 22, lift: 5, hitstun: 0.7, poise: 80, heavy: true, lunge: 5, knockdown: true },
    grab: grab('s_belt', 16, 2.0),
    throwWeakness: 0.6,
  },
  showman: {
    lights: [{ id: 'sh_chop', name: 'Chop', anim: 'palm', startup: 0.11, active: 0.08, recovery: 0.18, damage: 6, stamina: 6, range: 1.8, arc: PI / 3.5, knockback: 2, lift: 0, hitstun: 0.35, poise: 12 }, { id: 'sh_elbow', name: 'Elbow', anim: 'elbow', startup: 0.11, active: 0.08, recovery: 0.2, damage: 7, stamina: 7, range: 1.7, arc: PI / 3.5, knockback: 3, lift: 0, hitstun: 0.35, poise: 12 }],
    heavy: { id: 'sh_bigboot', name: 'Big Boot', anim: 'kick', startup: 0.26, active: 0.12, recovery: 0.32, damage: 15, stamina: 15, range: 2.4, arc: PI / 3, knockback: 7, lift: 2, hitstun: 0.5, poise: 35, heavy: true, lunge: 2 },
    comboHeavy: { id: 'sh_lariat', name: 'Lariat', anim: 'hook', startup: 0.2, active: 0.14, recovery: 0.36, damage: 18, stamina: 17, range: 2.2, arc: PI / 2.2, knockback: 6, lift: 6, hitstun: 0.6, poise: 60, heavy: true, lunge: 4, knockdown: true },
    grab: grab('sh_powerbomb', 18),
    throwWeakness: 1.0,
  },
  judo: {
    lights: [{ id: 'j_palm', name: 'Palm', anim: 'palm', startup: 0.1, active: 0.08, recovery: 0.16, damage: 5, stamina: 5, range: 1.8, arc: PI / 3.5, knockback: 2, lift: 0, hitstun: 0.3, poise: 10 }, jab('j_jab', 5)],
    heavy: { id: 'j_sweep', name: 'Foot Sweep', anim: 'lowkick', startup: 0.2, active: 0.12, recovery: 0.3, damage: 10, stamina: 13, range: 2.0, arc: PI / 3, knockback: 2, lift: 2, hitstun: 0.5, poise: 45, heavy: true, knockdown: true },
    comboHeavy: { id: 'j_ogoshi', name: 'Hip Throw', anim: 'grab', startup: 0.14, active: 0.12, recovery: 0.35, damage: 0, stamina: 14, range: 1.9, arc: PI / 3, knockback: 7, lift: 5, hitstun: 0, poise: 0, heavy: true, grab: true, throwDamage: 20, unblockable: true },
    grab: grab('j_seoi', 18, 2.0),
    throwWeakness: 0.7,
  },
  kickboxer: {
    lights: [jab('k_jab', 5), { id: 'k_teep', name: 'Teep', anim: 'kick', startup: 0.13, active: 0.08, recovery: 0.2, damage: 6, stamina: 6, range: 2.6, arc: PI / 5, knockback: 5, lift: 0, hitstun: 0.35, poise: 14 }, { id: 'k_low', name: 'Low Kick', anim: 'lowkick', startup: 0.13, active: 0.08, recovery: 0.2, damage: 7, stamina: 7, range: 2.4, arc: PI / 4, knockback: 1.5, lift: 0, hitstun: 0.35, poise: 14, slow: 2.5 }],
    heavy: { id: 'k_round', name: 'Roundhouse', anim: 'kick', startup: 0.24, active: 0.12, recovery: 0.3, damage: 15, stamina: 15, range: 2.8, arc: PI / 2.5, knockback: 6, lift: 1, hitstun: 0.5, poise: 32, heavy: true },
    comboHeavy: { id: 'k_highkick', name: 'High Kick', anim: 'spinkick', startup: 0.2, active: 0.12, recovery: 0.36, damage: 19, stamina: 17, range: 2.8, arc: PI / 2.5, knockback: 7, lift: 3, hitstun: 0.6, poise: 60, heavy: true, knockdown: true },
    grab: grab('k_clinch', 12, 1.7),
    throwWeakness: 1.1,
  },
};

/** Signature moves, referenced by id from the roster. Used on a cooldown (F). */
export interface SignatureDef extends MoveDef {
  cooldown: number;
  desc: string;
}

export const SIGNATURES: Record<string, SignatureDef> = {
  flurry: { id: 'flurry', name: 'Quickfire Flurry', desc: 'Six lightning punches that shred guards.', anim: 'flurry', startup: 0.1, active: 0.9, recovery: 0.3, damage: 4, stamina: 15, range: 2.1, arc: PI / 3, knockback: 1, lift: 0, hitstun: 0.3, poise: 12, hits: 6, lunge: 2, cooldown: 12 },
  haymaker_punch: { id: 'haymaker_punch', name: 'The Haymaker', desc: 'A wind-up right hand that flattens anyone it touches.', anim: 'hook', startup: 0.5, active: 0.12, recovery: 0.45, damage: 34, stamina: 20, range: 2.3, arc: PI / 3, knockback: 12, lift: 6, hitstun: 0.8, poise: 100, heavy: true, knockdown: true, lunge: 3, cooldown: 14 },
  superman_punch: { id: 'superman_punch', name: 'Superman Punch', desc: 'A leaping punch that covers huge distance.', anim: 'leap', startup: 0.25, active: 0.2, recovery: 0.4, damage: 24, stamina: 18, range: 2.0, arc: PI / 3, knockback: 9, lift: 4, hitstun: 0.7, poise: 80, heavy: true, knockdown: true, lunge: 14, cooldown: 11 },
  flying_knee: { id: 'flying_knee', name: 'Flying Knee', desc: 'A jumping knee that launches opponents skyward.', anim: 'knee', startup: 0.2, active: 0.2, recovery: 0.4, damage: 22, stamina: 18, range: 1.9, arc: PI / 3, knockback: 6, lift: 10, hitstun: 0.7, poise: 80, heavy: true, knockdown: true, lunge: 11, cooldown: 11 },
  spear: { id: 'spear', name: 'Spear', desc: 'A full-speed tackle that grabs and slams whoever it hits.', anim: 'dash', startup: 0.2, active: 0.45, recovery: 0.5, damage: 0, stamina: 20, range: 1.9, arc: PI / 3, knockback: 6, lift: 4, hitstun: 0, poise: 0, grab: true, throwDamage: 28, lunge: 16, unblockable: true, cooldown: 13 },
  german_suplex: { id: 'german_suplex', name: 'German Suplex', desc: 'A long-reach grab into a bridging suplex for massive damage.', anim: 'grab', startup: 0.18, active: 0.2, recovery: 0.5, damage: 0, stamina: 18, range: 2.6, arc: PI / 2.5, knockback: 6, lift: 6, hitstun: 0, poise: 0, grab: true, throwDamage: 32, unblockable: true, lunge: 4, cooldown: 13 },
  earthquake_stomp: { id: 'earthquake_stomp', name: 'Shiko Earthquake', desc: 'A ceremonial stomp that knocks down everyone nearby.', anim: 'stomp', startup: 0.55, active: 0.12, recovery: 0.5, damage: 18, stamina: 22, range: 5.5, arc: PI, knockback: 10, lift: 7, hitstun: 0.7, poise: 100, heavy: true, knockdown: true, aoe: true, unblockable: true, cooldown: 15 },
  tsuppari_rush: { id: 'tsuppari_rush', name: 'Tsuppari Rush', desc: 'A charging barrage of palm strikes with huge knockback.', anim: 'flurry', startup: 0.15, active: 0.8, recovery: 0.4, damage: 6, stamina: 20, range: 2.4, arc: PI / 2.5, knockback: 9, lift: 1, hitstun: 0.35, poise: 25, hits: 4, lunge: 7, cooldown: 13 },
  thunder_elbow: { id: 'thunder_elbow', name: 'Thunder Elbow', desc: 'Leap and drop an elbow that shakes the ground around you.', anim: 'elbowdrop', startup: 0.45, active: 0.15, recovery: 0.55, damage: 24, stamina: 20, range: 4.0, arc: PI, knockback: 8, lift: 6, hitstun: 0.7, poise: 100, heavy: true, knockdown: true, aoe: true, lunge: 6, cooldown: 14 },
  moonsault: { id: 'moonsault', name: 'Moonsault', desc: 'A backflip splash that crushes anyone below.', anim: 'elbowdrop', startup: 0.4, active: 0.15, recovery: 0.5, damage: 22, stamina: 18, range: 3.5, arc: PI, knockback: 7, lift: 5, hitstun: 0.7, poise: 100, heavy: true, knockdown: true, aoe: true, lunge: 8, cooldown: 12 },
  ippon_counter: { id: 'ippon_counter', name: 'Ippon Counter', desc: 'Enter a counter stance. Anyone who strikes you gets thrown hard.', anim: 'counter', startup: 0.05, active: 1.2, recovery: 0.3, damage: 0, stamina: 12, range: 2.5, arc: PI, knockback: 8, lift: 6, hitstun: 0, poise: 0, counter: true, throwDamage: 30, cooldown: 10 },
  triangle_choke: { id: 'triangle_choke', name: 'Triangle Choke', desc: 'A grab that chokes for heavy damage and drains stamina.', anim: 'grab', startup: 0.18, active: 0.18, recovery: 0.45, damage: 0, stamina: 16, range: 2.2, arc: PI / 2.5, knockback: 3, lift: 2, hitstun: 0, poise: 0, grab: true, throwDamage: 30, unblockable: true, cooldown: 12 },
  tornado_kick: { id: 'tornado_kick', name: 'Tornado Kick', desc: 'A spinning kick that hits everyone around you.', anim: 'spinkick', startup: 0.25, active: 0.25, recovery: 0.4, damage: 20, stamina: 18, range: 3.2, arc: PI, knockback: 9, lift: 3, hitstun: 0.6, poise: 80, heavy: true, knockdown: true, aoe: true, cooldown: 11 },
  spinning_back_kick: { id: 'spinning_back_kick', name: 'Spinning Back Kick', desc: 'Long-range kick to the gut that sends enemies flying.', anim: 'spinkick', startup: 0.28, active: 0.12, recovery: 0.4, damage: 24, stamina: 18, range: 3.4, arc: PI / 4, knockback: 14, lift: 3, hitstun: 0.7, poise: 90, heavy: true, knockdown: true, lunge: 3, cooldown: 11 },
};

/** Generic finisher performed when the crowd hype meter is full (F). */
export const FINISHER: MoveDef = {
  id: 'finisher', name: 'FINISHER', anim: 'elbowdrop', startup: 0.5, active: 0.2, recovery: 0.6, damage: 40, stamina: 0,
  range: 4.5, arc: PI, knockback: 14, lift: 9, hitstun: 1, poise: 200, heavy: true, knockdown: true, aoe: true, unblockable: true, lunge: 5,
};

export interface PassiveDef {
  id: string;
  name: string;
  desc: string;
}

/** Passive traits, referenced by id from the roster. Effects are implemented in src/sim/stats.ts. */
export const PASSIVES: Record<string, PassiveDef> = {
  quick_hands: { id: 'quick_hands', name: 'Quick Hands', desc: 'Light attacks are 20% faster.' },
  counter_puncher: { id: 'counter_puncher', name: 'Counter Puncher', desc: 'After blocking a hit, your next strike deals +40% damage.' },
  well_rounded: { id: 'well_rounded', name: 'Well Rounded', desc: '+10% damage and +10% damage reduction.' },
  cardio_machine: { id: 'cardio_machine', name: 'Cardio Machine', desc: 'Stamina regenerates 40% faster.' },
  grip_strength: { id: 'grip_strength', name: 'Grip Strength', desc: 'Grabs reach 30% further and throws deal +20% damage.' },
  relentless: { id: 'relentless', name: 'Relentless', desc: 'Landing a throw restores 25 stamina.' },
  immovable: { id: 'immovable', name: 'Immovable', desc: 'Takes 60% less knockback and is very hard to knock down.' },
  heavyweight: { id: 'heavyweight', name: 'Heavyweight', desc: 'Your hits deal 50% more knockback.' },
  crowd_favorite: { id: 'crowd_favorite', name: 'Crowd Favorite', desc: 'Builds crowd hype twice as fast.' },
  second_wind: { id: 'second_wind', name: 'Second Wind', desc: 'Regenerates health while below 30% HP.' },
  redirect: { id: 'redirect', name: 'Redirect', desc: 'Parry window is doubled and parries throw the attacker.' },
  slippery: { id: 'slippery', name: 'Slippery', desc: 'Dodges cost 40% less stamina and grant longer invulnerability.' },
  leg_kicks: { id: 'leg_kicks', name: 'Leg Kicks', desc: 'Heavy attacks also slow the target.' },
  long_limbs: { id: 'long_limbs', name: 'Long Limbs', desc: 'All strikes reach 20% further.' },
};
