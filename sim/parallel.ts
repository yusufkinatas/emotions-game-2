// Parallel simulator (DESIGN 21.4): spawns 4 children of `npx vite-node sim/cli.ts --shard k/4 ...`, waits,
// merges their records and writes one report per variant. Usage: npx vite-node sim/parallel.ts -- <cli args>
// (--jobs N changes the child count).

import { spawn } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { finish, parseCli, variantsOf } from './cliLib';
import type { RunRecord } from './types';

function stripFlag(args: string[], name: string, takesValue: boolean): { args: string[]; value: string | null } {
  const out: string[] = [];
  let value: string | null = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === name) {
      if (takesValue) value = args[++i] ?? null;
      else value = 'true';
      continue;
    }
    if (a.startsWith(`${name}=`)) {
      value = a.slice(name.length + 1);
      continue;
    }
    out.push(a);
  }
  return { args: out, value };
}

function runChild(args: string[], label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['vite-node', 'sim/cli.ts', '--', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${label} exited with ${code}`))));
  });
}

async function main(): Promise<void> {
  let argv = process.argv.slice(2).filter((a) => a !== '--');
  const jobsFlag = stripFlag(argv, '--jobs', true);
  argv = jobsFlag.args;
  const n = Number(jobsFlag.value ?? 4);
  const o = parseCli(argv);
  if (o.shard) throw new Error('parallel.ts shards by itself; drop --shard');
  // Children get one variant each and their own output dir; the parent writes the report and the copy.
  let rest = argv;
  for (const flag of ['--set', '--out', '--copy-to', '--notes']) rest = stripFlag(rest, flag, true).args;
  const variants = variantsOf(o);
  for (const variant of variants) {
    const dir = variants.length > 1 ? join(o.out, variant.label.replace(/[^\w.=,-]/g, '_')) : o.out;
    const sets = flatten(variant.rules).flatMap(([k, v]) => ['--set', `rules.${k}=${JSON.stringify(v)}`]);
    const t0 = performance.now();
    const children: Promise<void>[] = [];
    for (let k = 1; k <= n; k++) {
      children.push(runChild([...rest, ...sets, '--out', dir, '--shard', `${k}/${n}`, '--quiet'], `shard ${k}/${n}`));
    }
    await Promise.all(children);
    const records: RunRecord[] = [];
    for (let k = 1; k <= n; k++) {
      const file = join(dir, `shard-${k}-of-${n}.json`);
      records.push(...(JSON.parse(readFileSync(file, 'utf8')) as RunRecord[]));
      rmSync(file);
    }
    records.sort((a, b) => (a.bot === b.bot ? a.seed - b.seed : a.bot < b.bot ? -1 : 1));
    finish(records, dir, o, variant, (performance.now() - t0) / 1000);
    process.stdout.write(`${variant.label}: ${records.length} runs merged -> ${join(dir, 'report.md')}\n`);
  }
}

function flatten(obj: Record<string, unknown>, prefix = ''): [string, unknown][] {
  const out: [string, unknown][] = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...flatten(v as Record<string, unknown>, key));
    else out.push([key, v]);
  }
  return out;
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
