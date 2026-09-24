// Builders for content data (DESIGN.md 20.3). Plain object constructors; no logic.

import type { AfflictionId, Amount, CompanionId, Cond, Countable, Effect, EnemyId, Light, StatusId } from './types';

// ---- amounts ----
/** add + count(per) * mult. */
export const per = (of: Countable, mult = 1, add = 0, clamp: { min?: number; max?: number } = {}): Amount => ({
  add,
  per: of,
  mult,
  ...clamp,
});
/** Spark +N: +N for each card you played earlier this turn. */
export const spark = (base: number, n: number): Amount => per('playedThisTurn', n, base);
/** +N per Companion. */
export const perCompanion = (base: number, n: number): Amount => per('companions', n, base);
/** +N per stack of a status on the target. */
export const perTargetStatus = (base: number, id: StatusId, n: number): Amount =>
  per({ status: id, on: 'target' }, n, base);

// ---- player-side effects ----
export const ease = (amount: Amount, times?: Amount): Effect =>
  times === undefined ? { op: 'hit', amount } : { op: 'hit', amount, times };
export const easeAll = (amount: Amount, times?: Amount): Effect =>
  times === undefined ? { op: 'hit', amount, to: 'all' } : { op: 'hit', amount, times, to: 'all' };
export const guard = (amount: Amount): Effect => ({ op: 'guard', amount });
export const mend = (amount: Amount): Effect => ({ op: 'mend', amount, to: 'player' });
export const draw = (n: Amount): Effect => ({ op: 'draw', n });
export const energy = (n: Amount): Effect => ({ op: 'energy', n });
export const status = (id: StatusId, stacks: Amount, to: 'player' | 'target' | 'all' | 'self' = 'player'): Effect => ({
  op: 'status',
  id,
  stacks,
  to,
});
export const setStatus = (id: StatusId, n: number, to: 'player' | 'target' | 'self' = 'self'): Effect => ({
  op: 'setStatus',
  id,
  n,
  to,
});
export const clearStatus = (id: StatusId, to: 'player' | 'target' | 'self'): Effect => ({ op: 'clearStatus', id, to });
export const summon = (companion: CompanionId): Effect => ({ op: 'summon', companion });
export const companionsAct = (): Effect => ({ op: 'companionsAct' });
export const promise = (effects: Effect[]): Effect => ({ op: 'promise', effects });
export const nextCardFree = (): Effect => ({ op: 'nextCardFree' });
export const fetchBuried = (): Effect => ({ op: 'fetchBuried' });
export const tendAny = (): Effect => ({ op: 'tendAny' });
export const removeAfflictions = (): Effect => ({ op: 'removeAfflictions' });
export const lingerHand = (): Effect => ({ op: 'lingerHand' });

// ---- Shade-side effects ----
export const strike = (amount: Amount, times?: Amount): Effect =>
  times === undefined ? { op: 'strike', amount } : { op: 'strike', amount, times };
export const afflict = (id: AfflictionId | 'numb', stacks: number): Effect => ({ op: 'afflict', id, stacks });
/** The acting Shade gains Guard. */
export const shadeGuard = (amount: Amount): Effect => ({ op: 'guard', amount });
/** The acting Shade restores Intensity. */
export const shadeMend = (amount: Amount): Effect => ({ op: 'mend', amount, to: 'self' });
/** The acting Shade gains Flare. */
export const flare = (n: number): Effect => ({ op: 'status', id: 'flare', stacks: n, to: 'self' });
/** Change a gauge on the acting Shade. */
export const gauge = (id: StatusId, delta: number): Effect => ({ op: 'status', id, stacks: delta, to: 'self' });
export const spawn = (enemy: EnemyId, max: number): Effect => ({ op: 'spawn', enemy, max });
export const scatter = (n: number): Effect => ({ op: 'scatter', n });
export const mark = (key: string): Effect => ({ op: 'mark', key });
export const unmark = (key: string): Effect => ({ op: 'unmark', key });

// ---- control ----
export const iff = (cond: Cond, then: Effect[], otherwise?: Effect[]): Effect =>
  otherwise === undefined ? { op: 'if', cond, then } : { op: 'if', cond, then, else: otherwise };
/** "Harmony: ..." rider. */
export const ifH = (then: Effect[], otherwise?: Effect[]): Effect => iff({ c: 'harmonized' }, then, otherwise);

// ---- conditions ----
export const has = (...lights: Light[]): Cond => ({ c: 'sourceLights', has: lights, mode: 'any' });
export const lacks = (...lights: Light[]): Cond => ({ c: 'sourceLights', has: lights, mode: 'none' });
export const marked = (key: string): Cond => ({ c: 'marked', key });
export const not = (of: Cond): Cond => ({ c: 'not', of });
export const and = (...of: Cond[]): Cond => ({ c: 'and', of });
export const or = (...of: Cond[]): Cond => ({ c: 'or', of });
export const selfStatus = (id: StatusId, op: '>=' | '<=' | '==' | '>' | '<', n: number): Cond => ({
  c: 'status',
  id,
  on: 'self',
  op,
  n,
});
