// Shared pieces of the simulator CLI (sim/cli.ts) and sim/parallel.ts: argument parsing, running jobs,
// writing records, the report and issues.md.

import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { ALL_BOTS, GATE_BOTS, isBotName, type BotName } from './bots/index';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { buildEngine, expandVariants, parseScale, parseSet, parseShard, type Job, type PackPatch, type Scale, type Variant } from './config';
import { computeMetrics } from './metrics';
import { writeReport, type ReportConfig } from './report';
import { playRun } from './runner';
import type { RunRecord } from './types';

export interface CliOptions {
  bots: BotName[];
  runs: number;
  policyRuns: number;
  seedStart: number;
  shard: { k: number; n: number } | null;
  sets: string[];
  scale: Scale;
  /** --patch file.ts: a module exporting `patch(pack)` for content experiments (loaded by loadPatch). */
  patch: string | null;
  patchFn: PackPatch | null;
  out: string;
  strict: boolean;
  lab: boolean;
  labSeeds: number;
  notes: string | null;
  copyTo: string | null;
  /** Rebuild the report from a saved records.json instead of running. */
  from: string | null;
  quiet: boolean;
}

export function parseCli(argv: string[]): CliOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      bots: { type: 'string' },
      runs: { type: 'string' },
      'policy-runs': { type: 'string' },
      'seed-start': { type: 'string' },
      shard: { type: 'string' },
      set: { type: 'string', multiple: true },
      scale: { type: 'string' },
      patch: { type: 'string' },
      out: { type: 'string' },
      strict: { type: 'boolean' },
      lab: { type: 'boolean' },
      'lab-seeds': { type: 'string' },
      notes: { type: 'string' },
      'copy-to': { type: 'string' },
      from: { type: 'string' },
      quiet: { type: 'boolean' },
    },
    allowPositionals: true,
    strict: true,
  });
  const botList = values.bots === 'all' ? [...ALL_BOTS] : (values.bots ?? GATE_BOTS.join(',')).split(',').map((b) => b.trim()).filter(Boolean);
  for (const b of botList) if (!isBotName(b)) throw new Error(`Unknown bot "${b}". Bots: ${ALL_BOTS.join(', ')}`);
  const runs = Number(values.runs ?? 100);
  return {
    bots: botList as BotName[],
    runs,
    policyRuns: Number(values['policy-runs'] ?? runs),
    seedStart: Number(values['seed-start'] ?? 1),
    shard: parseShard(values.shard),
    sets: values.set ?? [],
    scale: parseScale(values.scale),
    patch: values.patch ?? null,
    patchFn: null,
    out: values.out ?? 'sim/out',
    strict: values.strict ?? false,
    lab: values.lab ?? false,
    labSeeds: Number(values['lab-seeds'] ?? 20),
    notes: values.notes ?? null,
    copyTo: values['copy-to'] ?? null,
    from: values.from ?? null,
    quiet: values.quiet ?? false,
  };
}

/** Run a list of jobs on one engine, with progress on stderr. */
/** Loads the --patch module (its `patch` or default export). */
export async function loadPatch(o: CliOptions): Promise<void> {
  if (!o.patch) return;
  const mod = (await import(pathToFileURL(resolve(o.patch)).href)) as { patch?: PackPatch; default?: PackPatch };
  o.patchFn = mod.patch ?? mod.default ?? null;
  if (!o.patchFn) throw new Error(`${o.patch} exports no patch function`);
}

export function runJobs(jobs: readonly Job[], variant: Variant, o: Pick<CliOptions, 'scale' | 'strict' | 'quiet' | 'patchFn'>): RunRecord[] {
  const engine = buildEngine(variant.rules, o.scale, o.patchFn);
  const out: RunRecord[] = [];
  const t0 = performance.now();
  jobs.forEach((j, i) => {
    out.push(playRun(engine, j.seed, j.bot, { strict: o.strict, probe: j.bot === 'aware' }));
    if (!o.quiet && (i + 1) % 50 === 0) {
      const s = (performance.now() - t0) / 1000;
      process.stderr.write(`[sim ${variant.label}] ${i + 1}/${jobs.length} runs, ${s.toFixed(0)} s\n`);
    }
  });
  return out;
}

export function runsPerBot(records: readonly RunRecord[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of records) out[r.bot] = (out[r.bot] ?? 0) + 1;
  return out;
}

/** Report + JSON for a finished set of records (also used by parallel.ts after merging shards). */
export function finish(records: RunRecord[], dir: string, o: CliOptions, variant: Variant, wallSeconds: number): string {
  const cfg: ReportConfig = {
    bots: [...new Set(records.map((r) => r.bot))],
    runs: runsPerBot(records),
    seedStart: o.seedStart,
    rules: variant.rules,
    scale: o.scale,
    patch: o.patch,
    strict: o.strict,
    generated: new Date().toISOString(),
    wallSeconds,
  };
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'records.json'), JSON.stringify(records));
  const md = writeReport(dir, computeMetrics(records), cfg, records, o.notes);
  writeIssues(dir, records);
  if (o.copyTo) copyFileSync(join(dir, 'report.md'), o.copyTo);
  return md;
}

/** sim/out/issues.md: every error, violation and softlock with its seed, bot and replay. */
export function writeIssues(dir: string, records: readonly RunRecord[]): void {
  const bad = records.filter((r) => r.error || r.violations.length > 0 || r.softlock);
  const lines = ['# Simulator issues', ''];
  if (bad.length === 0) lines.push('None: no engine errors, invariant violations or softlocks in these runs.');
  for (const r of bad) {
    lines.push(`## seed ${r.seed}, bot ${r.bot}`, '');
    if (r.error) lines.push('```', r.error, '```');
    if (r.softlock) lines.push('Softlock: the action cap was reached or no legal action existed outside victory/defeat.');
    for (const v of r.violations) lines.push(`- ${v}`);
    if (r.replay) lines.push('', `Replay (${r.replay.length} actions, createEngine(defaultPack) + newRun(${r.seed})):`, '', '```json', JSON.stringify(r.replay), '```');
    lines.push('');
  }
  writeFileSync(join(dir, 'issues.md'), lines.join('\n'));
}

export function variantsOf(o: CliOptions): Variant[] {
  return expandVariants(o.sets.map(parseSet));
}
