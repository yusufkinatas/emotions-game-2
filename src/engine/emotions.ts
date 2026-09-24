// The emotion wheel, the type chart, Harmony and lethal outcomes (DESIGN.md 4.1, 4.2, 4.4, 4.8, 4.16).
// Pure functions only. Percentages come from RulesConfig so balance sweeps can change them.

import type { RulesConfig } from './rules';

export const LIGHTS = ['love', 'joy', 'friendship', 'courage', 'hope', 'calm'] as const;
export const SHADES = ['anger', 'sadness', 'loneliness', 'fear', 'despair', 'anxiety'] as const;
/** BLENDS[i] = LIGHTS[i] + LIGHTS[(i + 1) % 6]. */
export const BLENDS = ['delight', 'playfulness', 'loyalty', 'determination', 'patience', 'compassion'] as const;
export const AFFLICTIONS = ['seething', 'heavy', 'isolated', 'trembling', 'hollow', 'restless'] as const;

export type Light = (typeof LIGHTS)[number];
export type Shade = (typeof SHADES)[number];
export type Blend = (typeof BLENDS)[number];
export type AfflictionId = (typeof AFFLICTIONS)[number];
export type Relation = 'opposite' | 'neutral' | 'dissonant' | 'felt' | 'muffled' | 'veiled';
export type LethalOutcome = 'resolve' | 'deepResolve' | 'suppress' | 'wavering' | 'fade';

/** Affliction inflicted by each Shade (and by its Buried card). Index-aligned with SHADES. */
export const AFFLICTION_OF: Record<Shade, AfflictionId> = {
  anger: 'seething',
  sadness: 'heavy',
  loneliness: 'isolated',
  fear: 'trembling',
  despair: 'hollow',
  anxiety: 'restless',
};

/** Light whose plays soothe each affliction (the cure of the Shade that inflicts it). */
export const AFFLICTION_CURE: Record<AfflictionId, Light> = {
  seething: 'love',
  heavy: 'joy',
  isolated: 'friendship',
  trembling: 'courage',
  hollow: 'hope',
  restless: 'calm',
};

export const lightIndex = (l: Light): number => LIGHTS.indexOf(l);
export const shadeIndex = (s: Shade): number => SHADES.indexOf(s);

export const isLight = (x: string): x is Light => (LIGHTS as readonly string[]).includes(x);
export const isShade = (x: string): x is Shade => (SHADES as readonly string[]).includes(x);

/** The Light that answers (is OPPOSITE to) a Shade. */
export const cureOf = (s: Shade): Light => LIGHTS[shadeIndex(s)]!;
/** The Shade a Light answers. */
export const shadeCuredBy = (l: Light): Shade => SHADES[lightIndex(l)]!;
/** The affliction a Light soothes. */
export const afflictionSoothedBy = (l: Light): AfflictionId => AFFLICTION_OF[shadeCuredBy(l)];

/**
 * R-2 clockwise rule: a Light is DISSONANT against the Shade its clockwise neighbour cures.
 * With `rules.dissonance` set to a table (tests and sweeps only) the table wins.
 */
export function dissonantShadeOf(l: Light, rules?: Pick<RulesConfig, 'dissonance'>): Shade {
  const table = rules?.dissonance;
  if (table && table !== 'clockwise') {
    const hit = SHADES.find((s) => table[s] === l);
    if (hit) return hit;
  }
  return SHADES[(lightIndex(l) + 1) % 6]!;
}

/** The "bad advice" Light for a Shade: the one that is DISSONANT against it. */
export function dissonantLightOf(s: Shade, rules?: Pick<RulesConfig, 'dissonance'>): Light {
  const table = rules?.dissonance;
  if (table && table !== 'clockwise') return table[s];
  return LIGHTS[(shadeIndex(s) + 5) % 6]!;
}

export const adjacent = (a: Light, b: Light): boolean => {
  const d = Math.abs(lightIndex(a) - lightIndex(b));
  return d === 1 || d === 5;
};

export const across = (a: Light, b: Light): boolean => Math.abs(lightIndex(a) - lightIndex(b)) === 3;

/** Blend of two adjacent Lights, or null. */
export function blendOf(a: Light, b: Light): Blend | null {
  if (!adjacent(a, b)) return null;
  const lo = (lightIndex(a) + 1) % 6 === lightIndex(b) ? lightIndex(a) : lightIndex(b);
  return BLENDS[lo]!;
}

/** The two Lights of a Blend, in wheel order. */
export function lightsOfBlend(b: Blend): [Light, Light] {
  const i = BLENDS.indexOf(b);
  return [LIGHTS[i]!, LIGHTS[(i + 1) % 6]!];
}

/** Blend named by a set of effective Lights (2 adjacent Lights), else null. */
export function blendOfLights(lights: readonly Light[]): Blend | null {
  if (lights.length !== 2) return null;
  return blendOf(lights[0]!, lights[1]!);
}

/** How a target is typed for a single hit. */
export type TargetTyping =
  | { rule: 'standard'; face: Shade; understood: boolean }
  | { rule: 'numb'; veiled: boolean };

export interface RelationOpts {
  /** True for hits from the card being played. False for automatic hits (Companions, Promises, Keepsakes). */
  fromCard: boolean;
  lightningRod: boolean;
}

export type RelationPcts = Pick<
  RulesConfig,
  'oppositePct' | 'neutralPct' | 'dissonantPct' | 'feltPct' | 'muffledPct' | 'dissonance'
>;

/**
 * R-2, R-2a, R-11, R-12, R-16. Relation of a hit carrying `lights` against a target, plus integer percent.
 * - Multi-Light hits use the best relation among their Lights (never DISSONANT).
 * - Automatic hits are never DISSONANT (treated as neutral).
 * - Understood only affects hits from cards.
 * - Numb rules: 2+ Lights FELT, fewer MUFFLED, Veiled 0.
 */
export function relationOf(
  lights: readonly Light[],
  t: TargetTyping,
  o: RelationOpts,
  rules: RelationPcts,
): { relation: Relation; pct: number } {
  if (t.rule === 'numb') {
    if (t.veiled) return { relation: 'veiled', pct: 0 };
    return lights.length >= 2
      ? { relation: 'felt', pct: rules.feltPct }
      : { relation: 'muffled', pct: rules.muffledPct };
  }
  if (t.understood && o.fromCard) return { relation: 'opposite', pct: rules.oppositePct };
  if (lights.length === 0) return { relation: 'neutral', pct: rules.neutralPct };
  if (lights.some((l) => cureOf(t.face) === l)) return { relation: 'opposite', pct: rules.oppositePct };
  if (lights.some((l) => dissonantShadeOf(l, rules) !== t.face)) return { relation: 'neutral', pct: rules.neutralPct };
  if (!o.fromCard) return { relation: 'neutral', pct: rules.neutralPct };
  return { relation: 'dissonant', pct: o.lightningRod ? rules.neutralPct : rules.dissonantPct };
}

export interface HarmonyOpts {
  /** True while the player owns The Compass (flag 'harmony'). */
  enabled: boolean;
  /** True while the player has 1+ Isolated. */
  isolated: boolean;
  /** Mirror Shard: Lights directly across the wheel also Harmonize. */
  mirror: boolean;
}

/**
 * R-4. Given the Note and a card's printed Lights, returns its effective Lights and whether it is Harmonized.
 * - A mono card next to a Note Light gains that Light (clockwise-first if two qualify).
 * - A Blend card is Harmonized only by a Note Light outside its own pair that is adjacent to one of its Lights;
 *   it never gains a third Light.
 * - Same Light as the Note, non-adjacent Lights, empty Note or printed [] are never Harmonized.
 */
export function harmonize(
  note: readonly Light[],
  printed: readonly Light[],
  o: HarmonyOpts,
): { effective: Light[]; harmonized: boolean } {
  if (!o.enabled || o.isolated || printed.length === 0 || note.length === 0) {
    return { effective: [...printed], harmonized: false };
  }
  const partners = (own: Light): Light[] =>
    note.filter((n) => !printed.includes(n) && (adjacent(n, own) || (o.mirror && across(n, own))));
  for (const own of printed) {
    const cands = partners(own);
    if (cands.length === 0) continue;
    if (printed.length >= 2) return { effective: [...printed], harmonized: true };
    const dist = (n: Light) => (lightIndex(n) - lightIndex(own) + 6) % 6;
    const pick = [...cands].sort((a, b) => dist(a) - dist(b))[0]!;
    return { effective: [own, pick], harmonized: true };
  }
  return { effective: [...printed], harmonized: false };
}

/**
 * R-8 / R-16 (v1.1). Outcome when a hit reduces a Shade to 0 Intensity or less.
 * `face` is the showing face, or null for numb-rules Shades (Apathy, The Numbness).
 */
export function lethalOutcome(
  lights: readonly Light[],
  faces: readonly Shade[],
  face: Shade | null,
  rel: Relation,
  o: { fromCard: boolean; fleeting: boolean; understood: boolean },
): LethalOutcome {
  if (o.fleeting) return 'fade';
  const resolves = face === null ? rel === 'felt' : (o.understood && o.fromCard) || lights.includes(cureOf(face));
  if (resolves) {
    const deep = faces.length === 2 && faces.every((f) => lights.includes(cureOf(f)));
    return deep && o.fromCard ? 'deepResolve' : 'resolve';
  }
  return o.fromCard ? 'suppress' : 'wavering';
}
