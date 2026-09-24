// Pure evaluation of the effect DSL's Amounts, Countables and Conds (DESIGN 20.3) against a runtime.
// Nothing here mutates state. Intent conditions read the CURRENT intent (4.18 ruling), not the projection.

import { actorEnemy, enemyDef, findEnemy, type Rt } from './combat/runtime';
import { computeStrike } from './damage';
import { AFFLICTIONS } from './emotions';
import type { Amount, CmpOp, Cond, Countable, Effect, EffectCtx, EnemyState, StatusBag, StatusId } from './types';

export function cmp(a: number, op: CmpOp, b: number): boolean {
  switch (op) {
    case '>=':
      return a >= b;
    case '<=':
      return a <= b;
    case '==':
      return a === b;
    case '>':
      return a > b;
    case '<':
      return a < b;
  }
}

function bagFor(rt: Rt, on: 'self' | 'target' | 'player', ctx: EffectCtx): StatusBag | undefined {
  if (on === 'player') return rt.c.player.statuses;
  if (on === 'target') return findEnemy(rt, ctx.targetUid)?.statuses;
  const actor = actorEnemy(rt, ctx);
  if (ctx.source === 'enemy') return actor?.statuses;
  return rt.c.player.statuses;
}

function statusCount(rt: Rt, id: StatusId, on: 'self' | 'target' | 'player', ctx: EffectCtx): number {
  return bagFor(rt, on, ctx)?.[id] ?? 0;
}

/** The card whose own counters (lingered, timesPlayed) a context reads. */
function ctxCard(rt: Rt, ctx: EffectCtx) {
  if (ctx.source === 'card' || ctx.source === 'mood' || ctx.source === 'promise') return rt.c.cards[ctx.sourceUid];
  return undefined;
}

export function countOf(rt: Rt, what: Countable, ctx: EffectCtx): number {
  if (typeof what === 'object') return statusCount(rt, what.status, what.on, ctx);
  switch (what) {
    case 'playedThisTurn':
      return rt.c.turnFlags.played;
    case 'companions':
      return rt.c.companions.length;
    case 'turn':
      return rt.c.turn;
    case 'unspentEnergy':
      return rt.c.energy;
    case 'incoming':
      return incomingTotal(rt);
    case 'promisesMade':
      return rt.c.promisesMade;
    case 'lingered':
      return ctxCard(rt, ctx)?.mem.lingered ?? 0;
    case 'timesPlayed':
      return ctxCard(rt, ctx)?.mem.timesPlayed ?? 0;
    case 'buriedInHand': {
      let n = 0;
      for (const uid of rt.c.piles.hand) {
        const def = rt.pack.cards[rt.c.cards[uid]!.defId];
        if (def && (def.kind === 'buried' || def.buried)) n++;
      }
      return n;
    }
  }
}

export function evalAmount(rt: Rt, a: Amount, ctx: EffectCtx): number {
  if (typeof a === 'number') return Math.floor(a);
  let v = a.add ?? 0;
  if (a.per !== undefined) v += countOf(rt, a.per, ctx) * (a.mult ?? 1);
  if (a.min !== undefined) v = Math.max(a.min, v);
  if (a.max !== undefined) v = Math.min(a.max, v);
  return Math.floor(v);
}

export function evalCond(rt: Rt, cond: Cond, ctx: EffectCtx): boolean {
  switch (cond.c) {
    case 'harmonized':
      return ctx.harmonized;
    case 'targetIntendsAttack': {
      const t = findEnemy(rt, ctx.targetUid);
      return t ? intendsAttack(rt, t) : false;
    }
    case 'anyIntendsAttack':
      return rt.c.enemies.some((e) => intendsAttack(rt, e));
    case 'noGuard':
      return rt.c.player.guard === 0;
    case 'noCompanions':
      return rt.c.companions.length === 0;
    case 'suppressedTarget':
      return ctx.suppressedTarget === true || (ctx.source === 'card' && rt.play?.uid === ctx.sourceUid && rt.play.suppressed);
    case 'onlyShade': {
      const self = actorEnemy(rt, ctx);
      return !!self && rt.c.enemies.length === 1;
    }
    case 'sourceLights': {
      const has = cond.has;
      if (cond.mode === 'any') return ctx.lights.some((l) => has.includes(l));
      if (cond.mode === 'none') return !ctx.lights.some((l) => has.includes(l));
      return has.every((l) => ctx.lights.includes(l));
    }
    case 'marked': {
      const self = actorEnemy(rt, ctx);
      return !!self && (self.memory[cond.key] ?? 0) > 0;
    }
    case 'status':
      return cmp(statusCount(rt, cond.id, cond.on, ctx), cond.op, cond.n);
    case 'playedLastTurn':
      return cmp(rt.c.playedLastTurn, cond.op, cond.n);
    case 'playedLightThisTurn':
      return rt.c.turnFlags.lightsThisTurn.includes(cond.light);
    case 'hitFromCard':
      return ctx.fromCard;
    case 'relation':
      return ctx.relation !== undefined && cond.is.includes(ctx.relation);
    case 'count':
      return cmp(countOf(rt, cond.of, ctx), cond.op, cond.n);
    case 'and':
      return cond.of.every((x) => evalCond(rt, x, ctx));
    case 'or':
      return cond.of.some((x) => evalCond(rt, x, ctx));
    case 'not':
      return !evalCond(rt, cond.of, ctx);
  }
}

// ---------------------------------------------------------------------------------------------------
// Move outlines: the numbers a Shade's move will produce right now (intents, 'incoming', Instinct).
// ---------------------------------------------------------------------------------------------------

export interface MoveOutline {
  /** Each strike effect: per-strike damage after Flare and Hush, and count. */
  strikes: { base: number; perStrike: number; count: number }[];
  strikeTotal: number;
  /** Guard the Shade gains. */
  shield: number;
  afflict: { id: string; stacks: number } | null;
  mend: number;
}

const isAfflictionId = (rt: Rt, id: StatusId): boolean =>
  rt.pack.statuses[id]?.affliction !== undefined || (AFFLICTIONS as readonly string[]).includes(id) || id === 'numb';

export function selfCtx(e: EnemyState): EffectCtx {
  return { source: 'enemy', sourceUid: e.uid, targetUid: null, lights: [], harmonized: false, fromCard: false };
}

export function moveOutline(rt: Rt, e: EnemyState, moveId: string): MoveOutline {
  const out: MoveOutline = { strikes: [], strikeTotal: 0, shield: 0, afflict: null, mend: 0 };
  const move = enemyDef(rt, e).moves[moveId];
  if (!move) return out;
  const ctx = selfCtx(e);
  const flare = e.statuses.flare ?? 0;
  const hush = e.statuses.hush ?? 0;
  const walk = (effects: readonly Effect[]) => {
    for (const eff of effects) {
      switch (eff.op) {
        case 'strike': {
          const base = evalAmount(rt, eff.amount, ctx);
          const count = eff.times === undefined ? 1 : Math.max(0, evalAmount(rt, eff.times, ctx));
          const perStrike = computeStrike(base, flare, hush);
          out.strikes.push({ base, perStrike, count });
          out.strikeTotal += perStrike * count;
          break;
        }
        case 'guard':
          out.shield += Math.max(0, evalAmount(rt, eff.amount, ctx));
          break;
        case 'mend':
          if (eff.to !== 'player') out.mend += Math.max(0, evalAmount(rt, eff.amount, ctx));
          break;
        case 'afflict':
          if (!out.afflict) out.afflict = { id: eff.id, stacks: eff.stacks };
          break;
        case 'status':
          if (!out.afflict && eff.to === 'player' && isAfflictionId(rt, eff.id)) {
            out.afflict = { id: eff.id, stacks: evalAmount(rt, eff.stacks, ctx) };
          }
          break;
        case 'if':
          walk(evalCond(rt, eff.cond, ctx) ? eff.then : (eff.else ?? []));
          break;
        default:
          break;
      }
    }
  };
  walk(move.effects);
  return out;
}

/** "Intends to attack" = the current intent's move includes a Strike (6.5). */
export function intendsAttack(rt: Rt, e: EnemyState): boolean {
  if (!e.intent) return false;
  const move = enemyDef(rt, e).moves[e.intent.moveId];
  if (!move) return false;
  return move.intent.includes('strike') || move.effects.some((x) => x.op === 'strike');
}

/** Sum of every Shade's current intent strike totals (after Flare and Hush, before your Guard). */
export function incomingTotal(rt: Rt): number {
  let total = 0;
  for (const e of rt.c.enemies) if (e.intent) total += moveOutline(rt, e, e.intent.moveId).strikeTotal;
  return total;
}
