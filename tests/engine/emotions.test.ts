import { describe, expect, it } from 'vitest';
import {
  BLENDS,
  LIGHTS,
  SHADES,
  adjacent,
  blendOf,
  cureOf,
  dissonantLightOf,
  dissonantShadeOf,
  harmonize,
  lethalOutcome,
  relationOf,
  type Light,
  type Shade,
} from '../../src/engine/emotions';
import { DEFAULT_RULES } from '../../src/engine/rules';

const R = DEFAULT_RULES;
const card = { fromCard: true, lightningRod: false };
const auto = { fromCard: false, lightningRod: false };
const std = (face: Shade, understood = false) => ({ rule: 'standard' as const, face, understood });

// DESIGN 4.2 chart. Row = Light, column = Shade in SHADES order. 2 = OPPOSITE, 0.5 = DISSONANT.
const CHART: Record<Light, number[]> = {
  love: [2, 0.5, 1, 1, 1, 1],
  joy: [1, 2, 0.5, 1, 1, 1],
  friendship: [1, 1, 2, 0.5, 1, 1],
  courage: [1, 1, 1, 2, 0.5, 1],
  hope: [1, 1, 1, 1, 2, 0.5],
  calm: [0.5, 1, 1, 1, 1, 2],
};

describe('type chart (R-2)', () => {
  it('matches the 6x6 table for card hits', () => {
    for (const l of LIGHTS) {
      SHADES.forEach((s, i) => {
        expect(relationOf([l], std(s), card, R).pct / 100, `${l} vs ${s}`).toBe(CHART[l][i]);
      });
    }
  });

  it('opposites are the user pairs', () => {
    expect(cureOf('anger')).toBe('love');
    expect(cureOf('sadness')).toBe('joy');
    expect(cureOf('fear')).toBe('courage');
    expect(cureOf('loneliness')).toBe('friendship');
    expect(cureOf('anxiety')).toBe('calm');
    expect(cureOf('despair')).toBe('hope');
  });

  it('clockwise dissonance is a permutation and a derangement of the opposites', () => {
    const d = LIGHTS.map((l) => dissonantShadeOf(l));
    expect(new Set(d).size).toBe(6);
    for (const l of LIGHTS) expect(dissonantShadeOf(l)).not.toBe(SHADES[LIGHTS.indexOf(l)]);
    for (const s of SHADES) expect(dissonantShadeOf(dissonantLightOf(s))).toBe(s);
  });

  it('bad advice lines: Calm vs Anger, Love vs Sadness, Joy vs Loneliness, Friendship vs Fear, Courage vs Despair, Hope vs Anxiety', () => {
    expect(dissonantLightOf('anger')).toBe('calm');
    expect(dissonantLightOf('sadness')).toBe('love');
    expect(dissonantLightOf('loneliness')).toBe('joy');
    expect(dissonantLightOf('fear')).toBe('friendship');
    expect(dissonantLightOf('despair')).toBe('courage');
    expect(dissonantLightOf('anxiety')).toBe('hope');
  });

  it('two-Light hits are never dissonant (exhaustive)', () => {
    for (const a of LIGHTS)
      for (const b of LIGHTS) {
        if (a === b) continue;
        for (const s of SHADES) expect(relationOf([a, b], std(s), card, R).relation).not.toBe('dissonant');
      }
  });

  it('automatic hits are never dissonant; Understood only for cards; Lightning Rod', () => {
    expect(relationOf(['calm'], std('anger'), auto, R)).toEqual({ relation: 'neutral', pct: 100 });
    expect(relationOf(['calm'], std('anger', true), card, R)).toEqual({ relation: 'opposite', pct: 200 });
    expect(relationOf(['calm'], std('anger', true), auto, R).relation).toBe('neutral');
    expect(relationOf(['calm'], std('anger'), { fromCard: true, lightningRod: true }, R)).toEqual({
      relation: 'dissonant',
      pct: 100,
    });
    expect(relationOf([], std('anger'), card, R).relation).toBe('neutral');
  });

  it('numb rules: FELT with two Lights, MUFFLED with fewer, Veiled 0', () => {
    expect(relationOf(['love', 'joy'], { rule: 'numb', veiled: false }, card, R)).toEqual({ relation: 'felt', pct: 200 });
    expect(relationOf(['love'], { rule: 'numb', veiled: false }, card, R)).toEqual({ relation: 'muffled', pct: 50 });
    expect(relationOf([], { rule: 'numb', veiled: false }, auto, R).relation).toBe('muffled');
    expect(relationOf(['love', 'joy'], { rule: 'numb', veiled: true }, card, R)).toEqual({ relation: 'veiled', pct: 0 });
  });
});

describe('wheel and blends (R-1)', () => {
  it('blendOf covers all 15 pairs', () => {
    let n = 0;
    for (let i = 0; i < 6; i++)
      for (let j = i + 1; j < 6; j++) {
        const b = blendOf(LIGHTS[i]!, LIGHTS[j]!);
        if (adjacent(LIGHTS[i]!, LIGHTS[j]!)) {
          n++;
          expect(b).not.toBeNull();
          expect(blendOf(LIGHTS[j]!, LIGHTS[i]!)).toBe(b);
        } else expect(b).toBeNull();
      }
    expect(n).toBe(6);
    expect(blendOf('love', 'joy')).toBe('delight');
    expect(blendOf('calm', 'love')).toBe('compassion');
    expect(blendOf('friendship', 'courage')).toBe('loyalty');
    expect(BLENDS.length).toBe(6);
  });
});

describe('harmonize (R-4)', () => {
  const on = { enabled: true, isolated: false, mirror: false };
  it('design examples 4.4.10', () => {
    expect(harmonize(['love'], ['joy'], on)).toEqual({ effective: ['joy', 'love'], harmonized: true });
    expect(harmonize(['joy'], ['joy'], on)).toEqual({ effective: ['joy'], harmonized: false });
    expect(harmonize(['love', 'joy'], ['friendship'], on)).toEqual({ effective: ['friendship', 'joy'], harmonized: true });
    expect(harmonize(['love'], ['courage'], on)).toEqual({ effective: ['courage'], harmonized: false });
  });
  it('disabled without the Compass, while Isolated, with an empty Note or printed []', () => {
    expect(harmonize(['love'], ['joy'], { ...on, enabled: false }).harmonized).toBe(false);
    expect(harmonize(['love'], ['joy'], { ...on, isolated: true }).harmonized).toBe(false);
    expect(harmonize([], ['joy'], on).harmonized).toBe(false);
    expect(harmonize(['love'], [], on).harmonized).toBe(false);
  });
  it('a Blend never gains a third Light and is not Harmonized by its own pair (minor-2)', () => {
    expect(harmonize(['love', 'joy'], ['love', 'joy'], on)).toEqual({ effective: ['love', 'joy'], harmonized: false });
    expect(harmonize(['joy'], ['love', 'joy'], on).harmonized).toBe(false);
    expect(harmonize(['calm'], ['love', 'joy'], on)).toEqual({ effective: ['love', 'joy'], harmonized: true });
  });
  it('clockwise-first pick when two Note Lights qualify', () => {
    expect(harmonize(['joy', 'calm'].sort() as Light[], ['love'], on).effective).toEqual(['love', 'joy']);
  });
  it('Mirror Shard adds across pairs', () => {
    expect(harmonize(['love'], ['courage'], { ...on, mirror: true })).toEqual({
      effective: ['courage', 'love'],
      harmonized: true,
    });
  });
});

describe('lethalOutcome (R-8)', () => {
  it('fade, resolve, deep resolve, suppress, wavering', () => {
    const o = { fromCard: true, fleeting: false, understood: false };
    expect(lethalOutcome(['love'], ['anger'], 'anger', 'opposite', { ...o, fleeting: true })).toBe('fade');
    expect(lethalOutcome(['love'], ['anger'], 'anger', 'opposite', o)).toBe('resolve');
    expect(lethalOutcome(['courage'], ['anger'], 'anger', 'neutral', o)).toBe('suppress');
    expect(lethalOutcome(['courage'], ['anger'], 'anger', 'neutral', { ...o, fromCard: false })).toBe('wavering');
    expect(lethalOutcome(['courage'], ['anger'], 'anger', 'opposite', { ...o, understood: true })).toBe('resolve');
    expect(lethalOutcome(['love', 'joy'], ['anger', 'sadness'], 'anger', 'opposite', o)).toBe('deepResolve');
    expect(lethalOutcome(['love', 'joy'], ['anger', 'sadness'], 'anger', 'opposite', { ...o, fromCard: false })).toBe(
      'resolve',
    );
  });
  it('numb rules: any FELT finishing hit Resolves (M5); non-FELT automatic leaves Wavering', () => {
    const o = { fromCard: false, fleeting: false, understood: false };
    expect(lethalOutcome(['love', 'joy'], [], null, 'felt', o)).toBe('resolve');
    expect(lethalOutcome(['love'], [], null, 'muffled', o)).toBe('wavering');
    expect(lethalOutcome(['love'], [], null, 'muffled', { ...o, fromCard: true })).toBe('suppress');
  });
});
