// Slow suite (vitest.slow.config.ts): preview == step on 300 random-bot seeds, determinism on 50 seeds.
import { describe, expect, it } from 'vitest';
import { miniPack } from '../fixtures/miniPack';
import { testPack } from '../fixtures/testPack';
import { playRandomCombat } from '../helpers/property';

describe('combat preview == step (300 seeds)', () => {
  for (const [name, pack] of [['miniPack', miniPack], ['testPack', testPack]] as const) {
    it(`${name}`, () => {
      let certain = 0;
      for (let seed = 1000; seed < 1300; seed++) {
        const r = playRandomCombat(pack, seed, { maxSteps: 300 });
        expect(r.mismatches, `seed ${seed}`).toEqual([]);
        certain += r.certain;
      }
      expect(certain).toBeGreaterThan(5000);
    });
  }
});

describe('combat determinism (50 seeds)', () => {
  it('same seed + same actions => same hash after every step', () => {
    for (let seed = 5000; seed < 5050; seed++) {
      const a = playRandomCombat(testPack, seed, { checkPreviews: false, maxSteps: 300 });
      const b = playRandomCombat(testPack, seed, { checkPreviews: false, maxSteps: 300 });
      expect(b.hashes).toEqual(a.hashes);
    }
  });
});
