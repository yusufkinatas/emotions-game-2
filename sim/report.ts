// Markdown + JSON balance report (DESIGN 21.3, 21.4): PASS/FAIL tables against the targets and CI gates,
// the headline bot table, paired gaps and the diagnosis tables (deaths and Heart loss per encounter).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BotSummary, Check, Metrics } from './metrics';
import type { RunRecord } from './types';

export interface ReportConfig {
  bots: string[];
  runs: Record<string, number>;
  seedStart: number;
  rules: Record<string, unknown>;
  scale: Record<string, number>;
  patch: string | null;
  strict: boolean;
  generated: string;
  wallSeconds: number;
}

const pct = (x: number, d = 1): string => (Number.isFinite(x) ? `${(x * 100).toFixed(d)}%` : 'n/a');
const n1 = (x: number | undefined, d = 1): string => (x !== undefined && Number.isFinite(x) ? x.toFixed(d) : 'n/a');

function table(head: string[], rows: string[][]): string {
  const line = (cells: string[]) => `| ${cells.map((c) => c.replace(/\|/g, '/')).join(' | ')} |`;
  return [line(head), line(head.map(() => '---')), ...rows.map(line)].join('\n');
}

function checkTable(checks: Check[]): string {
  return table(
    ['Status', 'Metric', 'Target', 'Value'],
    checks.map((c) => [c.status === 'PASS' ? 'PASS' : c.status === 'FAIL' ? '**FAIL**' : 'N/A', c.metric, c.target, c.value]),
  );
}

function botTable(bots: BotSummary[]): string {
  const hp = (b: BotSummary, t: 'normal' | 'elite' | 'boss' | 'final') => n1(b.heartPerFight[t]?.mean);
  return table(
    ['Bot', 'Runs', 'Win % [95% CI]', 'Reached Act 2 / Deep', 'Numbness won / reached', 'Heart per fight N/E/B/F', 'Median turns (normal)', 'Resolve share', 'OPP / DIS dmg', 'ms/run'],
    bots.map((b) => [
      b.bot,
      String(b.runs),
      `${pct(b.win.p)} [${pct(b.win.lo)}, ${pct(b.win.hi)}]`,
      `${pct((b.actReached['2'] + b.actReached['3']) / b.runs, 0)} / ${pct(b.actReached['3'] / b.runs, 0)}`,
      `${b.numbness.won}/${b.numbness.reached} (${pct(b.numbness.rate.p, 0)})`,
      `${hp(b, 'normal')} / ${hp(b, 'elite')} / ${hp(b, 'boss')} / ${hp(b, 'final')}`,
      n1(b.turnsNormalMedian),
      pct(b.resolveShare, 0),
      `${pct(b.dmgShare.opposite ?? 0, 0)} / ${pct(b.dmgShare.dissonant ?? 0, 0)}`,
      n1(b.msPerRun, 0),
    ]),
  );
}

function gapTable(m: Metrics): string {
  return table(
    ['A - B', 'Paired seeds', 'Win-rate gap', 'A only / B only wins', 'One-sided McNemar p (exact)', 'mid-p'],
    m.gaps.map((g) => [
      `${g.a} - ${g.b}`,
      String(g.n),
      `${g.diff >= 0 ? '+' : ''}${(g.diff * 100).toFixed(1)} pp`,
      `${g.mcnemar.b10} / ${g.mcnemar.b01}`,
      g.mcnemar.pExact < 1e-4 ? '< 0.0001' : g.mcnemar.pExact.toFixed(4),
      g.mcnemar.pMid < 1e-4 ? '< 0.0001' : g.mcnemar.pMid.toFixed(4),
    ]),
  );
}

function encounterTable(m: Metrics, names: string[]): string {
  const bots = names.map((n) => m.bots.find((b) => b.bot === n)).filter((b): b is BotSummary => !!b);
  if (bots.length === 0) return '';
  const encs = new Map<string, string>();
  for (const b of bots) for (const e of b.byEncounter) encs.set(e.encounter, e.tier);
  const rows: string[][] = [];
  for (const [enc, tier] of encs) {
    const cells = [enc, tier];
    for (const b of bots) {
      const e = b.byEncounter.find((x) => x.encounter === enc);
      cells.push(e ? `${n1(e.heartLost / e.fights)} (${n1(e.turns / e.fights)}t, ${e.fights}f, ${e.losses}L)` : '-');
    }
    rows.push(cells);
  }
  const first = bots[0]!;
  const key = (enc: string) => {
    const e = first.byEncounter.find((x) => x.encounter === enc);
    return e ? e.heartLost / e.fights : -1;
  };
  rows.sort((a, b) => key(b[0]!) - key(a[0]!));
  return table(['Encounter', 'Tier', ...bots.map((b) => `${b.bot}: Heart lost/fight (turns, fights, losses)`)], rows);
}

function deathsTable(m: Metrics, names: string[]): string {
  const bots = names.map((n) => m.bots.find((b) => b.bot === n)).filter((b): b is BotSummary => !!b);
  const encs = new Set<string>();
  for (const b of bots) for (const [e] of b.deaths) encs.add(e);
  const rows = [...encs].map((e) => [e, ...bots.map((b) => String(b.deaths.find(([x]) => x === e)?.[1] ?? 0))]);
  rows.sort((a, b) => Number(b[1]) - Number(a[1]));
  const causes = new Set<string>();
  for (const b of bots) for (const k of Object.keys(b.defeatCauses)) causes.add(k);
  for (const k of causes) rows.push([`(all losses: ${k})`, ...bots.map((b) => String(b.defeatCauses[k] ?? 0))]);
  return table(['Run ended at', ...bots.map((b) => b.bot)], rows);
}

function groupTable(title: string, b: BotSummary | undefined, key: 'byCharm' | 'byDominant'): string {
  if (!b) return '';
  const rows = Object.entries(b[key]).map(([k, r]) => [k, String(r.n), `${pct(r.p)} [${pct(r.lo)}, ${pct(r.hi)}]`]);
  return `${title}\n\n${table(['Group', 'Runs', 'Win % [95% CI]'], rows)}`;
}

function issuesSection(records: readonly RunRecord[]): string {
  const bad = records.filter((r) => r.error || r.violations.length > 0 || r.softlock);
  if (bad.length === 0) return 'No engine errors, invariant violations or softlocks.';
  return bad
    .slice(0, 30)
    .map((r) => {
      const what = r.error ?? (r.softlock ? 'softlock (action cap or no legal actions)' : r.violations.slice(0, 3).join('; '));
      return `- seed ${r.seed}, bot ${r.bot}, after ${r.actions} actions: ${what.split('\n')[0]}`;
    })
    .join('\n');
}

export function renderMarkdown(m: Metrics, cfg: ReportConfig, records: readonly RunRecord[], notes: string | null): string {
  const aware = m.bots.find((b) => b.bot === 'aware');
  const fails = m.checks.filter((c) => c.status === 'FAIL').length;
  const gateFails = m.gates.filter((c) => c.status === 'FAIL').length;
  const runs = Object.entries(cfg.runs)
    .map(([b, n]) => `${b} ${n}`)
    .join(', ');
  const rules = Object.keys(cfg.rules).length > 0 ? JSON.stringify(cfg.rules) : 'DEFAULT_RULES (no overrides)';
  const scale = Object.keys(cfg.scale).length > 0 ? JSON.stringify(cfg.scale) : 'none';
  const parts = [
    '# Heartward balance report',
    '',
    `Generated ${cfg.generated} by \`sim/cli.ts\` (DESIGN 21). Seeds start at ${cfg.seedStart}; seeds are paired across bots. Runs per bot: ${runs}. Rules: ${rules}. Content scaling: ${scale}. Content patch: ${cfg.patch ?? 'none'}. Strict invariant checks: ${cfg.strict ? 'on' : 'off'}. ${cfg.wallSeconds > 0 ? `Wall time ${cfg.wallSeconds.toFixed(0)} s.` : 'Rebuilt from saved records.'}`,
    '',
    `Summary: ${m.checks.length - fails - m.checks.filter((c) => c.status === 'N/A').length} of ${m.checks.length} 21.3 targets pass (${fails} fail); ${m.gates.length - gateFails} of ${m.gates.length} CI gates pass.`,
    '',
    '## CI gates (M14; the gate itself runs on 300 fixed seeds in `npm run test:balance`)',
    '',
    checkTable(m.gates),
    '',
    '## 21.3 targets',
    '',
    checkTable(m.checks),
    '',
    '## Bots',
    '',
    botTable(m.bots),
    '',
    'Heart per fight is the mean Heart lost per fight of that tier (N normal, E elite, B act boss, F The Numbness). OPP / DIS are the OPPOSITE and DISSONANT shares of card damage.',
    '',
    '## Paired gaps',
    '',
    gapTable(m),
    '',
  ];
  if (notes) parts.push(notes.trim(), '');
  parts.push(
    '## Where runs end',
    '',
    deathsTable(m, ['aware', 'greedyType', 'blind', 'confused', 'mono-love', 'mono-courage', 'resolveOnly']),
    '',
    '## Heart lost per encounter',
    '',
    encounterTable(m, ['aware', 'greedyType', 'blind']),
    '',
    groupTable('### aware by Charm', aware, 'byCharm'),
    '',
    groupTable('### aware by dominant deck Light (most common Light among ease cards at the end of the run)', aware, 'byDominant'),
    '',
    '## Engine issues found by the runs',
    '',
    issuesSection(records),
    '',
  );
  return parts.join('\n');
}

export function writeReport(dir: string, m: Metrics, cfg: ReportConfig, records: readonly RunRecord[], notesPath: string | null): string {
  mkdirSync(dir, { recursive: true });
  let notes: string | null = null;
  if (notesPath) {
    try {
      notes = readFileSync(notesPath, 'utf8');
    } catch {
      notes = null;
    }
  }
  const md = renderMarkdown(m, cfg, records, notes);
  writeFileSync(join(dir, 'report.md'), md);
  writeFileSync(join(dir, 'report.json'), JSON.stringify({ config: cfg, metrics: m }, null, 1));
  return md;
}
