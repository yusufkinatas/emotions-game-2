// Map property test on 2000 seeds (DESIGN 22, minor-24). Runs with `npm run test:slow`.
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/engine/combat/index', () => import('../engine/run/fakeCombat'));

import { generateActMap } from '../../src/engine/run/map';
import { ctx } from '../engine/run/helpers';
import { mapViolations, parentRepeatRate } from '../engine/run/mapProps';

const SEEDS = 2000;

describe('map generation, 2000 seeds', () => {
  for (const [act, tutorial] of [
    [1, false],
    [2, false],
    [1, true],
  ] as const) {
    it(`act ${act}${tutorial ? ' tutorial' : ''}`, () => {
      let repeats = 0;
      let fights = 0;
      for (let seed = 1; seed <= SEEDS; seed++) {
        const map = generateActMap(ctx, seed, act, tutorial);
        const bad = mapViolations(ctx, map, { seed, act, tutorial });
        if (bad.length > 0) expect(bad, `seed ${seed}`).toEqual([]);
        const r = parentRepeatRate(map);
        repeats += r.repeats;
        fights += r.fights;
      }
      expect(repeats / fights).toBeLessThan(0.12);
    });
  }
});
