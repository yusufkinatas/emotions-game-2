// Engine-level ids and fixed numbers that the rules text names directly (DESIGN 2, 4, 9).
// Content defines the StatusDefs (name, min/max, decay); the engine only needs to know which id means what.

import type { StatusId } from './types';

/** Status ids the engine reads or writes by name. */
export const ST = {
  // player
  nerve: 'nerve',
  warmth: 'warmth',
  seething: 'seething',
  heavy: 'heavy',
  isolated: 'isolated',
  trembling: 'trembling',
  hollow: 'hollow',
  restless: 'restless',
  numb: 'numb',
  nextDraw: 'next_draw',
  nextSpirit: 'next_spirit',
  // Shade
  flare: 'flare',
  hush: 'hush',
  understood: 'understood',
  wavering: 'wavering',
  /** Set on a numb-rules boss while any Surfaced Shade stands (R-16). */
  veiled: 'veiled',
} as const satisfies Record<string, StatusId>;

/** Player statuses that tick down at the end of your turn when the pack has no StatusDef for them. */
export const DEFAULT_DECAYING: readonly StatusId[] = [
  ST.seething,
  ST.heavy,
  ST.isolated,
  ST.trembling,
  ST.hollow,
  ST.restless,
  ST.numb,
  ST.warmth,
];

/** Default caps used when the pack has no StatusDef (DESIGN 4.12, 6.2). */
export const DEFAULT_MAX: Partial<Record<StatusId, number>> = { warmth: 6, understood: 1, wavering: 1, veiled: 1 };

/** EnemyState.memory key: The Mask's remaining hit-turns this player turn (M1). */
export const MEM_TURNS_LEFT = 'turnsLeft';
/** EnemyState.memory key prefix for PassiveDef.once flags. */
export const MEM_ONCE = 'once:';

/** Paper Crane: Mend to this instead of reaching 0 Heart. */
export const PAPER_CRANE_HEART = 25;
/** Lead Box: Surfaced Shades have this percent of their Intensity. */
export const LEAD_BOX_SURFACED_PCT = 150;
/** Instinct-style caps are content; this prefix builds Surfaced Shade ids: shade.surfaced_<shade>. */
export const SURFACED_PREFIX = 'shade.surfaced_';
