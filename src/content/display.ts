// Display tables for the UI (DESIGN 4.1, 4.2, 6, 16.0, 18.2). Every colour signal also has a sigil and a label.

import { AFFLICTION_OF, dissonantLightOf, dissonantShadeOf, lightsOfBlend } from '../engine/emotions';
import type { AfflictionId, Blend, CardId, EnemyId, Light, Shade } from '../engine/types';
import { BAD_ADVICE } from './lines';

export interface LightInfo {
  name: string;
  /** Default palette. */
  color: string;
  /** Colour-blind palette (Okabe-Ito). */
  cbColor: string;
  /** Open, rounded sigil (24-unit grid). */
  sigil: string;
  /** Card frame pattern. */
  pattern: string;
  /** Pentatonic voice in wheel order (18.2). */
  voice: { note: string; hz: number; timbre: string };
  /** The card family's theme word (6.2 to 6.7). */
  theme: string;
  /** The Shade this Light answers (OPPOSITE x2). */
  answers: Shade;
  /** The affliction it soothes. */
  soothes: AfflictionId;
  /** The Shade it is DISSONANT against (x1/2 and Flare). */
  dissonantVs: Shade;
  /** Act from which its cards are offered. */
  act: 1 | 2;
}

const light = (
  l: Light,
  info: Omit<LightInfo, 'answers' | 'soothes' | 'dissonantVs'> & { answers: Shade },
): LightInfo => ({ ...info, soothes: AFFLICTION_OF[info.answers], dissonantVs: dissonantShadeOf(l) });

export const LIGHT_INFO: Record<Light, LightInfo> = {
  love: light('love', {
    name: 'Love',
    color: '#FF5C8A',
    cbColor: '#CC79A7',
    sigil: 'heart',
    pattern: 'dots',
    voice: { note: 'C5', hz: 523.25, timbre: 'soft sine, slow attack' },
    theme: 'Warmth',
    answers: 'anger',
    act: 1,
  }),
  joy: light('joy', {
    name: 'Joy',
    color: '#FFD23F',
    cbColor: '#F0E442',
    sigil: 'sun',
    pattern: 'rays',
    voice: { note: 'D5', hz: 587.33, timbre: 'triangle pluck' },
    theme: 'Spark',
    answers: 'sadness',
    act: 1,
  }),
  friendship: light('friendship', {
    name: 'Friendship',
    color: '#3DDC84',
    cbColor: '#009E73',
    sigil: 'rings',
    pattern: 'chain',
    voice: { note: 'E5', hz: 659.25, timbre: 'two detuned saws, lowpass' },
    theme: 'Kinship',
    answers: 'loneliness',
    act: 1,
  }),
  courage: light('courage', {
    name: 'Courage',
    color: '#FF8C42',
    cbColor: '#E69F00',
    sigil: 'chevron',
    pattern: 'chevrons',
    voice: { note: 'G5', hz: 783.99, timbre: 'square, lowpass (brassy)' },
    theme: 'Stand',
    answers: 'fear',
    act: 1,
  }),
  hope: light('hope', {
    name: 'Hope',
    color: '#B18CFF',
    cbColor: '#0072B2',
    sigil: 'star',
    pattern: 'stars',
    voice: { note: 'A5', hz: 880, timbre: 'sine with octave shimmer' },
    theme: 'Promise',
    answers: 'despair',
    act: 2,
  }),
  calm: light('calm', {
    name: 'Calm',
    color: '#4CC9F0',
    cbColor: '#56B4E9',
    sigil: 'wave',
    pattern: 'waves',
    voice: { note: 'C6', hz: 1046.5, timbre: 'sine, long release, reverb' },
    theme: 'Stillness',
    answers: 'anxiety',
    act: 2,
  }),
};

export interface ShadeInfo {
  name: string;
  /** Closed, pointed sigil (24-unit grid). */
  sigil: string;
  affliction: AfflictionId;
  /** OPPOSITE x2 Light; its colour is the crack glow. */
  cure: Light;
  /** DISSONANT x1/2 Light ("bad advice"). */
  dissonant: Light;
  badAdvice: string;
  /** Act in which the Shade type first appears. */
  act: 1 | 2;
  /** Strike sound flavour (18.2). */
  strikeSound: string;
  /** Afterglow name when this face is Resolved (4.9). */
  afterglow: string;
}

const shade = (s: Shade, info: Omit<ShadeInfo, 'affliction' | 'dissonant' | 'badAdvice'>): ShadeInfo => ({
  ...info,
  affliction: AFFLICTION_OF[s],
  dissonant: dissonantLightOf(s),
  badAdvice: BAD_ADVICE[s],
});

export const SHADE_INFO: Record<Shade, ShadeInfo> = {
  anger: shade('anger', {
    name: 'Anger',
    sigil: 'crown',
    cure: 'love',
    act: 1,
    strikeSound: 'harsh, distorted',
    afterglow: 'Conviction',
  }),
  sadness: shade('sadness', {
    name: 'Sadness',
    sigil: 'teardrop',
    cure: 'joy',
    act: 1,
    strikeSound: 'low-passed, long release',
    afterglow: 'Release',
  }),
  loneliness: shade('loneliness', {
    name: 'Loneliness',
    sigil: 'lone_dot',
    cure: 'friendship',
    act: 1,
    strikeSound: 'thin sine, long echo',
    afterglow: 'Belonging',
  }),
  fear: shade('fear', {
    name: 'Fear',
    sigil: 'eye',
    cure: 'courage',
    act: 1,
    strikeSound: 'fast tremolo',
    afterglow: 'Caution',
  }),
  despair: shade('despair', {
    name: 'Despair',
    sigil: 'funnel',
    cure: 'hope',
    act: 2,
    strikeSound: 'very low sub-thud',
    afterglow: 'Perspective',
  }),
  anxiety: shade('anxiety', {
    name: 'Anxiety',
    sigil: 'scribble',
    cure: 'calm',
    act: 2,
    strikeSound: 'rapid ticks',
    afterglow: 'Clarity',
  }),
};

/** Apathy and The Numbness: a grey oval labelled NUMB on map nodes, nameplates and the Numbness meter (16.0). */
export const NUMB_INFO = {
  sigil: 'numb_oval',
  label: 'NUMB',
  color: '#8C8798',
  felt: 'FELT x2: two Lights',
  muffled: 'MUFFLED x1/2: one Light',
} as const;

export interface AfflictionInfo {
  name: string;
  from: Shade | null;
  /** Light whose plays soothe it; null for Numb. */
  soothedBy: Light | null;
  /** Short effect for coach mark C9 ("{Affliction} {short effect}."). */
  short: string;
}

export const AFFLICTION_INFO: Record<AfflictionId | 'numb', AfflictionInfo> = {
  seething: { name: 'Seething', from: 'anger', soothedBy: 'love', short: 'burns a little Heart at the end of your turn' },
  heavy: { name: 'Heavy', from: 'sadness', soothedBy: 'joy', short: 'makes your cards Ease less' },
  isolated: {
    name: 'Isolated',
    from: 'loneliness',
    soothedBy: 'friendship',
    short: 'stops Harmony and keeps your Companions still',
  },
  trembling: { name: 'Trembling', from: 'fear', soothedBy: 'courage', short: 'weakens your Guard' },
  hollow: { name: 'Hollow', from: 'despair', soothedBy: 'hope', short: 'leaves you 1 less Spirit each turn' },
  restless: { name: 'Restless', from: 'anxiety', soothedBy: 'calm', short: 'makes your first card cost 1 more' },
  numb: { name: 'Numb', from: null, soothedBy: null, short: 'takes the Light from your first card each turn' },
};

export interface BlendInfo {
  name: string;
  lights: [Light, Light];
  card: CardId;
  /** The compound Shade this Blend is the key to (6.8). */
  keyTo: EnemyId;
}

const blend = (b: Blend, name: string, card: CardId, keyTo: EnemyId): BlendInfo => ({
  name,
  lights: lightsOfBlend(b),
  card,
  keyTo,
});

export const BLEND_INFO: Record<Blend, BlendInfo> = {
  delight: blend('delight', 'Delight', 'blend.sunbeam', 'shade.old_grudge'),
  playfulness: blend('playfulness', 'Playfulness', 'blend.tag_youre_it', 'shade.longing'),
  loyalty: blend('loyalty', 'Loyalty', 'blend.shoulder_to_shoulder', 'shade.wallflower'),
  determination: blend('determination', 'Determination', 'blend.against_the_odds', 'shade.dread'),
  patience: blend('patience', 'Patience', 'blend.wait_it_out', 'shade.spiral'),
  compassion: blend('compassion', 'Compassion', 'blend.gentle_hands', 'shade.knot'),
};

/** Chip tooltips for EnemyDef flags (16.2 row 4). */
export const FLAG_CHIPS = {
  shy: { name: 'Shy', text: "While another Shade stands, cards can't target it unless they Reach Shy." },
  fleeting: { name: 'Fleeting', text: 'It simply fades at 0: no Resolve, no Suppress.' },
  veiled: { name: 'Veiled', text: "While a Surfaced Shade stands, it can't be targeted and nothing Eases it." },
} as const;

/** Codex rules summary (tab 4): one sentence per rule, 4.2 to 4.16. */
export const CODEX_RULES: readonly { rule: string; text: string }[] = [
  {
    rule: 'Type chart',
    text: 'Every Shade is answered by its opposite Light: x2. Each Light is DISSONANT against the Shade its clockwise neighbour answers: x1/2, and that Shade gains 1 Flare. Everything else is x1.',
  },
  { rule: 'Two Lights', text: 'A hit with two Lights uses the better one, so it is never DISSONANT.' },
  { rule: 'Flare', text: 'Each Flare adds 1 to every strike; DISSONANT hits add Flare and OPPOSITE hits calm it.' },
  {
    rule: 'Harmony',
    text: 'The Compass remembers the last Light you played. A card whose Light is next to it on the wheel is Harmonized: it counts as both Lights.',
  },
  { rule: 'Faces', text: 'Only the showing face counts. An OPPOSITE hit turns a two-faced Shade to its other face.' },
  { rule: 'Afflictions', text: 'Afflictions lose 1 stack at the end of your turn, and each Light card soothes its own.' },
  {
    rule: 'Inward',
    text: 'Play a Light card on yourself instead of a Shade to soothe your own feelings: clear all of its affliction and Tend one of its Buried cards.',
  },
  {
    rule: 'Resolve and Suppress',
    text: 'Finish a Shade with its opposite to Resolve it; finish it any other way and you Suppress it and carry it as a Buried card.',
  },
  { rule: 'Afterglow', text: 'A Resolved Shade leaves a gift that matches the feeling it was.' },
  { rule: 'Buried and Insight', text: 'Tend a Buried card to Weight 0 and it becomes Insight, once per kind each run.' },
  { rule: 'Companions and Promises', text: "Companion and Promise hits never Suppress: they leave a Shade Wavering at 1." },
  { rule: 'Understood', text: 'Your next card hit on an Understood Shade counts as OPPOSITE.' },
  {
    rule: 'The Numbness',
    text: 'One Light is MUFFLED and two are FELT; your heaviest Buried cards surface first and Veil it.',
  },
  { rule: 'Festering', text: 'From turn 12, every Shade gains 1 Flare at the start of each of their turns.' },
];
