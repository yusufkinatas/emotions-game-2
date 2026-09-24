// Micro benchmark (DESIGN 21.4 budget): enumerating legal actions and previewing each must average under
// 0.2 ms per preview for typical combat states.
import { describe, expect, it } from 'vitest';
import { combatLegalActions, previewCombat, stepCombat } from '../../src/engine/combat/index';
import { Rng } from '../../src/engine/rng';
import type { EngineCtx, GameState } from '../../src/engine/types';
import { testPack } from '../fixtures/testPack';
import { randomCombat } from '../helpers/property';

function sampleStates(n: number): { state: GameState; ctx: EngineCtx }[] {
  const out: { state: GameState; ctx: EngineCtx }[] = [];
  for (let seed = 1; out.length < n; seed++) {
    let { state, ctx } = randomCombat(testPack, seed);
    const rng = new Rng(seed);
    for (let i = 0; i < 12 && !state.combat!.outcome; i++) {
      out.push({ state, ctx });
      const legal = combatLegalActions(state, ctx);
      state = stepCombat(state, ctx, rng.pick(legal)).state;
    }
  }
  return out.slice(0, n);
}

describe('combat performance', () => {
  it('legal actions + preview of each: < 0.2 ms per preview on average', () => {
    const states = sampleStates(200);
    // warm up the JIT
    for (const { state, ctx } of states.slice(0, 50)) for (const a of combatLegalActions(state, ctx)) previewCombat(state, ctx, a);
    let previews = 0;
    const t0 = performance.now();
    for (let rep = 0; rep < 3; rep++) {
      for (const { state, ctx } of states) {
        for (const a of combatLegalActions(state, ctx)) {
          previewCombat(state, ctx, a);
          previews++;
        }
      }
    }
    const perPreview = (performance.now() - t0) / previews;
    process.stderr.write(`\ncombat preview: ${(perPreview * 1000).toFixed(1)} us per preview over ${previews} previews\n`);
    expect(perPreview).toBeLessThan(0.2);
  });
});
