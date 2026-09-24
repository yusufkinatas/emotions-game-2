// Saves and hashing (DESIGN 20.5, 20.6, 20.8): canonical JSON, FNV-1a, version and content checks.

import type { ContentPack, GameState, RulesConfig } from './types';

/** JSON with object keys sorted at every level (undefined fields dropped), so equal states print equally. */
export function canonicalJson(x: unknown): string {
  if (x === null || typeof x !== 'object') return JSON.stringify(x) ?? 'null';
  if (Array.isArray(x)) return `[${x.map((v) => (v === undefined ? 'null' : canonicalJson(v))).join(',')}]`;
  const obj = x as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}

/** 32-bit FNV-1a over UTF-16 code units, as 8 hex digits. */
export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export const hashState = (s: GameState): string => fnv1a(canonicalJson(s));

/** Hash of the pack's ids and the resolved rules: a save from another build is discarded. */
export function computeContentHash(pack: ContentPack, rules: RulesConfig): string {
  const ids = (r: Record<string, unknown>): string[] => Object.keys(r).sort();
  return fnv1a(
    canonicalJson({
      cards: ids(pack.cards),
      enemies: ids(pack.enemies),
      encounters: ids(pack.encounters),
      statuses: ids(pack.statuses),
      companions: ids(pack.companions),
      keepsakes: ids(pack.keepsakes),
      events: ids(pack.events),
      rules,
    }),
  );
}

export const serializeState = (s: GameState): string => JSON.stringify(s);

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Parses a save. Returns null for bad JSON, another version, another content build, or a broken shape. */
export function deserializeState(json: string, contentHash: string): GameState | null {
  let x: unknown;
  try {
    x = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isRecord(x) || x['v'] !== 1 || x['contentHash'] !== contentHash) return null;
  if (typeof x['seed'] !== 'number' || typeof x['nextUid'] !== 'number') return null;
  const phase = x['phase'];
  const run = x['run'];
  if (!isRecord(phase) || typeof phase['kind'] !== 'string') return null;
  if (!isRecord(run) || !Array.isArray(run['deck']) || !isRecord(run['map']) || !isRecord(run['stats'])) return null;
  const combat = x['combat'] ?? null;
  if (combat !== null && !isRecord(combat)) return null;
  if ((phase['kind'] === 'combat') !== (combat !== null)) return null;
  return { ...(x as unknown as GameState), combat: combat as GameState['combat'], eventCombat: (x['eventCombat'] ?? null) as GameState['eventCombat'] };
}
