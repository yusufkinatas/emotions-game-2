// Whole-run random walks on 500 seeds with the stand-in combat (npm run test:slow).
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/engine/combat/index', () => import('../engine/run/fakeCombat'));

import { fuzzRun } from '../engine/run/fuzzDriver';

describe('random runs, 500 seeds', () => {
  it('always reach victory or defeat with invariants holding', () => {
    let victories = 0;
    for (let seed = 1; seed <= 500; seed++) {
      const r = fuzzRun(seed);
      expect(['victory', 'defeat'], `seed ${seed}`).toContain(r.final.phase.kind);
      if (r.final.phase.kind === 'victory') victories += 1;
    }
    expect(victories).toBeGreaterThan(100);
  });
});
