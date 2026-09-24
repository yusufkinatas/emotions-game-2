// UI words (DESIGN 2). Internal names are mechanical (hp, guard, energy); these are the words players see.

import type { CardKind, IntentKind, LethalOutcome, MapNode, Rarity, Relation } from '../engine/types';

/** Mechanical engine name -> display word. */
export const TERMS = {
  heart: 'Heart',
  shadeHp: 'Intensity',
  energy: 'Spirit',
  guard: 'Guard',
  hit: 'Ease',
  mend: 'Mend',
  flare: 'Flare',
  nerve: 'Nerve',
  note: 'Note',
  harmonized: 'Harmonized',
  face: 'Face',
  inward: 'Inward',
  afterglow: 'Afterglow',
  glimmers: 'Glimmers',
  keepsake: 'Keepsake',
  charm: 'Charm',
  companion: 'Companion',
  promise: 'Promise',
  weight: 'Weight',
  tend: 'Tend',
  insight: 'Insight',
  buried: 'Buried',
  haven: 'Haven',
  sanctuary: 'Sanctuary',
  memory: 'Memory',
  chest: 'Chest',
} as const;

/** Chip and banner labels for each hit relation. */
export const RELATION_LABEL: Record<Relation, string> = {
  opposite: 'OPPOSITE x2',
  neutral: 'x1',
  dissonant: 'DISSONANT x1/2',
  felt: 'FELT x2',
  muffled: 'MUFFLED x1/2',
  veiled: 'VEILED',
};

export const OUTCOME_LABEL: Record<LethalOutcome, string> = {
  resolve: 'RESOLVE',
  deepResolve: 'DEEP RESOLVE',
  suppress: 'SUPPRESS',
  wavering: 'WAVERING',
  fade: 'FADES',
};

export const NODE_KIND_LABEL: Record<MapNode['kind'], string> = {
  fight: 'Fight',
  elite: 'Elite',
  haven: 'Haven',
  sanctuary: 'Sanctuary',
  memory: 'Memory',
  chest: 'Chest',
  boss: 'Boss',
};

export const INTENT_KIND_LABEL: Record<IntentKind, string> = {
  strike: 'Strike',
  guard: 'Guard',
  afflict: 'Afflict',
  buff: 'Buff',
  mend: 'Mend',
  summon: 'Summon',
  scatter: 'Scatter',
};

/** Card footer word ("LOVE . EASE"). */
export const CARD_KIND_LABEL: Record<CardKind, string> = {
  ease: 'EASE',
  skill: 'SKILL',
  mood: 'MOOD',
  buried: 'BURIED',
};

export const RARITY_LABEL: Record<Rarity, string> = {
  starter: 'Starter',
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  blend: 'Blend',
  special: 'Special',
};

export const KEYWORD_LABEL = {
  linger: 'Linger',
  letGo: 'Let Go',
  innate: 'Innate',
  reachesShy: 'Reaches Shy',
} as const;

export interface GlossaryEntry {
  term: string;
  meaning: string;
}

/** Codex glossary, in the order of DESIGN 2 (plus the card keywords of 4.15). */
export const GLOSSARY: readonly GlossaryEntry[] = [
  { term: 'Heart', meaning: 'Your Heart. You start with 70. At 0 your run ends and your Heart rests.' },
  { term: 'Spirit', meaning: 'What cards cost. You get 3 each turn.' },
  {
    term: 'Guard',
    meaning: "Absorbs strikes before your Heart does. Yours fades at the start of your turn; a Shade's when it acts.",
  },
  { term: 'Intensity', meaning: 'How big a Shade has grown. Ease it to 0.' },
  { term: 'Ease X', meaning: "Lower a Shade's Intensity by X, after Nerve, Heavy and how its feeling meets your Light." },
  { term: 'Mend X', meaning: 'Restore X Heart, never above your max Heart.' },
  { term: 'Light', meaning: 'A feeling you play as cards: Love, Joy, Friendship, Courage, Hope, Calm.' },
  {
    term: 'Shade',
    meaning: 'A feeling that got too big to carry alone: Anger, Sadness, Loneliness, Fear, Despair, Anxiety.',
  },
  {
    term: 'Blend',
    meaning:
      'Two Lights side by side on the wheel: Delight, Playfulness, Loyalty, Determination, Patience, Compassion.',
  },
  { term: 'OPPOSITE x2', meaning: "The hit carries the Light that answers the Shade's showing face." },
  { term: 'DISSONANT x1/2', meaning: 'The only Light that matters is the bad advice for that Shade. It also Flares.' },
  {
    term: 'FELT x2 / MUFFLED x1/2',
    meaning: 'Against Apathy and The Numbness: two Lights at once are felt, one Light is muffled.',
  },
  { term: 'VEILED', meaning: "While a Surfaced Shade stands, Apathy or The Numbness can't be targeted." },
  { term: 'Flare', meaning: 'A Shade grows fierce: +1 to each of its strikes per Flare.' },
  { term: 'Nerve', meaning: 'Your inner strength: +1 to each hit from your cards per Nerve.' },
  { term: 'Note', meaning: 'The Light of the last Light card you played this combat, shown on the Compass.' },
  { term: 'Harmonized', meaning: 'A card whose Light sits next to the Note. It counts as both Lights.' },
  { term: 'Face', meaning: 'The feeling a many-sided Shade is showing right now.' },
  {
    term: 'Affliction',
    meaning: 'A feeling a Shade leaves on you: Seething, Heavy, Isolated, Trembling, Hollow, Restless, Numb.',
  },
  { term: 'Inward', meaning: 'Play a Light card on yourself to clear its affliction and Tend one of its Buried cards.' },
  {
    term: 'RESOLVE / DEEP RESOLVE',
    meaning: 'Finish a Shade with its opposite (both opposites for a two-faced Shade). It heals and helps you.',
  },
  { term: 'SUPPRESS', meaning: 'Finish a Shade any other way. You carry it as a Buried card.' },
  { term: 'Afterglow', meaning: 'The gift a Resolved Shade leaves behind.' },
  { term: 'Wavering', meaning: 'Held at 1 Intensity by a Companion or Promise. Finish it yourself.' },
  { term: 'Fleeting', meaning: 'A small Shade that simply fades at 0.' },
  { term: 'Buried', meaning: 'An unplayable card you carry after Suppressing a Shade. It weighs on you while held.' },
  { term: 'Weight', meaning: 'Pips on a Buried card, 1 to 3: how heavy it is.' },
  { term: 'Tend', meaning: "Lower a Buried card's Weight by 1. At 0 it becomes Insight." },
  { term: 'Insight', meaning: 'A strong card made from a Buried card you Tended or Resolved.' },
  { term: 'Understood', meaning: 'Your next card hit on this Shade counts as OPPOSITE.' },
  { term: 'Companion', meaning: "A Friendship ally that acts at the end of your turn. Shades never strike it." },
  { term: 'Promise', meaning: 'At the start of your next turn: ...' },
  { term: 'Spark +N', meaning: '+N Ease for each card you played earlier this turn.' },
  { term: 'Linger', meaning: 'This card stays in your hand at the end of your turn.' },
  { term: 'Let Go', meaning: 'Set aside for the rest of this combat after it is played.' },
  { term: 'Innate', meaning: 'Starts in your opening hand.' },
  { term: 'Reaches Shy', meaning: 'Can target Shy Shades.' },
  { term: 'Mood', meaning: 'Played once, it lasts the whole combat.' },
  { term: 'Hush X', meaning: "The Shade's next attack strikes X softer each time." },
  { term: 'Glimmers', meaning: 'Little lights you spend at the Sanctuary. You start with 50.' },
  { term: 'Keepsake', meaning: 'A small treasure that changes the rules a little.' },
  { term: 'Charm', meaning: 'The Keepsake you choose at the start of a run.' },
  {
    term: 'Haven / Sanctuary / Memory / Chest',
    meaning: 'Places on the map: rest, shop with Mo, a small story, a Keepsake.',
  },
  { term: 'Full Bloom', meaning: 'Every Shade in a fight was Resolved: the card reward gets a 4th option.' },
  { term: 'Festering', meaning: 'From turn 12, every Shade gains 1 Flare at the start of each of their turns.' },
];

/**
 * Banned in game text (DESIGN 2): "damage" (use Ease), kill/defeat/destroy (use Resolve/Suppress),
 * enemy/monster, curse, "you died", and clinical terms. Word stems, matched case-insensitively at word starts.
 */
export const BANNED_WORDS: readonly string[] = [
  'damag',
  'kill',
  'defeat',
  'destroy',
  'enem',
  'monster',
  'curse',
  'you died',
  'therap',
  'depress',
  'trauma',
  'disorder',
  'mental illness',
];
