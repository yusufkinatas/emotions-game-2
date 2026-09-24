// Review: whole runs through the REAL combat module on the run fixture pack, played by a trivial bot
// (in combat: the first legal action that is not endTurn, else endTurn; elsewhere: the first legal action).
// Every run must reach victory or defeat without throwing, with invariants holding after every step.

import { describe, expect, it } from 'vitest';

import { createEngine } from '../../../../src/engine/index';
import type { Action, GameState, NewRunOpts } from '../../../../src/engine/types';
import { fixturePack } from '../fixturePack';

const engine = createEngine(fixturePack);
const MAX_STEPS = 20_000;

function trivialBot(s: GameState, legal: readonly Action[]): Action {
  if (s.phase.kind === 'combat') return legal.find((a) => a.t !== 'endTurn') ?? legal.find((a) => a.t === 'endTurn')!;
  return legal[0]!;
}

interface Played {
  final: GameState;
  steps: number;
  phases: string[];
  hashes: string[];
}

function playRun(seed: number, opts: NewRunOpts): Played {
  let s = engine.newRun(seed, opts);
  expect(engine.checkInvariants(s), `seed ${seed} at start`).toEqual([]);
  const phases: string[] = [s.phase.kind];
  const hashes: string[] = [engine.hash(s)];
  let steps = 0;
  for (; steps < MAX_STEPS; steps++) {
    const legal = engine.legalActions(s);
    if (legal.length === 0) break;
    const a = trivialBot(s, legal);
    s = engine.step(s, a).state;
    const bad = engine.checkInvariants(s);
    if (bad.length > 0) throw new Error(`seed ${seed} step ${steps} ${JSON.stringify(a)}: ${bad.join('; ')}`);
    if (phases.at(-1) !== s.phase.kind) phases.push(s.phase.kind);
    hashes.push(engine.hash(s));
  }
  return { final: s, steps, phases, hashes };
}

const played = new Map<string, Played>();
/** Each case is played once and shared between the tests below. */
function playOnce(seed: number, opts: NewRunOpts): Played {
  const key = `${seed}:${JSON.stringify(opts)}`;
  let r = played.get(key);
  if (!r) {
    r = playRun(seed, opts);
    played.set(key, r);
  }
  return r;
}

const CASES: { seed: number; opts: NewRunOpts }[] = [
  ...[1, 2, 3, 4, 5].map((seed) => ({ seed, opts: {} })),
  ...[11, 12].map((seed) => ({ seed, opts: { tutorial: true } })),
  ...fixturePack.starter.charms.map((charm, i) => ({ seed: 20 + i, opts: { charm } })),
];

describe('integration: trivial bot, real combat, run fixture pack', () => {
  for (const { seed, opts } of CASES) {
    it(`seed ${seed} ${JSON.stringify(opts)} reaches victory or defeat with invariants holding after every step`, () => {
      const r = playOnce(seed, opts);
      expect(['victory', 'defeat'], `stuck in ${r.final.phase.kind} after ${r.steps} steps`).toContain(r.final.phase.kind);
      expect(engine.legalActions(r.final)).toEqual([]);
      // Every run goes through real fights before it ends.
      expect(r.phases).toContain('combat');
      expect(r.final.combat).toBeNull();
      // A finished run's save round-trips unchanged.
      expect(engine.deserialize(engine.serialize(r.final))).toEqual(r.final);
    });
  }

  it('is deterministic: same seed and bot give the same state hash after every step', () => {
    for (const { seed, opts } of [CASES[0]!, CASES[5]!]) expect(playRun(seed, opts).hashes).toEqual(playOnce(seed, opts).hashes);
  });

  it('the bot reaches The Deep on some seeds (run flow beyond Act 1 is exercised)', () => {
    const acts = CASES.map(({ seed, opts }) => playOnce(seed, opts).final.run.act);
    expect(Math.max(...acts)).toBe(3);
  });
});
