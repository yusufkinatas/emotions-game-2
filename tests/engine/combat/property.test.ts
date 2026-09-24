// Property tests (DESIGN 22), 30 seeds: preview == step for every deterministic legal play, purity,
// determinism, and structural invariants after every step.
import { describe, expect, it } from 'vitest';
import { combatLegalActions, stepCombat } from '../../../src/engine/combat/index';
import type { EngineCtx, GameState } from '../../../src/engine/types';
import { miniPack } from '../../fixtures/miniPack';
import { testPack } from '../../fixtures/testPack';
import { deepFreeze, playRandomCombat, randomCombat } from '../../helpers/property';

const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);

function invariants(s: GameState, ctx: EngineCtx): string[] {
  const c = s.combat!;
  const out: string[] = [];
  const all = Object.values(c.piles).flat();
  const uids = Object.keys(c.cards).map(Number);
  if (all.length !== new Set(all).size) out.push('a card is in two piles');
  if (all.length !== uids.length || uids.some((u) => !all.includes(u))) out.push('piles do not partition cards');
  if (c.player.hp > c.player.maxHp) out.push('player hp > max');
  for (const e of c.enemies) {
    if (e.hp > e.maxHp) out.push(`enemy ${e.uid} hp > max`);
    if (e.hp <= 0) out.push(`enemy ${e.uid} at 0 on the field`);
    for (const [k, v] of Object.entries(e.statuses)) if ((v ?? 0) < 0) out.push(`negative ${k}`);
  }
  for (const [k, v] of Object.entries(c.player.statuses)) if ((v ?? 0) <= 0) out.push(`non-positive player ${k}`);
  if (c.enemies.length > 4) out.push('more than 4 Shades');
  if (c.companions.length > 3) out.push('more than 3 Companions');
  if (!c.outcome && combatLegalActions(s, ctx).length === 0) out.push('no legal actions');
  return out;
}

describe('preview == step (30 seeds)', () => {
  for (const [name, pack] of [['miniPack', miniPack], ['testPack', testPack]] as const) {
    it(`${name}: every certain preview matches the real step`, () => {
      let certain = 0;
      for (const seed of SEEDS) {
        const r = playRandomCombat(pack, seed);
        expect(r.mismatches, `seed ${seed}`).toEqual([]);
        certain += r.certain;
      }
      expect(certain).toBeGreaterThan(500);
    });
  }
});

describe('purity and determinism', () => {
  it('step, legalActions and previews never mutate a deep-frozen input', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      let { state, ctx } = randomCombat(testPack, seed);
      for (let i = 0; i < 40 && !state.combat!.outcome; i++) {
        const frozen = deepFreeze(state);
        const legal = combatLegalActions(frozen, ctx);
        const a = legal[(seed + i) % legal.length]!;
        state = stepCombat(frozen, ctx, a).state;
      }
    }
  });

  it('same seed + same actions => same state hash', () => {
    for (const seed of SEEDS) {
      const a = playRandomCombat(testPack, seed, { checkPreviews: false });
      const b = playRandomCombat(testPack, seed, { checkPreviews: false });
      expect(b.hashes).toEqual(a.hashes);
      expect(JSON.stringify(b.final)).toBe(JSON.stringify(a.final));
    }
  });

  it('structural invariants hold after every step; states survive a JSON round trip', () => {
    for (const seed of SEEDS) {
      let { state, ctx } = randomCombat(testPack, seed);
      expect(invariants(state, ctx), `seed ${seed} start`).toEqual([]);
      for (let i = 0; i < 150 && !state.combat!.outcome; i++) {
        const legal = combatLegalActions(state, ctx);
        const a = legal[(seed * 7 + i * 3) % legal.length]!;
        const next = stepCombat(state, ctx, a).state;
        const viaJson = stepCombat(JSON.parse(JSON.stringify(state)) as GameState, ctx, a).state;
        expect(JSON.stringify(viaJson)).toBe(JSON.stringify(next));
        state = next;
        expect(invariants(state, ctx), `seed ${seed} step ${i}`).toEqual([]);
      }
    }
  });
});
