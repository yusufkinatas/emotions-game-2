// Simulator statistics and configuration helpers (DESIGN 21.2, 21.4).
import { describe, expect, it } from 'vitest';

import { expandVariants, jobList, parseScale, parseSet, parseShard, shardOf } from '../../sim/config';
import { mcnemarOneSided, median, pairedBootstrap, pairedMcNemar, quantile, wilson } from '../../sim/stats';

describe('sim statistics', () => {
  it('Wilson interval matches the textbook value for 8/10', () => {
    const w = wilson(8, 10);
    expect(w.p).toBe(0.8);
    expect(w.lo).toBeCloseTo(0.4902, 3);
    expect(w.hi).toBeCloseTo(0.9433, 3);
    expect(wilson(0, 0)).toEqual({ p: 0, lo: 0, hi: 0 });
  });

  it('one-sided McNemar exact and mid-p on discordant pairs', () => {
    const m = mcnemarOneSided(10, 2);
    expect(m.pExact).toBeCloseTo(79 / 4096, 10);
    expect(m.pMid).toBeCloseTo(46 / 4096, 10);
    expect(mcnemarOneSided(0, 0).pExact).toBe(1);
    expect(mcnemarOneSided(2, 10).pExact).toBeGreaterThan(0.99);
    const paired = pairedMcNemar([true, true, false, true], [false, true, true, false]);
    expect([paired.b10, paired.b01]).toEqual([2, 1]);
  });

  it('quantiles, median and a paired bootstrap', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(quantile([1, 2, 3, 4, 5], 0.99)).toBeCloseTo(4.96, 5);
    const a = Array.from({ length: 200 }, (_, i) => 10 + (i % 7));
    const b = a.map((x) => x - 2);
    const ci = pairedBootstrap(a, b, (xs) => xs.reduce((s, x) => s + x, 0) / xs.length, { iterations: 200 });
    expect(ci.p).toBeCloseTo(2, 10);
    expect(ci.lo).toBeCloseTo(2, 10);
    expect(ci.hi).toBeCloseTo(2, 10);
  });
});

describe('sim configuration', () => {
  it('parses --set values, sweeps and nested keys', () => {
    expect(parseSet('rules.festerTurn=10').values).toEqual([10]);
    expect(parseSet('rules.feltPct=150,200').values).toEqual([150, 200]);
    expect(parseSet('rules.glimmersResolve={"normal":8},{"normal":16}').values).toEqual([{ normal: 8 }, { normal: 16 }]);
    expect(parseSet('rules.dissonance=clockwise').values).toEqual(['clockwise']);
    const v = expandVariants([parseSet('rules.feltPct=150,200'), parseSet('rules.glimmersResolve.normal=8')]);
    expect(v.map((x) => x.rules)).toEqual([
      { feltPct: 150, glimmersResolve: { normal: 8 } },
      { feltPct: 200, glimmersResolve: { normal: 8 } },
    ]);
  });

  it('parses --scale and shards the job list evenly', () => {
    expect(parseScale('hp=1.2,strike.elite=1.1')).toEqual({ hp: 1.2, 'strike.elite': 1.1 });
    expect(parseShard('2/4')).toEqual({ k: 2, n: 4 });
    expect(() => parseShard('5/4')).toThrow();
    const jobs = jobList(['aware', 'mono-love'], 10, 4, 1);
    expect(jobs.length).toBe(14);
    const shards = [1, 2, 3, 4].map((k) => shardOf(jobs, k, 4));
    expect(shards.flat().length).toBe(14);
    expect(new Set(shards.flat().map((j) => `${j.bot}:${j.seed}`)).size).toBe(14);
  });
});
