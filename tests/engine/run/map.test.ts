import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/engine/combat/index', () => import('./fakeCombat'));

import { Rng } from '../../../src/engine/rng';
import { staircaseEdges } from '../../../src/engine/run/edges';
import { generateActMap, generateDeepMap, reachableNodes } from '../../../src/engine/run/map';
import { ctx } from './helpers';
import { mapViolations, parentRepeatRate } from './mapProps';

const SEEDS = Array.from({ length: 30 }, (_, i) => i * 7919 + 1);

describe('staircase edges (11.2)', () => {
  for (const [a, b] of [
    [3, 3],
    [3, 4],
    [4, 3],
    [4, 4],
  ] as const) {
    it(`${a} -> ${b}: monotone path from (0,0) to (${a - 1},${b - 1}), no crossings, degrees 1-2`, () => {
      for (let seed = 1; seed <= 200; seed++) {
        const pairs = staircaseEdges(a, b, new Rng(seed));
        expect(pairs[0]).toEqual([0, 0]);
        expect(pairs[pairs.length - 1]).toEqual([a - 1, b - 1]);
        for (let i = 1; i < pairs.length; i++) {
          const [i0, j0] = pairs[i - 1]!;
          const [i1, j1] = pairs[i]!;
          expect(i1 - i0 + (j1 - j0)).toBeGreaterThanOrEqual(1);
          expect(i1 - i0).toBeLessThanOrEqual(1);
          expect(j1 - j0).toBeLessThanOrEqual(1);
        }
        for (let i = 0; i < a; i++) {
          const d = pairs.filter((p) => p[0] === i).length;
          expect(d).toBeGreaterThanOrEqual(1);
          expect(d).toBeLessThanOrEqual(2);
        }
        for (let j = 0; j < b; j++) {
          const d = pairs.filter((p) => p[1] === j).length;
          expect(d).toBeGreaterThanOrEqual(1);
          expect(d).toBeLessThanOrEqual(2);
        }
      }
    });
  }

  it('a row of one (the boss) joins every node', () => {
    expect(staircaseEdges(4, 1, new Rng(5))).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ]);
  });
});

describe('act maps (11.1, 11.3, 8), 30 seeds', () => {
  for (const [act, tutorial] of [
    [1, false],
    [2, false],
    [1, true],
  ] as const) {
    it(`act ${act}${tutorial ? ' tutorial' : ''}: shape, edges, kinds, repair, encounters`, () => {
      let repeats = 0;
      let fights = 0;
      for (const seed of SEEDS) {
        const map = generateActMap(ctx, seed, act, tutorial);
        expect(mapViolations(ctx, map, { seed, act, tutorial }), `seed ${seed}`).toEqual([]);
        const r = parentRepeatRate(map);
        repeats += r.repeats;
        fights += r.fights;
      }
      // A parent's encounter repeats only after 5 failed rerolls (minor-10), so it is rare.
      expect(repeats / Math.max(1, fights)).toBeLessThan(0.2);
    });
  }

  it('is deterministic per seed and act, and differs between acts', () => {
    const a = generateActMap(ctx, 42, 1, false);
    expect(generateActMap(ctx, 42, 1, false)).toEqual(a);
    expect(generateActMap(ctx, 42, 2, false)).not.toEqual(a);
  });

  it('tutorial rows 1 to 4 use enc.t1 to enc.t4 with their HP overrides', () => {
    const map = generateActMap(ctx, 3, 1, true);
    for (let r = 1; r <= 4; r++) {
      for (const n of map.nodes.filter((x) => x.row === r)) expect(n.encounter!.id).toBe(`enc.t${r}`);
    }
    for (const n of map.nodes.filter((x) => x.row === 4)) {
      expect(n.encounter!.hps[0]).toBe(24);
      expect(n.encounter!.hps[1]).toBeGreaterThanOrEqual(28);
      expect(n.encounter!.hps[1]).toBeLessThanOrEqual(30);
    }
  });

  it('Act 2 row 3 fights draw only from the lone compounds', () => {
    for (const seed of SEEDS) {
      const map = generateActMap(ctx, seed, 2, false);
      for (const n of map.nodes.filter((x) => x.row === 3 && x.kind === 'fight')) {
        expect(['enc.a2.old_grudge', 'enc.a2.longing', 'enc.a2.dread']).toContain(n.encounter!.id);
      }
    }
  });
});

describe('The Deep (3.1)', () => {
  it('is a fixed line: Sanctuary -> Haven -> The Numbness', () => {
    const map = generateDeepMap(ctx, 9);
    expect(map.act).toBe(3);
    expect(map.nodes.map((n) => n.kind)).toEqual(['sanctuary', 'haven', 'boss']);
    expect(map.nodes.map((n) => n.next)).toEqual([[1], [2], []]);
    expect(map.nodes[2]!.encounter).toEqual({ id: 'enc.deep.numbness', hps: [180] });
    expect(reachableNodes(map)).toEqual([0]);
  });
});

describe('reachableNodes', () => {
  it('is row 1 before the first move, then the current node children', () => {
    const map = generateActMap(ctx, 11, 1, false);
    expect(reachableNodes(map)).toEqual([0, 1, 2]);
    const moved = { ...map, current: 1 };
    expect(reachableNodes(moved)).toEqual([...map.nodes[1]!.next].sort((a, b) => a - b));
  });
});
