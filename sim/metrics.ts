// Every DESIGN 21.3 metric from run records, with targets and the CI-gate rows (M14).

import type { Relation } from '../src/engine/index';
import { mean, median, pairedBootstrap, pairedMcNemar, quantile, wilson, type Interval, type McNemar } from './stats';
import type { RunRecord, Tier } from './types';

export type Status = 'PASS' | 'FAIL' | 'N/A';

export interface EncounterStat {
  encounter: string;
  tier: Tier;
  fights: number;
  losses: number;
  heartLost: number;
  turns: number;
}

export interface BotSummary {
  bot: string;
  runs: number;
  wins: number;
  win: Interval;
  meanFloors: number;
  actReached: Record<'1' | '2' | '3', number>;
  numbness: { reached: number; won: number; rate: Interval };
  heartPerFight: Partial<Record<Tier, { fights: number; mean: number }>>;
  turnsNormalMedian: number;
  turnsP99: number;
  maxCardsPerTurn: number;
  dmgShare: Partial<Record<Relation, number>>;
  resolveShare: number;
  namedKills: number;
  harmonizedShare: number;
  tendsMedian: number;
  buriedAtDeepMedian: number;
  endings: { resolved: number; suppressed: number };
  errors: number;
  violations: number;
  softlocks: number;
  deaths: [string, number][];
  /** Why lost runs ended: heart, turnLimit (the 40-turn stalemate), error, softlock. */
  defeatCauses: Record<string, number>;
  byEncounter: EncounterStat[];
  byCharm: Record<string, Interval & { n: number }>;
  byDominant: Record<string, Interval & { n: number }>;
  probe: { combat: number; divergence: number; typeFlip: number; reward: number; rewardDivergence: number; rewardTypeFlip: number } | null;
  msPerRun: number;
}

export interface Gap {
  a: string;
  b: string;
  n: number;
  /** Paired win-rate difference a - b (fraction). */
  diff: number;
  mcnemar: McNemar;
}

export interface Check {
  id: string;
  metric: string;
  target: string;
  value: string;
  status: Status;
}

export interface Metrics {
  bots: BotSummary[];
  gaps: Gap[];
  checks: Check[];
  gates: Check[];
  heartRatios: { tier: Tier; ratio: Interval; blind: number; aware: number }[];
}

const pct = (x: number, digits = 1): string => (Number.isFinite(x) ? `${(x * 100).toFixed(digits)}%` : 'n/a');
const pp = (x: number): string => (Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)} pp` : 'n/a');
const num = (x: number, digits = 2): string => (Number.isFinite(x) ? x.toFixed(digits) : 'n/a');

function groupByBot(records: readonly RunRecord[]): Map<string, RunRecord[]> {
  const out = new Map<string, RunRecord[]>();
  for (const r of records) {
    const list = out.get(r.bot) ?? [];
    list.push(r);
    out.set(r.bot, list);
  }
  for (const list of out.values()) list.sort((x, y) => x.seed - y.seed);
  return out;
}

function rateBy(runs: readonly RunRecord[], key: (r: RunRecord) => string | null): Record<string, Interval & { n: number }> {
  const acc = new Map<string, { k: number; n: number }>();
  for (const r of runs) {
    const k = key(r);
    if (k === null) continue;
    const a = acc.get(k) ?? { k: 0, n: 0 };
    a.n += 1;
    if (r.win) a.k += 1;
    acc.set(k, a);
  }
  const out: Record<string, Interval & { n: number }> = {};
  for (const [k, a] of [...acc.entries()].sort()) out[k] = { ...wilson(a.k, a.n), n: a.n };
  return out;
}

function summarize(bot: string, runs: RunRecord[]): BotSummary {
  const wins = runs.filter((r) => r.win).length;
  const acts = { '1': 0, '2': 0, '3': 0 } as Record<'1' | '2' | '3', number>;
  for (const r of runs) acts[String(Math.min(3, r.actReached)) as '1' | '2' | '3'] += 1;
  const reached = runs.filter((r) => r.reachedNumbness);
  const numbWon = reached.filter((r) => r.numbnessWon).length;

  const fights = runs.flatMap((r) => r.combats);
  const heartPerFight: BotSummary['heartPerFight'] = {};
  for (const tier of ['normal', 'elite', 'boss', 'final', 'event'] as Tier[]) {
    const fs = fights.filter((f) => f.tier === tier);
    if (fs.length > 0) heartPerFight[tier] = { fights: fs.length, mean: mean(fs.map((f) => f.heartLost)) };
  }
  const normalTurns = fights.filter((f) => f.tier === 'normal').map((f) => f.turns);

  const dmg: Partial<Record<Relation, number>> = {};
  let dmgTotal = 0;
  for (const r of runs) {
    for (const [k, v] of Object.entries(r.dmg)) {
      dmg[k as Relation] = (dmg[k as Relation] ?? 0) + (v ?? 0);
      dmgTotal += v ?? 0;
    }
  }
  const dmgShare: Partial<Record<Relation, number>> = {};
  for (const [k, v] of Object.entries(dmg)) dmgShare[k as Relation] = dmgTotal > 0 ? (v ?? 0) / dmgTotal : 0;

  let resolved = 0;
  let named = 0;
  let harm = 0;
  let afterCompass = 0;
  for (const r of runs) {
    resolved += r.resolves + r.deepResolves;
    named += r.resolves + r.deepResolves + r.suppresses;
    harm += r.harmonizedAfterCompass;
    afterCompass += r.cardsAfterCompass;
  }

  const deathsMap = new Map<string, number>();
  for (const r of runs) {
    if (r.win) continue;
    const k = r.defeat?.encounter ?? r.defeat?.cause ?? 'unknown';
    deathsMap.set(k, (deathsMap.get(k) ?? 0) + 1);
  }

  const defeatCauses: Record<string, number> = {};
  for (const r of runs) if (!r.win) defeatCauses[r.defeat?.cause ?? 'unknown'] = (defeatCauses[r.defeat?.cause ?? 'unknown'] ?? 0) + 1;

  const enc = new Map<string, EncounterStat>();
  for (const f of fights) {
    const e = enc.get(f.encounter) ?? { encounter: f.encounter, tier: f.tier, fights: 0, losses: 0, heartLost: 0, turns: 0 };
    e.fights += 1;
    if (!f.won) e.losses += 1;
    e.heartLost += f.heartLost;
    e.turns += f.turns;
    enc.set(f.encounter, e);
  }

  const probes = runs.map((r) => r.probe).filter((p) => p !== null);
  let probe: BotSummary['probe'] = null;
  if (probes.length > 0) {
    const sum = (f: (p: NonNullable<RunRecord['probe']>) => number) => probes.reduce((a, p) => a + f(p), 0);
    const n = sum((p) => p.combat.n);
    const rn = sum((p) => p.reward.n);
    probe = {
      combat: n,
      divergence: n > 0 ? sum((p) => p.combat.diffGreedy) / n : Number.NaN,
      typeFlip: n > 0 ? sum((p) => p.combat.diffBlind) / n : Number.NaN,
      reward: rn,
      rewardDivergence: rn > 0 ? sum((p) => p.reward.diffGreedy) / rn : Number.NaN,
      rewardTypeFlip: rn > 0 ? sum((p) => p.reward.diffBlind) / rn : Number.NaN,
    };
  }

  const buriedAtDeep = runs.map((r) => r.buriedWeightAtDeep).filter((x): x is number => x !== null);
  return {
    bot,
    runs: runs.length,
    wins,
    win: wilson(wins, runs.length),
    meanFloors: mean(runs.map((r) => r.floors)),
    actReached: acts,
    numbness: { reached: reached.length, won: numbWon, rate: wilson(numbWon, reached.length) },
    heartPerFight,
    turnsNormalMedian: median(normalTurns),
    turnsP99: quantile(
      fights.map((f) => f.turns),
      0.99,
    ),
    maxCardsPerTurn: Math.max(0, ...runs.map((r) => r.maxCardsPerTurn)),
    dmgShare,
    resolveShare: named > 0 ? resolved / named : Number.NaN,
    namedKills: named,
    harmonizedShare: afterCompass > 0 ? harm / afterCompass : Number.NaN,
    tendsMedian: median(runs.map((r) => r.tends)),
    buriedAtDeepMedian: median(buriedAtDeep),
    endings: {
      resolved: runs.filter((r) => r.ending === 'resolved').length,
      suppressed: runs.filter((r) => r.ending === 'suppressed').length,
    },
    errors: runs.filter((r) => r.error !== null).length,
    violations: runs.filter((r) => r.violations.length > 0).length,
    softlocks: runs.filter((r) => r.softlock).length,
    deaths: [...deathsMap.entries()].sort((x, y) => y[1] - x[1]),
    defeatCauses,
    byEncounter: [...enc.values()].sort((x, y) => y.heartLost / y.fights - x.heartLost / x.fights),
    byCharm: rateBy(runs, (r) => r.charm),
    byDominant: rateBy(runs, (r) => r.deck.dominant),
    probe,
    msPerRun: mean(runs.map((r) => r.ms)),
  };
}

/** Paired win-rate gap on the seeds both bots ran. */
export function gapOf(byBot: Map<string, RunRecord[]>, a: string, b: string): Gap | null {
  const ra = byBot.get(a);
  const rb = byBot.get(b);
  if (!ra || !rb) return null;
  const seedsB = new Map(rb.map((r) => [r.seed, r.win]));
  const wa: boolean[] = [];
  const wb: boolean[] = [];
  for (const r of ra) {
    const w = seedsB.get(r.seed);
    if (w === undefined) continue;
    wa.push(r.win);
    wb.push(w);
  }
  if (wa.length === 0) return null;
  const diff = (wa.filter(Boolean).length - wb.filter(Boolean).length) / wa.length;
  return { a, b, n: wa.length, diff, mcnemar: pairedMcNemar(wa, wb) };
}

const GAP_PAIRS: [string, string][] = [
  ['aware', 'blind'],
  ['aware', 'greedyType'],
  ['greedyType', 'blind'],
  ['greedyType', 'confused'],
  ['blind', 'confused'],
  ['confused', 'random'],
  ['aware', 'aware-noResolve'],
  ['aware', 'aware-noHarmony'],
  ['aware', 'aware-noInward'],
  ['aware', 'buryAll'],
  ['aware', 'resolveOnly'],
  ['resolveOnly', 'buryAll'],
  ['aware', 'mono-love'],
  ['aware', 'mono-courage'],
  ['aware', 'pair-delight'],
  ['aware', 'arc3-love'],
  ['aware', 'rainbow'],
];

const inRange = (x: number, lo: number, hi: number): Status => (!Number.isFinite(x) ? 'N/A' : x >= lo && x <= hi ? 'PASS' : 'FAIL');
const atLeast = (x: number, lo: number): Status => (!Number.isFinite(x) ? 'N/A' : x >= lo ? 'PASS' : 'FAIL');
const atMost = (x: number, hi: number): Status => (!Number.isFinite(x) ? 'N/A' : x <= hi ? 'PASS' : 'FAIL');
const both = (...s: Status[]): Status => (s.includes('N/A') ? 'N/A' : s.every((x) => x === 'PASS') ? 'PASS' : 'FAIL');

/** Heart lost per fight, blind / aware, by tier (paired bootstrap over seeds of the per-run mean). */
function heartRatios(byBot: Map<string, RunRecord[]>): Metrics['heartRatios'] {
  const aware = byBot.get('aware');
  const blind = byBot.get('blind');
  if (!aware || !blind) return [];
  const bSeeds = new Map(blind.map((r) => [r.seed, r]));
  const pa: RunRecord[] = [];
  const pb: RunRecord[] = [];
  for (const r of aware) {
    const o = bSeeds.get(r.seed);
    if (o) {
      pa.push(r);
      pb.push(o);
    }
  }
  const out: Metrics['heartRatios'] = [];
  for (const tier of ['normal', 'elite', 'boss', 'final'] as Tier[]) {
    const stat = (rs: readonly RunRecord[]) => {
      let loss = 0;
      let n = 0;
      for (const r of rs) {
        for (const f of r.combats) {
          if (f.tier !== tier) continue;
          loss += f.heartLost;
          n += 1;
        }
      }
      return n > 0 ? loss / n : Number.NaN;
    };
    const ratio = pairedBootstrap(pb, pa, stat, { mode: 'ratio', iterations: 500, seed: 7 });
    out.push({ tier, ratio, blind: stat(pb), aware: stat(pa) });
  }
  return out;
}

export function computeMetrics(records: readonly RunRecord[]): Metrics {
  const byBot = groupByBot(records);
  const bots = [...byBot.entries()].map(([bot, runs]) => summarize(bot, runs));
  const get = (name: string) => bots.find((b) => b.bot === name);
  const gaps = GAP_PAIRS.map(([a, b]) => gapOf(byBot, a, b)).filter((g): g is Gap => g !== null);
  const gap = (a: string, b: string) => gaps.find((g) => g.a === a && g.b === b);
  const hr = heartRatios(byBot);
  const checks: Check[] = [];
  const gates: Check[] = [];
  const add = (id: string, metric: string, target: string, value: string, status: Status) => checks.push({ id, metric, target, value, status });
  const addGate = (id: string, metric: string, target: string, value: string, status: Status) => gates.push({ id, metric, target, value, status });

  const aware = get('aware');
  const blind = get('blind');
  const winOf = (name: string) => get(name)?.win.p ?? Number.NaN;

  add('aware.win', '`aware` win rate', '45-65%', pct(winOf('aware')), inRange(winOf('aware'), 0.45, 0.65));
  addGate('gate.aware.win', '`aware` win rate', '>= 30%', pct(winOf('aware')), atLeast(winOf('aware'), 0.3));

  const gapRow = (a: string, b: string, target: number, gateFloor: number | null, gateStrict: boolean) => {
    const g = gap(a, b);
    const v = g ? `${pp(g.diff)} (n=${g.n}, McNemar p=${num(g.mcnemar.pExact, 4)}, mid-p=${num(g.mcnemar.pMid, 4)})` : 'n/a';
    add(`gap.${a}.${b}`, `\`${a}\` - \`${b}\` paired win rate`, `>= ${pp(target)}`, v, g ? atLeast(g.diff, target) : 'N/A');
    if (gateFloor !== null) {
      const ok: Status = !g ? 'N/A' : (gateStrict ? g.diff > gateFloor : g.diff >= gateFloor) && g.mcnemar.pExact < 0.05 ? 'PASS' : 'FAIL';
      addGate(`gate.${a}.${b}`, `\`${a}\` - \`${b}\``, `${gateStrict ? '>' : '>='} ${pp(gateFloor)} and one-sided McNemar p < 0.05`, v, ok);
    }
  };
  gapRow('aware', 'blind', 0.15, 0.08, false);
  gapRow('aware', 'greedyType', 0.08, 0.02, false);

  // Lead ruling (21.3): confused is greedyType with the chart rotated -1; blind sits beside it, below aware.
  const ladder = ['random', 'confused', 'greedyType', 'aware'];
  const lw = ladder.map(winOf);
  const blindW = winOf('blind');
  const chain = lw.every((x) => Number.isFinite(x)) ? lw.every((x, i) => i === 0 || x > lw[i - 1]!) : Number.NaN;
  const holds = Number.isNaN(chain) || !Number.isFinite(blindW) ? Number.NaN : chain && blindW < lw[3]!;
  add(
    'ladder',
    'Ladder `random < confused < greedyType < aware` and `blind < aware`',
    'holds',
    `${ladder.map((b, i) => `${b} ${pct(lw[i]!)}`).join(' < ')}; blind ${pct(blindW)}`,
    Number.isNaN(holds) ? 'N/A' : holds ? 'PASS' : 'FAIL',
  );
  const bc = gap('greedyType', 'confused');
  addGate(
    'gate.greedyType.confused',
    '`greedyType` - `confused`',
    '> 0 and one-sided McNemar p < 0.05',
    bc ? `${pp(bc.diff)} (p=${num(bc.mcnemar.pExact, 4)})` : 'n/a',
    !bc ? 'N/A' : bc.diff > 0 && bc.mcnemar.pExact < 0.05 ? 'PASS' : 'FAIL',
  );

  const pr = aware?.probe;
  add('divergence', 'Decision divergence (aware vs greedyType, combat decisions)', '>= 25%', pr ? `${pct(pr.divergence)} of ${pr.combat}` : 'n/a', pr ? atLeast(pr.divergence, 0.25) : 'N/A');
  add('typeflip', 'Type-flip rate (aware vs blind, combat decisions)', '>= 35%', pr ? `${pct(pr.typeFlip)} of ${pr.combat}` : 'n/a', pr ? atLeast(pr.typeFlip, 0.35) : 'N/A');

  const share = (b: BotSummary | undefined, r: Relation) => b?.dmgShare[r] ?? Number.NaN;
  add('opp.aware', 'OPPOSITE share of card damage, aware', '>= 45%', pct(share(aware, 'opposite')), atLeast(share(aware, 'opposite'), 0.45));
  add('opp.blind', 'OPPOSITE share of card damage, blind', '<= 30%', pct(share(blind, 'opposite')), atMost(share(blind, 'opposite'), 0.3));
  add('dis.aware', 'DISSONANT share of card damage, aware', '<= 5%', pct(share(aware, 'dissonant')), atMost(share(aware, 'dissonant'), 0.05));
  add('dis.blind', 'DISSONANT share of card damage, blind', '>= 10%', pct(share(blind, 'dissonant')), atLeast(share(blind, 'dissonant'), 0.1));
  add('resolve.aware', 'Resolve share of named kills, aware', '60-80%', pct(aware?.resolveShare ?? Number.NaN), inRange(aware?.resolveShare ?? Number.NaN, 0.6, 0.8));
  add('resolve.blind', 'Resolve share of named kills, blind', '25-45%', pct(blind?.resolveShare ?? Number.NaN), inRange(blind?.resolveShare ?? Number.NaN, 0.25, 0.45));

  for (const [abl, floor] of [
    ['aware-noResolve', 0.05],
    ['aware-noHarmony', 0.05],
    ['aware-noInward', 0.03],
  ] as const) {
    const g = gap('aware', abl);
    add(`abl.${abl}`, `Ablation \`${abl}\` below aware`, `>= ${pp(floor)}`, g ? `${pp(g.diff)} (p=${num(g.mcnemar.pExact, 4)})` : 'n/a', g ? atLeast(g.diff, floor) : 'N/A');
  }

  add('harmony.aware', 'Harmonized share of cards played after the Compass, aware', '25-45%', pct(aware?.harmonizedShare ?? Number.NaN), inRange(aware?.harmonizedShare ?? Number.NaN, 0.25, 0.45));
  add('tends.aware', 'Median Tends per run, aware', '>= 2', num(aware?.tendsMedian ?? Number.NaN, 1), atLeast(aware?.tendsMedian ?? Number.NaN, 2));

  const bury = winOf('buryAll');
  const ronly = winOf('resolveOnly');
  const aw = winOf('aware');
  add(
    'bury.resolve',
    '`buryAll` vs `resolveOnly`: within 10 pp, both >= 10 pp below aware',
    'within 10 pp; both <= aware - 10 pp',
    `buryAll ${pct(bury)}, resolveOnly ${pct(ronly)}, aware ${pct(aw)}`,
    both(atMost(Math.abs(bury - ronly), 0.1), atMost(bury, aw - 0.1), atMost(ronly, aw - 0.1)),
  );

  const spread = (rates: Record<string, Interval & { n: number }> | undefined, band: number, minN: number): [string, Status] => {
    if (!rates) return ['n/a', 'N/A'];
    const rows = Object.entries(rates).filter(([, r]) => r.n >= minN);
    if (rows.length < 2) return [`${rows.length} group(s) with n >= ${minN}`, 'N/A'];
    const m = aware ? aware.win.p : mean(rows.map(([, r]) => r.p));
    const text = rows.map(([k, r]) => `${k.replace('ks.', '')} ${pct(r.p, 0)} (n=${r.n})`).join(', ');
    return [text, rows.every(([, r]) => Math.abs(r.p - m) <= band) ? 'PASS' : 'FAIL'];
  };
  const [charmText, charmStatus] = spread(aware?.byCharm, 0.08, 10);
  add('charm', 'Win rate by Charm (aware), each within +/-8 pp of the mean', '+/-8 pp', charmText, charmStatus);
  const [lightText, lightStatus] = spread(aware?.byDominant, 0.1, 15);
  add('dominant', 'Win rate by dominant deck Light (aware), each within +/-10 pp of the mean', '+/-10 pp (groups with n >= 15)', lightText, lightStatus);

  for (const b of ['pair-delight', 'arc3-love', 'rainbow']) {
    const w = winOf(b);
    add(`policy.${b}`, `Policy bot \`${b}\``, '25-55%, not above aware + 5 pp', pct(w), both(inRange(w, 0.25, 0.55), atMost(w, aw + 0.05)));
  }
  for (const b of ['mono-love', 'mono-courage']) {
    const w = winOf(b);
    add(`mono.${b}`, `\`${b}\` overall`, '15-45%', pct(w), inRange(w, 0.15, 0.45));
  }

  const numbRate = (name: string) => get(name)?.numbness.rate.p ?? Number.NaN;
  const numbText = (name: string) => {
    const x = get(name)?.numbness;
    return x ? `${pct(x.rate.p)} (${x.won}/${x.reached})` : 'n/a';
  };
  add('numb.aware', 'The Numbness win rate given reached, aware', '>= 60%', numbText('aware'), atLeast(numbRate('aware'), 0.6));
  add('numb.blind', 'The Numbness win rate given reached, blind', '<= 35%', numbText('blind'), atMost(numbRate('blind'), 0.35));
  const arc = numbRate('arc3-love');
  for (const b of ['mono-love', 'mono-courage']) {
    const r = numbRate(b);
    add(`numb.${b}`, `\`${b}\` vs The Numbness given reached, relative to arc3-love`, '>= 30% of arc3 rate', `${numbText(b)} vs arc3 ${numbText('arc3-love')}`, Number.isFinite(r) && Number.isFinite(arc) && arc > 0 ? atLeast(r / arc, 0.3) : 'N/A');
  }
  add('buried.deep', 'Median total Buried Weight on reaching The Deep, aware', '1-4', num(aware?.buriedAtDeepMedian ?? Number.NaN, 1), inRange(aware?.buriedAtDeepMedian ?? Number.NaN, 1, 4));

  for (const row of hr) {
    const v = `${num(row.ratio.p)}x [${num(row.ratio.lo)}, ${num(row.ratio.hi)}] (blind ${num(row.blind, 1)} / aware ${num(row.aware, 1)})`;
    if (row.tier === 'normal') add('heart.normal', 'Heart lost per fight, blind / aware, normals', '1.1-1.5x', v, inRange(row.ratio.p, 1.1, 1.5));
    else add(`heart.${row.tier}`, `Heart lost per fight, blind / aware, ${row.tier === 'final' ? 'The Numbness' : row.tier === 'boss' ? 'act bosses' : 'elites'}`, '>= 1.5x', v, atLeast(row.ratio.p, 1.5));
  }

  const rnd = winOf('random');
  add('random', '`random` win rate', '< 2%', pct(rnd), Number.isFinite(rnd) ? (rnd < 0.02 ? 'PASS' : 'FAIL') : 'N/A');
  addGate('gate.random', '`random` win rate', '< 5%', pct(rnd), Number.isFinite(rnd) ? (rnd < 0.05 ? 'PASS' : 'FAIL') : 'N/A');
  add('turns.normal', 'Median turns per normal fight, aware', '3-6', num(aware?.turnsNormalMedian ?? Number.NaN, 1), inRange(aware?.turnsNormalMedian ?? Number.NaN, 3, 6));
  add('turns.p99', 'p99 combat length, aware', '< 20 turns', num(aware?.turnsP99 ?? Number.NaN, 1), Number.isFinite(aware?.turnsP99 ?? Number.NaN) ? ((aware!.turnsP99 < 20) ? 'PASS' : 'FAIL') : 'N/A');
  const maxCards = Math.max(0, ...bots.map((b) => b.maxCardsPerTurn));
  add('cards.turn', 'Max cards played in one turn, all bots', '<= 25', String(maxCards), atMost(maxCards, 25));
  const broken = bots.reduce((a, b) => a + b.errors + b.violations + b.softlocks, 0);
  const brokenText = bots
    .filter((b) => b.errors + b.violations + b.softlocks > 0)
    .map((b) => `${b.bot}: ${b.errors} errors, ${b.violations} with violations, ${b.softlocks} softlocks`)
    .join('; ');
  add('health', 'Invariant violations, softlocks, RunawayTriggers (runs affected)', '0', broken === 0 ? '0' : brokenText, broken === 0 ? 'PASS' : 'FAIL');
  addGate('gate.health', 'Invariant violations, softlocks, RunawayTriggers', '0', broken === 0 ? '0' : brokenText, broken === 0 ? 'PASS' : 'FAIL');
  add('preview', 'Preview/apply mismatches', '0', 'covered by tests/slow/combat.previewVsStep.test.ts', 'N/A');

  return { bots, gaps, checks, gates, heartRatios: hr };
}

