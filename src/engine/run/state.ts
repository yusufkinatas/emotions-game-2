// Shared run-side helpers: content lookups, Keepsake flags, uid allocation, fresh stats.

import { LIGHTS } from '../emotions';
import type {
  CardDef,
  EngineCtx,
  GameEvent,
  GameState,
  KeepsakeFlag,
  KeepsakeId,
  Light,
  MapNode,
  Relation,
  RunState,
  RunStats,
  Uid,
} from '../types';

/** Per-step working context for run handlers. Handlers mutate a cloned draft and push events here. */
export interface StepScratch {
  ctx: EngineCtx;
  events: GameEvent[];
  /** Set when the step drew, shuffled or rolled anything. */
  revealed: boolean;
}

export const RELATIONS: readonly Relation[] = ['opposite', 'neutral', 'dissonant', 'felt', 'muffled', 'veiled'];

export function emptyStats(): RunStats {
  const playsByLight = {} as Record<Light, number>;
  for (const l of LIGHTS) playsByLight[l] = 0;
  const dmgByRelation = {} as Record<Relation, number>;
  for (const r of RELATIONS) dmgByRelation[r] = 0;
  return {
    floors: 0,
    resolved: 0,
    deepResolved: 0,
    suppressed: 0,
    insights: 0,
    harmonies: 0,
    tends: 0,
    combats: 0,
    cardsPlayed: 0,
    playsByLight,
    playsByCard: {},
    dmgByRelation,
    heartLost: 0,
  };
}

export function cardDef(ctx: EngineCtx, id: string): CardDef {
  const d = ctx.pack.cards[id];
  if (!d) throw new Error(`Unknown card ${id}`);
  return d;
}

export const ownsKeepsake = (run: RunState, id: KeepsakeId): boolean => run.keepsakes.some((k) => k.id === id);

export function hasFlag(run: RunState, ctx: EngineCtx, flag: KeepsakeFlag): boolean {
  return run.keepsakes.some((k) => ctx.pack.keepsakes[k.id]?.flags?.includes(flag) ?? false);
}

/** The Compass: the fixed Keepsake that enables Harmony (falls back to the canonical id). */
export function compassId(ctx: EngineCtx): KeepsakeId | null {
  const fixed = Object.values(ctx.pack.keepsakes).find((k) => k.rarity === 'fixed' && k.flags?.includes('harmony'));
  if (fixed) return fixed.id;
  return ctx.pack.keepsakes['ks.compass'] ? 'ks.compass' : null;
}

/** Act used for card availability (The Deep offers everything Act 2 does). */
export const cardAct = (run: RunState): 1 | 2 => (run.act >= 2 ? 2 : 1);

export function allocUid(d: GameState): Uid {
  const u = d.nextUid;
  d.nextUid = u + 1;
  return u;
}

export function nodeById(run: RunState, id: number | null): MapNode | null {
  if (id === null) return null;
  return run.map.nodes.find((n) => n.id === id) ?? null;
}

export const currentNode = (run: RunState): MapNode | null => nodeById(run, run.map.current);

export const capitalize = (s: string): string => (s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1));
