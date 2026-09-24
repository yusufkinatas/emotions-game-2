// Shared helpers for run-side tests. Test files must vi.mock the combat module with ./fakeCombat first.

import { createEngine } from '../../../src/engine/index';
import { resolveRules } from '../../../src/engine/rules';
import type { StepScratch } from '../../../src/engine/run/state';
import type { Action, CardInstance, EngineCtx, GameState, Shade } from '../../../src/engine/types';
import { BURIED, fixturePack } from './fixturePack';

export const ctx: EngineCtx = { pack: fixturePack, rules: resolveRules(fixturePack.rules) };
export const engine = createEngine(fixturePack);

export const scratch = (): StepScratch => ({ ctx, events: [], revealed: false });

/** A normal run on the Act 1 map, Warm Locket taken. */
export const freshRun = (seed = 1): GameState => engine.newRun(seed, { charm: 'ks.warm_locket' });

export function giveBuried(s: GameState, shade: Shade, weight: 1 | 2 | 3, peak: 1 | 2 | 3 = weight): CardInstance {
  const card: CardInstance = { uid: s.nextUid++, defId: BURIED[shade].id, upgraded: false, weight, peakWeight: peak };
  s.run.deck.push(card);
  return card;
}

export function giveCard(s: GameState, defId: string, upgraded = false): CardInstance {
  const card: CardInstance = { uid: s.nextUid++, defId, upgraded };
  s.run.deck.push(card);
  return card;
}

export const count = (s: GameState, defId: string): number => s.run.deck.filter((c) => c.defId === defId).length;

export const has = (actions: readonly Action[], a: Action): boolean =>
  actions.some((x) => JSON.stringify(x) === JSON.stringify(a));

/** Steps and asserts invariants afterwards. */
export function step(s: GameState, a: Action): GameState {
  const next = engine.step(s, a).state;
  const bad = engine.checkInvariants(next);
  if (bad.length > 0) throw new Error(`after ${JSON.stringify(a)}: ${bad.join('; ')}`);
  return next;
}

/** Deep-freezes a state so any mutation of a step's input throws. */
export function deepFreeze<T>(x: T): T {
  if (x && typeof x === 'object') {
    Object.freeze(x);
    for (const v of Object.values(x as Record<string, unknown>)) deepFreeze(v);
  }
  return x;
}
