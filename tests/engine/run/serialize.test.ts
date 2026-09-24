import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/engine/combat/index', () => import('./fakeCombat'));

import { createEngine } from '../../../src/engine/index';
import { canonicalJson } from '../../../src/engine/serialize';
import { makeFixturePack } from './fixturePack';
import { engine, freshRun, step } from './helpers';

describe('saves (20.6, 20.8)', () => {
  it('round-trips every phase of a short walk with an equal hash', () => {
    let s = freshRun(3);
    for (let n = 0; n < 20; n++) {
      const back = engine.deserialize(engine.serialize(s));
      expect(back).toEqual(s);
      expect(engine.hash(back!)).toBe(engine.hash(s));
      const legal = engine.legalActions(s);
      if (legal.length === 0) break;
      s = step(s, legal[legal.length - 1]!);
    }
  });

  it('rejects bad JSON, another version, another content build, and broken shapes', () => {
    const s = freshRun(4);
    expect(engine.deserialize('{nope')).toBeNull();
    expect(engine.deserialize(JSON.stringify({ ...s, v: 2 }))).toBeNull();
    expect(engine.deserialize(JSON.stringify({ ...s, contentHash: 'other' }))).toBeNull();
    expect(engine.deserialize(JSON.stringify({ ...s, run: null }))).toBeNull();
    expect(engine.deserialize(JSON.stringify({ ...s, combat: { turn: 1 } }))).toBeNull();
    expect(engine.deserialize('[]')).toBeNull();
    const tuned = createEngine(makeFixturePack(), { startHeart: 60 });
    expect(tuned.deserialize(engine.serialize(s))).toBeNull();
    expect(createEngine(makeFixturePack()).deserialize(engine.serialize(s))).toEqual(s);
  });

  it('the content hash covers pack ids and rules', () => {
    const a = engine.newRun(1).contentHash;
    const pack = makeFixturePack();
    delete pack.cards['neutral.pause'];
    expect(createEngine(pack).newRun(1).contentHash).not.toBe(a);
    expect(createEngine(makeFixturePack(), { havenRestPct: 40 }).newRun(1).contentHash).not.toBe(a);
  });

  it('hash is FNV-1a of canonical JSON: key order does not matter, values do', () => {
    const s = freshRun(5);
    const reverseKeys = (x: unknown): unknown =>
      Array.isArray(x)
        ? x.map(reverseKeys)
        : x && typeof x === 'object'
          ? Object.fromEntries(Object.entries(x).reverse().map(([k, v]) => [k, reverseKeys(v)]))
          : x;
    const reordered = reverseKeys(s) as typeof s;
    expect(JSON.stringify(reordered)).not.toBe(JSON.stringify(s));
    expect(engine.hash(reordered)).toBe(engine.hash(s));
    expect(engine.hash({ ...s, seed: s.seed + 1 })).not.toBe(engine.hash(s));
    expect(engine.hash(s)).toMatch(/^[0-9a-f]{8}$/);
    expect(canonicalJson({ b: 1, a: [2, { d: undefined, c: 3 }] })).toBe('{"a":[2,{"c":3}],"b":1}');
  });
});
