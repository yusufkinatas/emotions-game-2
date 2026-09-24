// Static card value (DESIGN 21.1 run policy): walk the effect DSL with fixed weights.
// Ease 1/pt, Guard 0.8/pt, draw 2.5, Spirit 3, Promise x0.9, Mood x3. The same walker prices the lasting
// parts of a play in combat (Promises, Moods, Companions), with in-combat estimates.

import type { Amount, CardDef, CardId, Cond, ContentPack, Countable, Effect, Keyword, MoodDef } from '../../src/engine/index';

export const W = {
  ease: 1,
  guard: 0.8,
  mend: 0.5,
  draw: 2.5,
  spirit: 3,
  promise: 0.9,
  mood: 3,
  /** Nerve lasts the combat: every later card hit gains +1. */
  nerve: 4,
  warmth: 1.2,
  hush: 0.6,
  understood: 3,
  clearFlare: 2,
  companionsAct: 3,
  nextCardFree: 3,
  fetchBuried: 1.5,
  tendAny: 5,
  removeAfflictions: 3,
  allTargets: 1.4,
} as const;

/** Companion value per summon (about two turns of its action). */
export const COMPANION_VALUE: Record<string, number> = {
  'comp.lantern_moth': 6,
  'comp.burrow_hare': 5,
  'comp.old_dog': 12,
};

/** Typical counts for amounts outside a concrete combat state. */
const OUT_OF_COMBAT: Partial<Record<Exclude<Countable, object>, number>> = {
  playedThisTurn: 1.5,
  companions: 1,
  turn: 3,
  unspentEnergy: 0.5,
  incoming: 10,
  promisesMade: 1,
  lingered: 1,
  timesPlayed: 1,
  buriedInHand: 0.3,
};

export type Estimator = (per: Countable) => number;

export const staticEstimate: Estimator = (per) => {
  if (typeof per === 'object') return per.status === 'flare' ? 1 : 0.5;
  return OUT_OF_COMBAT[per] ?? 1;
};

export function amountOf(a: Amount | undefined, est: Estimator): number {
  if (a === undefined) return 1;
  if (typeof a === 'number') return a;
  let v = (a.add ?? 0) + (a.per ? est(a.per) * (a.mult ?? 1) : 0);
  if (a.min !== undefined) v = Math.max(a.min, v);
  if (a.max !== undefined) v = Math.min(a.max, v);
  return v;
}

/** Probability-like weight of a condition's then-branch when the state is not known. */
function condWeight(c: Cond, harmonized: number): number {
  switch (c.c) {
    case 'harmonized':
      return harmonized;
    case 'noGuard':
      return 0.5;
    case 'targetIntendsAttack':
    case 'anyIntendsAttack':
      return 0.6;
    case 'suppressedTarget':
      return 0.2;
    case 'noCompanions':
      return 0.5;
    default:
      return 0.5;
  }
}

export interface WalkOpts {
  est: Estimator;
  /** Weight of Harmony riders: 1/0 when known (in combat), a probability otherwise. */
  harmonized: number;
}

export function effectsValue(effects: readonly Effect[], o: WalkOpts): number {
  let v = 0;
  for (const e of effects) v += effectValue(e, o);
  return v;
}

function effectValue(e: Effect, o: WalkOpts): number {
  const amt = (a: Amount | undefined) => amountOf(a, o.est);
  switch (e.op) {
    case 'hit':
      return W.ease * amt(e.amount) * (e.times === undefined ? 1 : amt(e.times)) * (e.to === 'all' ? W.allTargets : 1);
    case 'guard':
      return W.guard * amt(e.amount);
    case 'mend':
      return e.to === 'self' ? 0 : W.mend * amt(e.amount);
    case 'status':
      return statusValue(e.id, amt(e.stacks), e.to);
    case 'setStatus':
      return 0;
    case 'clearStatus':
      return e.id === 'flare' ? W.clearFlare : 0;
    case 'draw':
      return W.draw * amt(e.n);
    case 'energy':
      return W.spirit * amt(e.n);
    case 'summon':
      return COMPANION_VALUE[e.companion] ?? 5;
    case 'companionsAct':
      return W.companionsAct;
    case 'promise':
      return W.promise * effectsValue(e.effects, o);
    case 'nextCardFree':
      return W.nextCardFree;
    case 'fetchBuried':
      return W.fetchBuried;
    case 'tendAny':
      return W.tendAny;
    case 'removeAfflictions':
      return W.removeAfflictions;
    case 'lingerHand':
      return 1;
    case 'if': {
      const p = condWeight(e.cond, o.harmonized);
      return p * effectsValue(e.then, o) + (1 - p) * effectsValue(e.else ?? [], o);
    }
    default:
      return 0;
  }
}

function statusValue(id: string, stacks: number, to: string): number {
  switch (id) {
    case 'nerve':
      return W.nerve * stacks;
    case 'warmth':
      return W.warmth * stacks;
    case 'hush':
      return W.hush * stacks * (to === 'all' ? W.allTargets : 1);
    case 'understood':
      return W.understood;
    default:
      return 0;
  }
}

/** The printed or upgraded parts of a card. */
export interface CardParts {
  effects: readonly Effect[];
  cost: number | 'unplayable';
  keywords: readonly Keyword[];
  mood: readonly MoodDef[];
  costMod: CardDef['costMod'];
}

export function cardParts(def: CardDef, upgraded: boolean): CardParts {
  const u = upgraded ? def.upgrade : undefined;
  return {
    effects: u?.effects ?? def.effects,
    cost: u?.cost ?? def.cost,
    keywords: u?.keywords ?? def.keywords ?? [],
    mood: u?.mood ?? def.mood ?? [],
    costMod: u?.costMod ?? def.costMod,
  };
}

/** Lasting value of a Mood's registered effects ("Mood x3"). */
export function moodValue(mood: readonly MoodDef[], o: WalkOpts): number {
  let v = 0;
  for (const m of mood) v += W.mood * effectsValue(m.effects, o);
  // A Mood with only a rules change (Serenity) still shapes every turn.
  return mood.length > 0 && v === 0 ? 3 : v;
}

const valueCache = new WeakMap<ContentPack, Map<string, number>>();

/** Static value of one card (per play, adjusted for Spirit cost). Buried cards are strongly negative. */
export function cardValue(pack: ContentPack, defId: CardId, upgraded: boolean, weight = 1): number {
  const def = pack.cards[defId];
  if (!def) return 0;
  if (def.kind === 'buried') return -(8 + 4 * weight);
  let cache = valueCache.get(pack);
  if (!cache) {
    cache = new Map();
    valueCache.set(pack, cache);
  }
  const key = `${defId}:${upgraded ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const parts = cardParts(def, upgraded);
  const o: WalkOpts = { est: staticEstimate, harmonized: def.lights.length > 0 ? 0.4 : 0 };
  let v = effectsValue(parts.effects, o) + moodValue(parts.mood, o);
  for (const k of parts.keywords) {
    if (k === 'linger') v += 1;
    else if (k === 'innate') v += 1;
    else if (k === 'reachesShy') v += 0.5;
    else if (k === 'letGo') v -= 1;
  }
  if (typeof parts.cost === 'number') {
    let cost = parts.cost;
    if (parts.costMod) cost = Math.max(0, cost + staticEstimate(parts.costMod.per) * parts.costMod.mult);
    v += cost <= 0 ? 2 : -5 * (cost - 1);
  }
  cache.set(key, v);
  return v;
}
