// Simulator smoke and perf test (DESIGN 21.4, `npm run test:slow`): 20 aware runs finish within 15 s with no
// invariant violations, engine errors or softlocks, and the same seed replays to the same record.
import { describe, expect, it } from 'vitest';

import { defaultPack } from '../../src/content/index';
import { createEngine } from '../../src/engine/index';
import { playRun } from '../../sim/runner';

describe('simulator smoke', () => {
  const engine = createEngine(defaultPack);

  it('20 aware runs finish within 15 s without invariant violations', () => {
    const t0 = performance.now();
    const records = [];
    for (let seed = 1; seed <= 20; seed++) records.push(playRun(engine, seed, 'aware', { strict: true }));
    const seconds = (performance.now() - t0) / 1000;
    process.stderr.write(`\n20 aware runs: ${seconds.toFixed(1)} s, ${records.filter((r) => r.win).length} wins\n`);
    for (const r of records) {
      expect(r.error, `seed ${r.seed}`).toBeNull();
      expect(r.violations, `seed ${r.seed}`).toEqual([]);
      expect(r.softlock, `seed ${r.seed}`).toBe(false);
      expect(r.win || r.defeat?.cause === 'heart' || r.defeat?.cause === 'turnLimit', `seed ${r.seed} ended`).toBe(true);
    }
    expect(seconds).toBeLessThan(15);
  });

  it('bots are deterministic given (seed, bot name)', () => {
    for (const bot of ['aware', 'random', 'confused'] as const) {
      const a = playRun(engine, 11, bot);
      const b = playRun(engine, 11, bot);
      expect({ ...a, ms: 0 }).toEqual({ ...b, ms: 0 });
    }
  });
});
