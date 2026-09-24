// Simulator configuration: rule overrides (--set rules.key=value, comma lists sweep), content scaling for
// tuning experiments (--scale hp=1.2,strike.elite=1.1; an in-memory copy of the pack, never the content
// files), engine construction and the (bot, seed) job list with sharding.

import { createEngine, type ContentPack, type Effect, type Engine, type EnemyDef, type RulesConfig } from '../src/engine/index';
import { defaultPack } from '../src/content/index';
import { POLICY_BOTS, type BotName } from './bots/index';

export type RuleOverrides = Record<string, unknown>;

function parseValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function setPath(obj: Record<string, unknown>, path: string[], value: unknown): void {
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i]!;
    const next = cur[k];
    if (typeof next !== 'object' || next === null) cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[path[path.length - 1]!] = value;
}

/** One `--set` flag: `rules.a.b=value`. A value with commas that is not JSON is a sweep list. */
export interface SetFlag {
  path: string[];
  values: unknown[];
  raw: string;
}

export function parseSet(flag: string): SetFlag {
  const eq = flag.indexOf('=');
  if (eq < 0) throw new Error(`--set needs key=value, got "${flag}"`);
  const key = flag.slice(0, eq).trim();
  const raw = flag.slice(eq + 1).trim();
  const path = key.split('.');
  if (path[0] === 'rules') path.shift();
  if (path.length === 0) throw new Error(`--set needs a rules key, got "${flag}"`);
  return { path, values: sweepValues(raw), raw };
}

/** `150,200` and `{"a":1},{"a":2}` are sweeps (they parse as a JSON list); `{"a":1}` or `clockwise` is one value. */
function sweepValues(raw: string): unknown[] {
  const whole = parseValue(raw);
  if (typeof whole !== 'string' || !raw.includes(',')) return [whole];
  try {
    const list = JSON.parse(`[${raw}]`) as unknown[];
    if (Array.isArray(list)) return list;
  } catch {
    // Not a JSON list: plain comma-separated words.
  }
  return raw.split(',').map((x) => parseValue(x.trim()));
}

export interface Variant {
  label: string;
  rules: RuleOverrides;
}

/** Cartesian product of every sweep list. With no sweep there is exactly one variant. */
export function expandVariants(flags: readonly SetFlag[]): Variant[] {
  let out: Variant[] = [{ label: 'base', rules: {} }];
  for (const f of flags) {
    const next: Variant[] = [];
    for (const v of out) {
      for (const value of f.values) {
        const rules = structuredClone(v.rules);
        setPath(rules, f.path, value);
        const tag = `${f.path.join('.')}=${JSON.stringify(value)}`;
        next.push({ label: v.label === 'base' ? tag : `${v.label},${tag}`, rules });
      }
    }
    out = next;
  }
  return out;
}

/**
 * Content scaling for tuning experiments: `hp` / `strike`, optionally per tier (`hp.elite=1.2`) or per act of the
 * encounter (`hp.a2=1.3`, `strike.a2=1.2`). Factors multiply. Act factors apply to encounter members (as HP
 * overrides) and to the moves of Shades first met in that act.
 */
export type Scale = Record<string, number>;

export function parseScale(raw: string | undefined): Scale {
  const out: Scale = {};
  if (!raw) return out;
  for (const part of raw.split(',')) {
    const [k, v] = part.split('=');
    if (!k || v === undefined || !Number.isFinite(Number(v))) throw new Error(`--scale expects key=number, got "${part}"`);
    out[k.trim()] = Number(v);
  }
  return out;
}

type ScaleTier = 'normal' | 'elite' | 'boss' | 'final';
const tierOf = (d: EnemyDef): ScaleTier =>
  d.tier === 'elite' ? 'elite' : d.tier === 'boss' ? 'boss' : d.tier === 'final' ? 'final' : 'normal';
const factor = (scale: Scale, what: 'hp' | 'strike', tier: ScaleTier, act: 1 | 2 | 3): number =>
  (scale[`${what}.${tier}`] ?? 1) * (scale[what] ?? 1) * (act < 3 ? (scale[`${what}.a${act}`] ?? 1) : 1);

function scaleStrikes(effects: readonly Effect[], f: number): Effect[] {
  if (f === 1) return [...effects];
  return effects.map((e): Effect => {
    if (e.op === 'strike') {
      const a = e.amount;
      const amount = typeof a === 'number' ? Math.round(a * f) : { ...a, add: Math.round((a.add ?? 0) * f) };
      return { ...e, amount };
    }
    if (e.op === 'if') return { ...e, then: scaleStrikes(e.then, f), else: e.else ? scaleStrikes(e.else, f) : undefined };
    return e;
  });
}

/** Act of each encounter id from the pools (event fights count as Act 1, The Deep as 3). */
function encounterActs(pack: ContentPack): Map<string, 1 | 2 | 3> {
  const acts = new Map<string, 1 | 2 | 3>();
  const add = (ids: readonly string[], act: 1 | 2 | 3) => {
    for (const id of ids) if (!acts.has(id)) acts.set(id, act);
  };
  const pool = (p: ContentPack['pools']['act1']) => [...p.early, ...(p.row3 ?? []), ...p.standard, ...p.elite, p.boss];
  add(pool(pack.pools.act1), 1);
  add(pool(pack.pools.act2), 2);
  add([pack.pools.deep], 3);
  return acts;
}

export function scalePack(pack: ContentPack, scale: Scale): ContentPack {
  if (Object.keys(scale).length === 0) return pack;
  const encActs = encounterActs(pack);
  // Home act of a Shade: the first act whose encounters include it (Grumble and Echo are Act 1 Shades).
  const home = new Map<string, 1 | 2 | 3>();
  for (const [id, e] of Object.entries(pack.encounters)) {
    const act = encActs.get(id) ?? 1;
    for (const m of e.members) if (!home.has(m.enemy) || home.get(m.enemy)! > act) home.set(m.enemy, act);
  }
  const enemies: ContentPack['enemies'] = {};
  for (const [id, d] of Object.entries(pack.enemies)) {
    const act = home.get(id) ?? (d.tier === 'final' || d.tier === 'surfaced' ? 3 : 1);
    const st = factor(scale, 'strike', tierOf(d), act);
    const moves: EnemyDef['moves'] = {};
    for (const [mid, m] of Object.entries(d.moves)) moves[mid] = { ...m, effects: scaleStrikes(m.effects, st) };
    enemies[id] = { ...d, moves };
  }
  const encounters: ContentPack['encounters'] = {};
  for (const [id, e] of Object.entries(pack.encounters)) {
    const act = encActs.get(id) ?? 1;
    encounters[id] = {
      ...e,
      members: e.members.map((m) => {
        const def = pack.enemies[m.enemy]!;
        const f = factor(scale, 'hp', tierOf(def), act);
        const base = m.hp ?? def.hp;
        return f === 1 ? m : { ...m, hp: [Math.round(base[0] * f), Math.round(base[1] * f)] as [number, number] };
      }),
    };
  }
  // Summoned and Surfaced Shades are not encounter members: scale their def HP by tier and global factors.
  for (const [id, d] of Object.entries(enemies)) {
    const inEncounter = Object.values(pack.encounters).some((e) => e.members.some((m) => m.enemy === id));
    if (inEncounter) continue;
    const f = factor(scale, 'hp', tierOf(d), home.get(id) ?? 1);
    enemies[id] = { ...d, hp: [Math.round(d.hp[0] * f), Math.round(d.hp[1] * f)] };
  }
  return { ...pack, enemies, encounters };
}

/** A content patch for tuning experiments (--patch file.ts exporting `patch`): returns a changed copy of the pack. */
export type PackPatch = (pack: ContentPack) => ContentPack;

export function buildEngine(rules: RuleOverrides, scale: Scale, patch: PackPatch | null = null): Engine {
  const base = patch ? patch(defaultPack) : defaultPack;
  return createEngine(scalePack(base, scale), rules as Partial<RulesConfig>);
}

export interface Job {
  bot: BotName;
  seed: number;
}

/** Runs per bot: policy bots may use a smaller count (21.1 archetype checks). */
export function jobList(bots: readonly BotName[], runs: number, policyRuns: number, seedStart: number): Job[] {
  const jobs: Job[] = [];
  for (const bot of bots) {
    const n = (POLICY_BOTS as readonly string[]).includes(bot) ? policyRuns : runs;
    for (let i = 0; i < n; i++) jobs.push({ bot, seed: seedStart + i });
  }
  return jobs;
}

/** Shard k of n (1-based): every n-th job, so each shard gets a similar bot mix. */
export function shardOf<T>(jobs: readonly T[], k: number, n: number): T[] {
  return jobs.filter((_, i) => i % n === k - 1);
}

export function parseShard(raw: string | undefined): { k: number; n: number } | null {
  if (!raw) return null;
  const m = /^(\d+)\/(\d+)$/.exec(raw);
  if (!m) throw new Error(`--shard expects k/n, got "${raw}"`);
  const k = Number(m[1]);
  const n = Number(m[2]);
  if (k < 1 || k > n) throw new Error(`--shard ${raw}: k must be in 1..n`);
  return { k, n };
}
