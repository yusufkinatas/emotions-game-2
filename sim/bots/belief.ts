// Bot beliefs (DESIGN 21.1): what a bot thinks the rules are. The engine always applies the true rules;
// a belief only changes how the bot scores previews and run choices.

import {
  LIGHTS,
  SHADES,
  cureOf,
  lightIndex,
  shadeIndex,
  type Light,
  type Relation,
  type Shade,
  type TargetTyping,
} from '../../src/engine/index';

export interface BelievedRelation {
  relation: Relation;
  pct: number;
}

export interface Belief {
  name: string;
  /** True when the believed chart is the engine's: preview numbers are used as they are (no re-derivation). */
  exactChart: boolean;
  /** Believed percent of a hit (21.1): aware = engine relation, blind = 100, confused = chart rotated -1. */
  typePct(lights: readonly Light[], t: TargetTyping, fromCard?: boolean): number;
  relation(lights: readonly Light[], t: TargetTyping, fromCard: boolean): BelievedRelation;
  /** The Light the bot believes answers a Shade (confused: the actual DISSONANT Light; blind: none). */
  cureOf(shade: Shade): Light | null;
  knowsResolve: boolean;
  knowsHarmony: boolean;
  knowsFlare: boolean;
  knowsCleanse: boolean;
  knowsFaces: boolean;
  usesMapHints: boolean;
  draftsForCoverage: boolean;
}

/** Default percents (DEFAULT_RULES). Beliefs are about the chart, not about tuning numbers. */
const PCT: Record<Relation, number> = { opposite: 200, neutral: 100, dissonant: 50, felt: 200, muffled: 50, veiled: 0 };

interface Chart {
  cure(shade: Shade): Light;
  dissonantShade(light: Light): Shade;
}

/** The true chart (R-2): opposite iff same index, dissonant against the clockwise neighbour's Shade. */
const TRUE_CHART: Chart = {
  cure: cureOf,
  dissonantShade: (l) => SHADES[(lightIndex(l) + 1) % 6]!,
};

/**
 * M15: the confused chart is rotated -1 wheel step. Its believed cure of Shade s is LIGHTS[s - 1], which is
 * exactly s's real DISSONANT Light, and it believes each Light is dissonant against the Shade two steps on.
 */
const ROTATED_CHART: Chart = {
  cure: (s) => LIGHTS[(shadeIndex(s) + 5) % 6]!,
  dissonantShade: (l) => SHADES[(lightIndex(l) + 2) % 6]!,
};

/** relationOf (R-2, R-2a, R-11, R-12, R-16) written against an arbitrary chart. */
function chartRelation(chart: Chart, lights: readonly Light[], t: TargetTyping, fromCard: boolean): BelievedRelation {
  if (t.rule === 'numb') {
    if (t.veiled) return { relation: 'veiled', pct: 0 };
    return lights.length >= 2 ? { relation: 'felt', pct: PCT.felt } : { relation: 'muffled', pct: PCT.muffled };
  }
  if (t.understood && fromCard) return { relation: 'opposite', pct: PCT.opposite };
  if (lights.length === 0) return { relation: 'neutral', pct: PCT.neutral };
  if (lights.some((l) => chart.cure(t.face) === l)) return { relation: 'opposite', pct: PCT.opposite };
  if (lights.some((l) => chart.dissonantShade(l) !== t.face)) return { relation: 'neutral', pct: PCT.neutral };
  if (!fromCard) return { relation: 'neutral', pct: PCT.neutral };
  return { relation: 'dissonant', pct: PCT.dissonant };
}

const NEUTRAL: BelievedRelation = { relation: 'neutral', pct: 100 };

interface Flags {
  knowsResolve: boolean;
  knowsHarmony: boolean;
  knowsFlare: boolean;
  knowsCleanse: boolean;
  knowsFaces: boolean;
  usesMapHints: boolean;
  draftsForCoverage: boolean;
}

const ALL_ON: Flags = {
  knowsResolve: true,
  knowsHarmony: true,
  knowsFlare: true,
  knowsCleanse: true,
  knowsFaces: true,
  usesMapHints: true,
  draftsForCoverage: true,
};

const ALL_OFF: Flags = {
  knowsResolve: false,
  knowsHarmony: false,
  knowsFlare: false,
  knowsCleanse: false,
  knowsFaces: false,
  usesMapHints: false,
  draftsForCoverage: false,
};

function chartBelief(name: string, chart: Chart, exact: boolean, flags: Flags): Belief {
  return {
    name,
    exactChart: exact,
    typePct: (lights, t, fromCard = true) => chartRelation(chart, lights, t, fromCard).pct,
    relation: (lights, t, fromCard) => chartRelation(chart, lights, t, fromCard),
    cureOf: chart.cure,
    ...flags,
  };
}

/** Everything true: the reference skilled bot. */
export const awareBelief = (name = 'aware', off: Partial<Flags> = {}): Belief =>
  chartBelief(name, TRUE_CHART, true, { ...ALL_ON, ...off });

/** True chart for damage only; no Resolve, Harmony, Flare, cleanse or face knowledge (and no run hints). */
export const greedyTypeBelief = (): Belief => chartBelief('greedyType', TRUE_CHART, true, ALL_OFF);

/**
 * Lead ruling (21.1): greedyType's flags (all off) with the chart rotated -1 (M15), so confused differs from
 * greedyType only in the chart it believes. Gated as greedyType - confused > 0 (21.3).
 */
export const confusedBelief = (): Belief => chartBelief('confused', ROTATED_CHART, false, ALL_OFF);

/** Type-blind: every relation believed neutral (x1), every flag off. Its cure guesses never match anything. */
export function blindBelief(): Belief {
  return {
    name: 'blind',
    exactChart: false,
    typePct: () => 100,
    relation: () => NEUTRAL,
    cureOf: () => null,
    ...ALL_OFF,
  };
}
