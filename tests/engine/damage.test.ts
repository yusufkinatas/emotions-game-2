import { describe, expect, it } from 'vitest';
import { computeGuard, computeHit, computeStrike, resolveStrikes, type HitSpec } from '../../src/engine/damage';
import { DEFAULT_RULES } from '../../src/engine/rules';

const R = DEFAULT_RULES;
const target = (over: Partial<HitSpec['target']> = {}): HitSpec['target'] => ({
  hp: 42,
  guard: 0,
  faces: ['anger'],
  faceIndex: 0,
  fleeting: false,
  understood: false,
  veiled: false,
  ...over,
});
const spec = (over: Partial<HitSpec> = {}): HitSpec => ({
  base: 6,
  fromCard: true,
  lights: ['love'],
  nerve: 0,
  heavy: false,
  lightningRod: false,
  target: target(),
  ...over,
});

describe('computeHit (DESIGN 5.4)', () => {
  it('worked example: Kind Word Harmonized Love+Joy, Nerve 1, Heavy, vs Old Grudge showing Sadness with 4 Guard', () => {
    const b = computeHit(
      spec({ base: 6, nerve: 1, heavy: true, lights: ['love', 'joy'], target: target({ faces: ['sadness', 'anger'], guard: 4 }) }),
      R,
    );
    expect(b.damage).toBe(10);
    expect(b.blocked).toBe(4);
    expect(b.hpLoss).toBe(6);
    expect(b.relation).toBe('opposite');
  });

  it('min 1 damage when base > 0 and type > 0', () => {
    expect(computeHit(spec({ base: 1, lights: ['calm'] }), R).damage).toBe(1);
    expect(computeHit(spec({ base: 0 }), R).damage).toBe(0);
  });

  it('Veiled numb target takes 0', () => {
    const b = computeHit(spec({ lights: ['love', 'joy'], target: target({ faces: [], veiled: true }) }), R);
    expect(b.damage).toBe(0);
    expect(b.relation).toBe('veiled');
  });

  it('automatic hits ignore Nerve and Heavy and are never dissonant', () => {
    const b = computeHit(spec({ base: 6, fromCard: false, nerve: 3, heavy: true, lights: ['calm'] }), R);
    expect(b.damage).toBe(6);
    expect(b.relation).toBe('neutral');
  });

  it('lethal outcomes and Wavering sets 1', () => {
    expect(computeHit(spec({ base: 30, target: target({ hp: 10 }) }), R).outcome).toBe('resolve');
    expect(computeHit(spec({ base: 30, lights: ['courage'], target: target({ hp: 10 }) }), R).outcome).toBe('suppress');
    const w = computeHit(spec({ base: 30, fromCard: false, lights: ['courage'], target: target({ hp: 10 }) }), R);
    expect(w.outcome).toBe('wavering');
    expect(w.hpAfter).toBe(1);
  });
});

describe('guard and strikes (5.5)', () => {
  it('Trembling applies to card Guard only', () => {
    expect(computeGuard(8, { fromCard: true, trembling: true }, R)).toBe(6);
    expect(computeGuard(8, { fromCard: false, trembling: true }, R)).toBe(8);
  });
  it('strike = base + Flare - Hush, min 0; multi-strike vs Guard', () => {
    expect(computeStrike(7, 1, 0)).toBe(8);
    expect(computeStrike(4, 0, 6)).toBe(0);
    expect(resolveStrikes(3, 3, 5, 20)).toEqual({ blocked: 5, hpLoss: 4, guardAfter: 0, hpAfter: 16 });
  });
});
