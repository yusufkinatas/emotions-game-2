// Tunable rule numbers (DESIGN.md 20.4). Structure of the chart, Harmony and Resolve/Suppress is not here:
// only numbers that the simulator may sweep.

import type { Light, Shade } from './emotions';

export interface RulesConfig {
  startHeart: number;
  startGlimmers: number;
  energyPerTurn: number;
  handSize: number;
  maxHand: number;

  oppositePct: number;
  neutralPct: number;
  dissonantPct: number;
  feltPct: number;
  muffledPct: number;
  heavyPct: number;
  tremblingPct: number;

  /** Flare a Shade gains from a non-lethal DISSONANT card hit. */
  dissonanceFlare: number;
  /** Flare removed from a Shade by a non-lethal OPPOSITE hit. */
  oppositeFlareRemove: number;
  /** Affliction stacks removed per effective Light by an outward play. */
  cleansePerOutwardPlay: number;

  buriedMaxWeight: number;
  /** Max Heart lost when a Suppress would push a Buried card past buriedMaxWeight. */
  buriedOverflowMaxHeart: number;

  surfacedHpPerWeight: number;
  /** Boss gains this much max Intensity and Intensity per Weight when you Suppress a Surfaced Shade (B2). */
  surfacedSuppressGrowPerWeight: number;

  maxCompanions: number;
  maxShades: number;
  festerTurn: number;
  turnLimit: number;
  triggerCap: number;

  compassAfterWins: number;
  havenRestPct: number;
  bossMendToFull: boolean;

  glimmersBase: { normal: number; elite: number; boss: number; final: number };
  glimmersResolve: { normal: number; elite: number; boss: number; final: number };

  /** 'clockwise' is the real game. A table exists only for tests and sweeps: Shade -> its DISSONANT Light. */
  dissonance: 'clockwise' | Record<Shade, Light>;
}

export const DEFAULT_RULES: RulesConfig = {
  startHeart: 70,
  startGlimmers: 50,
  energyPerTurn: 3,
  handSize: 5,
  maxHand: 10,

  oppositePct: 200,
  neutralPct: 100,
  dissonantPct: 50,
  feltPct: 200,
  muffledPct: 50,
  heavyPct: 75,
  tremblingPct: 75,

  dissonanceFlare: 1,
  oppositeFlareRemove: 1,
  cleansePerOutwardPlay: 1,

  buriedMaxWeight: 3,
  buriedOverflowMaxHeart: 3,

  surfacedHpPerWeight: 12,
  surfacedSuppressGrowPerWeight: 10,

  maxCompanions: 3,
  maxShades: 4,
  festerTurn: 12,
  turnLimit: 40,
  triggerCap: 1000,

  compassAfterWins: 2,
  havenRestPct: 30,
  bossMendToFull: true,

  glimmersBase: { normal: 10, elite: 25, boss: 60, final: 0 },
  glimmersResolve: { normal: 8, elite: 20, boss: 40, final: 0 },

  dissonance: 'clockwise',
};

/** Merge partial overrides (content pack, then run options) over the defaults. Nested objects merge shallowly. */
export function resolveRules(...layers: (Partial<RulesConfig> | undefined)[]): RulesConfig {
  let out: RulesConfig = { ...DEFAULT_RULES };
  for (const layer of layers) {
    if (!layer) continue;
    out = {
      ...out,
      ...layer,
      glimmersBase: { ...out.glimmersBase, ...(layer.glimmersBase ?? {}) },
      glimmersResolve: { ...out.glimmersResolve, ...(layer.glimmersResolve ?? {}) },
    };
  }
  return out;
}
