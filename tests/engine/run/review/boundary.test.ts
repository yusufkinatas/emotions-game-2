// Review: Engine boundary properties (DESIGN 20.1, 20.5, 20.6, 22) with the REAL combat module.
// The run suite checks these with fakeCombat only; here whole runs go through real fights.

import { describe, expect, it } from 'vitest';

import { createEngine, sameAction } from '../../../../src/engine/index';
import { hash32, Rng } from '../../../../src/engine/rng';
import { IllegalActionError, type Action, type GameState } from '../../../../src/engine/types';
import { fixturePack } from '../fixturePack';

const engine = createEngine(fixturePack);

/** Mostly plays cards so fights end; otherwise uniform over the legal actions (seeded, replayable). */
function randomBot(rng: Rng) {
  return (s: GameState, legal: readonly Action[]): Action => {
    if (s.phase.kind === 'combat') {
      const plays = legal.filter((a) => a.t !== 'endTurn');
      if (plays.length > 0 && rng.float() < 0.9) return rng.pick(plays);
    }
    return rng.pick(legal);
  };
}

function deepFreeze<T>(x: T): T {
  if (x && typeof x === 'object') {
    Object.freeze(x);
    for (const v of Object.values(x as Record<string, unknown>)) deepFreeze(v);
  }
  return x;
}

/** Plausible but mostly illegal combat actions: every combat card x (no target, each Shade, a gone Shade, a bogus uid) x Inward. */
function combatCandidates(s: GameState): Action[] {
  const c = s.combat!;
  const out: Action[] = [{ t: 'endTurn' }, { t: 'confirm' }, { t: 'continue' }, { t: 'skip' }, { t: 'move', node: 0 }];
  const targets = [undefined, ...c.enemies.map((e) => e.uid), ...c.gone.map((g) => g.uid), 987_654];
  for (const uid of [...Object.keys(c.cards).map(Number), 987_655]) {
    out.push({ t: 'choose', uid });
    for (const target of targets) {
      out.push(target === undefined ? { t: 'play', card: uid } : { t: 'play', card: uid, target });
      out.push(target === undefined ? { t: 'play', card: uid, inward: true } : { t: 'play', card: uid, target, inward: true });
    }
  }
  return out;
}

describe('20.6: step accepts exactly the actions legalActions lists (real combat)', () => {
  it('every other action throws IllegalActionError, in combat and between fights', () => {
    let checked = 0;
    for (const seed of [1, 2, 3]) {
      const bot = randomBot(new Rng(hash32(seed, 'boundary')));
      let s = engine.newRun(seed, seed === 3 ? { tutorial: true } : {});
      for (let n = 0; n < 1500; n++) {
        const legal = engine.legalActions(s);
        if (legal.length === 0) break;
        if (s.phase.kind === 'combat' && n % 7 === 0) {
          for (const a of combatCandidates(s)) {
            const isLegal = legal.some((x) => sameAction(x, a));
            let thrown: unknown = null;
            try {
              engine.step(s, a);
            } catch (err) {
              thrown = err;
            }
            checked += 1;
            if (isLegal) expect(thrown, `legal ${JSON.stringify(a)} threw`).toBeNull();
            else expect(thrown, `illegal ${JSON.stringify(a)} was accepted`).toBeInstanceOf(IllegalActionError);
          }
        }
        s = engine.step(s, bot(s, legal)).state;
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });
});

describe('20.1 purity, 20.5 determinism and 20.8 saves across real fights', () => {
  it('a deep-frozen input is never mutated, and continuing from a reloaded save gives the same hashes', () => {
    for (const seed of [4, 5]) {
      const bot = randomBot(new Rng(hash32(seed, 'purity')));
      let live = engine.newRun(seed);
      let saved = engine.deserialize(engine.serialize(live))!;
      for (let n = 0; n < 2500; n++) {
        const legal = engine.legalActions(live);
        expect(engine.legalActions(saved)).toEqual(legal);
        if (legal.length === 0) break;
        const a = bot(live, legal);
        live = engine.step(deepFreeze(live), a).state;
        saved = engine.deserialize(engine.serialize(engine.step(saved, a).state))!;
        expect(engine.hash(saved), `seed ${seed} step ${n} ${JSON.stringify(a)}`).toBe(engine.hash(live));
      }
      expect(['victory', 'defeat']).toContain(live.phase.kind);
    }
  });
});
