// Records the simulator produces (one per run) and the options that shape a run.

import type { Light, Relation } from '../src/engine/index';
import type { BotName, ProbeCounts } from './bots/index';

export type Tier = 'normal' | 'elite' | 'boss' | 'final' | 'event' | 'tutorial';

export interface CombatRecord {
  encounter: string;
  tier: Tier;
  act: number;
  floor: number;
  won: boolean;
  /** Player turns started (turn number reached). */
  turns: number;
  heartStart: number;
  heartLost: number;
  cardsPlayed: number;
  maxCardsPerTurn: number;
  resolves: number;
  deepResolves: number;
  suppresses: number;
}

export interface DeckRecord {
  total: number;
  easeByLight: Record<Light, number>;
  /** 12.2 most common Light (ease cards only, ties by wheel order). */
  dominant: Light;
  buried: number;
  buriedWeight: number;
  insight: number;
  neutral: number;
  blends: number;
}

export interface RunRecord {
  seed: number;
  bot: BotName;
  charm: string | null;
  win: boolean;
  ending: 'resolved' | 'suppressed' | null;
  defeat: { cause: string; encounter: string | null; tier: Tier | null; act: number } | null;
  floors: number;
  actReached: number;
  combats: CombatRecord[];
  /** Card damage (before Guard) by relation. */
  dmg: Partial<Record<Relation, number>>;
  resolves: number;
  deepResolves: number;
  suppresses: number;
  cardsAfterCompass: number;
  harmonizedAfterCompass: number;
  tends: number;
  insights: number;
  buriedWeightAtDeep: number | null;
  reachedNumbness: boolean;
  numbnessWon: boolean;
  maxCardsPerTurn: number;
  decisions: { combat: number; run: number };
  actions: number;
  deck: DeckRecord;
  probe: ProbeCounts | null;
  violations: string[];
  error: string | null;
  softlock: boolean;
  /** Action list, kept only for runs with an error, a violation or a softlock (repro). */
  replay: unknown[] | null;
  ms: number;
}

export interface RunOpts {
  /** Check engine invariants after every step (--strict). */
  strict?: boolean;
  /** Softlock guard: a run taking more actions than this is stopped and flagged. */
  actionCap?: number;
  /** Run the divergence probe on aware's decisions. */
  probe?: boolean;
}
