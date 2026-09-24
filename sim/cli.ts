// Simulator CLI (DESIGN 21.4). `npm run sim -- --bots aware,blind --runs 300 --seed-start 1 --out sim/out`.
// --shard k/n runs a slice and writes records only (sim/parallel.ts merges); --set rules.key=value builds the
// engine with rule overrides (comma lists sweep); --scale hp=1.2 scales content in memory for experiments;
// --strict checks invariants after every step; --lab runs the fixed-deck combat benchmark instead.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { finish, loadPatch, parseCli, runJobs, variantsOf } from './cliLib';
import { buildEngine, jobList, shardOf, type Variant } from './config';
import { runLab, writeLab } from './lab';
import type { RunRecord } from './types';

async function main(): Promise<void> {
  const o = parseCli(process.argv.slice(2));
  await loadPatch(o);
  if (o.lab) {
    const variant = variantsOf(o)[0]!;
    const res = runLab(buildEngine(variant.rules, o.scale, o.patchFn), { seeds: o.labSeeds });
    writeLab(o.out, res);
    process.stdout.write(`lab: ${res.rows.length} rows written to ${join(o.out, 'lab.md')}\n`);
    return;
  }
  if (o.from) {
    const records = JSON.parse(readFileSync(o.from, 'utf8')) as RunRecord[];
    let rules: Variant['rules'] = variantsOf(o)[0]!.rules;
    let wall = 0;
    try {
      const old = (JSON.parse(readFileSync(join(dirname(o.from), 'report.json'), 'utf8')) as { config: { rules: Variant['rules']; wallSeconds: number } }).config;
      rules = old.rules;
      wall = old.wallSeconds;
    } catch {
      // No earlier report next to the records: keep the command-line rules.
    }
    finish(records, o.out, o, { label: 'base', rules }, wall);
    process.stdout.write(`report rebuilt from ${records.length} records -> ${join(o.out, 'report.md')}\n`);
    return;
  }
  const variants = variantsOf(o);
  const jobs = jobList(o.bots, o.runs, o.policyRuns, o.seedStart);
  for (const variant of variants) {
    const dir = variants.length > 1 ? join(o.out, variant.label.replace(/[^\w.=,-]/g, '_')) : o.out;
    const t0 = performance.now();
    if (o.shard) {
      const mine = shardOf(jobs, o.shard.k, o.shard.n);
      const records = runJobs(mine, variant, o);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `shard-${o.shard.k}-of-${o.shard.n}.json`), JSON.stringify(records));
      continue;
    }
    const records = runJobs(jobs, variant, o);
    finish(records, dir, o, variant, (performance.now() - t0) / 1000);
    const m = JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8')) as { metrics: { gates: { status: string }[] } };
    const gateFails = m.metrics.gates.filter((g) => g.status === 'FAIL').length;
    process.stdout.write(`${variant.label}: ${records.length} runs -> ${join(dir, 'report.md')} (${gateFails} gate failures)\n`);
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
  process.exit(1);
});
