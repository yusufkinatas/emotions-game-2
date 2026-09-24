// Random walks through whole runs with the fake combat (random outcomes, Heart loss and deck mutations).
// Checks invariants after every step. Used by the 30-seed test and the slow fuzz.

import { hash32, Rng } from '../../../src/engine/rng';
import { SHADES } from '../../../src/engine/emotions';
import type { CombatResult, DeckMutation, GameState } from '../../../src/engine/types';
import { fake } from './fakeCombat';
import { ctx, deepFreeze, engine } from './helpers';

function randomResult(s: GameState, rng: Rng): Partial<CombatResult> {
  const c = s.combat!;
  const lost = rng.float() < 0.03;
  const mutations: DeckMutation[] = [];
  const made = new Set(s.run.insightsMade);
  const buried = s.run.deck.filter((x) => ctx.pack.cards[x.defId]!.kind === 'buried');
  for (let n = rng.int(0, 3); n > 0; n--) {
    const roll = rng.float();
    if (roll < 0.5 || buried.length === 0) {
      mutations.push({ k: 'suppress', shade: rng.pick(SHADES) });
      continue;
    }
    const b = rng.pick(buried);
    const insight = ctx.pack.cards[b.defId]!.buried!.insight;
    if (roll < 0.75) mutations.push({ k: 'tend', uid: b.uid });
    else if (roll < 0.9) {
      // What the combat engine does on a Surfaced Resolve (B3: release if already made).
      if (made.has(insight)) mutations.push({ k: 'remove', uid: b.uid });
      else mutations.push({ k: 'transform', uid: b.uid, to: insight, upgraded: rng.float() < 0.5 });
      made.add(insight);
      buried.splice(buried.indexOf(b), 1);
    } else mutations.push({ k: 'returnSurfaced', uid: b.uid });
  }
  const allResolved = rng.float() < 0.5;
  return {
    outcome: lost ? 'lost' : 'won',
    heartAfter: lost ? 0 : Math.max(1, s.run.heart - rng.int(0, 18)),
    mutations,
    allResolved,
    gone: c.enemies.map((e) => ({
      uid: e.uid,
      defId: e.defId,
      outcome: allResolved || rng.float() < 0.5 ? 'resolve' : 'suppress',
      face: e.faces[0] ?? null,
    })),
  };
}

export interface FuzzOutcome {
  steps: number;
  final: GameState;
  hash: string;
}

export function fuzzRun(seed: number, o: { maxSteps?: number; freeze?: boolean } = {}): FuzzOutcome {
  const rng = new Rng(hash32(seed, 'fuzz'));
  fake.reset();
  fake.result = (s) => randomResult(s, rng);
  let s = engine.newRun(seed, rng.float() < 0.2 ? { tutorial: true } : {});
  let steps = 0;
  const max = o.maxSteps ?? 3000;
  for (; steps < max; steps++) {
    const legal = engine.legalActions(s);
    if (legal.length === 0) break;
    // Leave shops and skip optional choices sometimes so walks keep moving.
    const a = rng.pick(legal);
    if (o.freeze) deepFreeze(s);
    const next = engine.step(s, a).state;
    const bad = engine.checkInvariants(next);
    if (bad.length > 0) throw new Error(`seed ${seed} step ${steps} ${JSON.stringify(a)} in ${s.phase.kind}: ${bad.join('; ')}`);
    const back = engine.deserialize(engine.serialize(next));
    if (!back || engine.hash(back) !== engine.hash(next)) throw new Error(`seed ${seed} step ${steps}: save round trip changed the state`);
    s = next;
  }
  return { steps, final: s, hash: engine.hash(s) };
}
