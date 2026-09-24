// Whole runs through the REAL combat module with the run fixture pack (npm run test:slow).
// A random bot (uniform over legal actions, preferring plays) must always reach an ending with invariants holding.
import { describe, expect, it } from 'vitest';

import { createEngine } from '../../src/engine/index';
import { hash32, Rng } from '../../src/engine/rng';
import type { Action, GameState } from '../../src/engine/types';
import { fixturePack } from '../engine/run/fixturePack';

const engine = createEngine(fixturePack);
const RUNS = 40;
const MAX_STEPS = 20_000;

/** Plays cards most of the time so fights end; otherwise uniform over the legal actions. */
function choose(s: GameState, legal: Action[], rng: Rng): Action {
  if (s.phase.kind === 'combat') {
    const plays = legal.filter((a) => a.t === 'play' || a.t === 'choose');
    if (plays.length > 0 && rng.float() < 0.85) return rng.pick(plays);
  }
  return rng.pick(legal);
}

function playRun(seed: number): { s: GameState; steps: number } {
  const rng = new Rng(hash32(seed, 'real'));
  let s = engine.newRun(seed, seed % 5 === 0 ? { tutorial: true } : {});
  let steps = 0;
  for (; steps < MAX_STEPS; steps++) {
    const legal = engine.legalActions(s);
    if (legal.length === 0) break;
    const a = choose(s, legal, rng);
    s = engine.step(s, a).state;
    const bad = engine.checkInvariants(s);
    if (bad.length > 0) throw new Error(`seed ${seed} step ${steps} ${JSON.stringify(a)}: ${bad.join('; ')}`);
  }
  return { s, steps };
}

describe(`real combat, ${RUNS} random runs on the run fixture pack`, () => {
  it('every run reaches victory or defeat; saves round-trip; same seed gives the same end state', () => {
    for (let seed = 1; seed <= RUNS; seed++) {
      const { s, steps } = playRun(seed);
      expect(['victory', 'defeat'], `seed ${seed} stuck in ${s.phase.kind} after ${steps} steps`).toContain(s.phase.kind);
      expect(engine.deserialize(engine.serialize(s))).toEqual(s);
    }
    expect(engine.hash(playRun(7).s)).toBe(engine.hash(playRun(7).s));
  });
});
