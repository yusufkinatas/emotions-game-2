import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/engine/combat/index', () => import('./fakeCombat'));

import { fuzzRun } from './fuzzDriver';

describe('random runs with a stand-in combat, 30 seeds', () => {
  it('reach an ending with invariants, purity and save round trips holding after every step', () => {
    const endings: Record<string, number> = {};
    for (let seed = 1; seed <= 30; seed++) {
      const r = fuzzRun(seed, { freeze: true });
      const kind = r.final.phase.kind;
      expect(['victory', 'defeat'], `seed ${seed} stopped in ${kind} after ${r.steps} steps`).toContain(kind);
      endings[kind] = (endings[kind] ?? 0) + 1;
    }
    expect(endings['victory']).toBeGreaterThan(5);
  });

  it('is deterministic per seed', () => {
    for (const seed of [3, 17, 29]) expect(fuzzRun(seed).hash).toBe(fuzzRun(seed).hash);
  });
});
