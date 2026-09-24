// DESIGN 21.3 CI gates (M14), `npm run test:balance`: the 5 gate bots on the same 300 fixed seeds.
// A paired-gap gate passes only when its point estimate meets the floor AND a one-sided McNemar test on the
// discordant pairs gives p < 0.05. Invariants are checked after every step (--strict).
import { describe, expect, it } from 'vitest';

import { defaultPack } from '../../src/content/index';
import { createEngine } from '../../src/engine/index';
import { GATE_BOTS } from '../../sim/bots/index';
import { gapOf } from '../../sim/metrics';
import { playRun } from '../../sim/runner';
import type { RunRecord } from '../../sim/types';

const SEEDS = 300;
const SEED_START = 1;

describe(`balance gates on ${SEEDS} fixed seeds`, () => {
  const engine = createEngine(defaultPack);
  const byBot = new Map<string, RunRecord[]>();
  const runsOf = (bot: string): RunRecord[] => {
    let list = byBot.get(bot);
    if (!list) {
      list = [];
      for (let seed = SEED_START; seed < SEED_START + SEEDS; seed++) list.push(playRun(engine, seed, bot as never, { strict: true }));
      byBot.set(bot, list);
    }
    return list;
  };
  const winRate = (bot: string) => runsOf(bot).filter((r) => r.win).length / SEEDS;
  const gap = (a: string, b: string) => {
    runsOf(a);
    runsOf(b);
    const g = gapOf(byBot, a, b)!;
    process.stderr.write(`  ${a} - ${b}: ${(g.diff * 100).toFixed(1)} pp, McNemar ${g.mcnemar.b10}/${g.mcnemar.b01}, p = ${g.mcnemar.pExact.toFixed(4)}\n`);
    return g;
  };

  it('zero invariant violations, engine errors and softlocks for every gate bot', () => {
    for (const bot of GATE_BOTS) {
      const bad = runsOf(bot).filter((r) => r.error !== null || r.violations.length > 0 || r.softlock);
      expect(bad.map((r) => `${bot} seed ${r.seed}: ${r.error ?? r.violations[0] ?? 'softlock'}`)).toEqual([]);
    }
  });

  it('aware wins at least 30%', () => {
    expect(winRate('aware')).toBeGreaterThanOrEqual(0.3);
  });

  it('random wins under 5%', () => {
    expect(winRate('random')).toBeLessThan(0.05);
  });

  it('aware - blind: >= +8 pp and one-sided McNemar p < 0.05', () => {
    const g = gap('aware', 'blind');
    expect(g.diff).toBeGreaterThanOrEqual(0.08);
    expect(g.mcnemar.pExact).toBeLessThan(0.05);
  });

  it('aware - greedyType: >= +2 pp and one-sided McNemar p < 0.05', () => {
    const g = gap('aware', 'greedyType');
    expect(g.diff).toBeGreaterThanOrEqual(0.02);
    expect(g.mcnemar.pExact).toBeLessThan(0.05);
  });

  it('blind - confused: above 0 and one-sided McNemar p < 0.05', () => {
    const g = gap('blind', 'confused');
    expect(g.diff).toBeGreaterThan(0);
    expect(g.mcnemar.pExact).toBeLessThan(0.05);
  });
});
