// Effect interpreter (DESIGN 20.1.4, 5.3 step 7): a frame-stack machine over the effect DSL, a FIFO trigger
// queue drained after each effect completes, and pending-choice continuations (Look Inward, Sit With It).

import { chooseTargets as buriedChoiceOptions, resolveChoicePick } from './combat/buried';
import { companionsAct, scatterCompanions, summonCompanion } from './combat/companions';
import { refreshIntents, spawnFrom } from './combat/enemy';
import { hitEffect } from './combat/lethal';
import { checkHeart } from './combat/player';
import { actorEnemy, findEnemy, isVeiled, type Rt, type Trigger } from './combat/runtime';
import { giveStatus, isAffliction, setStatusOn } from './combat/statuses';
import { evalAmount, evalCond } from './conditions';
import { computeGuard, computeStrike } from './damage';
import { ST } from './constants';
import {
  addEnemyGuard,
  addEnergy,
  addPlayerGuard,
  addPromise,
  drawCards,
  emit,
  mendEnemy,
  mendPlayer,
  strikePlayer,
} from './primitives';
import type { Effect, EffectCtx, EnemyState, Frame, PendingChoice, Uid } from './types';

export class RunawayTriggersError extends Error {
  constructor(count: number) {
    super(`RunawayTriggers: more than ${count} triggers in one step`);
    this.name = 'RunawayTriggersError';
  }
}

/** Runs an effect list to completion (or until a pending choice). */
export function runEffects(rt: Rt, effects: readonly Effect[], ctx: EffectCtx): 'done' | 'pending' {
  return runFrames(rt, [{ effects: effects as Effect[], pc: 0, ctx }]);
}

export function runFrames(rt: Rt, stack: Frame[]): 'done' | 'pending' {
  while (stack.length > 0) {
    const f = stack[stack.length - 1]!;
    if (f.pc >= f.effects.length) {
      stack.pop();
      continue;
    }
    const eff = f.effects[f.pc]!;
    f.pc++;
    if (eff.op === 'if') {
      const branch = evalCond(rt, eff.cond, f.ctx) ? eff.then : eff.else;
      // Branch frames share the ctx object so hit results (suppressedTarget) are visible to later effects.
      if (branch && branch.length > 0) stack.push({ effects: branch, pc: 0, ctx: f.ctx });
      continue;
    }
    if (execEffect(rt, eff, f.ctx, stack)) return 'pending';
    settle(rt);
  }
  return 'done';
}

export function enqueue(rt: Rt, t: Trigger): void {
  rt.queue.push(t);
}

/** Drains the trigger queue FIFO. Nested calls while draining are no-ops unless forced (R-8b win check). */
export function drain(rt: Rt, force = false): void {
  if (rt.draining && !force) return;
  const was = rt.draining;
  rt.draining = true;
  try {
    while (rt.queue.length > 0) {
      const t = rt.queue.shift()!;
      rt.triggerCount++;
      if (rt.triggerCount > rt.rules.triggerCap) throw new RunawayTriggersError(rt.rules.triggerCap);
      let owner: EnemyState | undefined;
      if (t.enemyUid !== undefined) {
        owner = findEnemy(rt, t.enemyUid);
        if (!owner) continue;
        if (t.onceKey && owner.memory[t.onceKey]) continue;
      }
      if (t.cond && !evalCond(rt, t.cond, t.ctx)) continue;
      if (owner && t.onceKey) owner.memory[t.onceKey] = 1;
      runFrames(rt, [{ effects: t.effects as Effect[], pc: 0, ctx: t.ctx }]);
      refreshIntents(rt);
    }
  } finally {
    rt.draining = was;
  }
}

/** After each effect: queued triggers run, then every intent re-derives (overrides, byFace, phases). */
export function settle(rt: Rt): void {
  drain(rt);
  refreshIntents(rt);
}

// ---------------------------------------------------------------------------------------------------

function guardFromCtx(rt: Rt, ctx: EffectCtx, base: number): number {
  const trembling = (rt.c.player.statuses[ST.trembling] ?? 0) >= 1;
  const fromCard = ctx.source === 'card' || ctx.source === 'mood' || ctx.source === 'promise';
  return computeGuard(base, { fromCard, trembling }, rt.rules);
}

function targetsForAll(rt: Rt, ctx: EffectCtx): EnemyState[] {
  if (ctx.source === 'enemy') return rt.c.enemies.slice();
  return rt.c.enemies.filter((e) => !isVeiled(e));
}

/** Executes one non-control effect. Returns true if it opened a pending choice (execution stops). */
function execEffect(rt: Rt, eff: Effect, ctx: EffectCtx, stack: Frame[]): boolean {
  const actor = actorEnemy(rt, ctx);
  const enemySide = ctx.source === 'enemy';
  switch (eff.op) {
    case 'hit':
      if (!enemySide) hitEffect(rt, eff, ctx);
      return false;
    case 'guard': {
      const n = evalAmount(rt, eff.amount, ctx);
      if (enemySide) {
        if (actor) addEnemyGuard(rt, actor, n);
      } else addPlayerGuard(rt, guardFromCtx(rt, ctx, n));
      return false;
    }
    case 'mend': {
      const n = evalAmount(rt, eff.amount, ctx);
      const toSelf = eff.to === 'self' || (eff.to === undefined && enemySide);
      if (toSelf && enemySide) {
        if (actor) mendEnemy(rt, actor, n);
      } else mendPlayer(rt, n);
      return false;
    }
    case 'status': {
      const n = evalAmount(rt, eff.stacks, ctx);
      forStatusTargets(rt, eff.to, ctx, (owner) => giveStatus(rt, owner, eff.id, n));
      return false;
    }
    case 'setStatus':
      forStatusTargets(rt, eff.to, ctx, (owner) => setStatusOn(rt, owner, eff.id, eff.n));
      return false;
    case 'clearStatus':
      forStatusTargets(rt, eff.to, ctx, (owner) => setStatusOn(rt, owner, eff.id, 0));
      return false;
    case 'draw':
      drawCards(rt, Math.max(0, evalAmount(rt, eff.n, ctx)));
      return false;
    case 'energy':
      addEnergy(rt, evalAmount(rt, eff.n, ctx));
      return false;
    case 'summon':
      summonCompanion(rt, eff.companion);
      return false;
    case 'companionsAct':
      companionsAct(rt);
      return false;
    case 'promise':
      addPromise(rt, {
        dueTurn: rt.c.turn + 1,
        effects: eff.effects,
        lights: ctx.lights.slice(),
        targetUid: ctx.targetUid,
        sourceUid: ctx.sourceUid,
      });
      return false;
    case 'nextCardFree':
      rt.c.turnFlags.centerActive = true;
      return false;
    case 'fetchBuried':
      return openChoice(rt, 'toHand', buriedChoiceOptions(rt, 'toHand'), ctx, stack);
    case 'tendAny':
      return openChoice(rt, 'tend', buriedChoiceOptions(rt, 'tend'), ctx, stack);
    case 'removeAfflictions':
      for (const id of Object.keys(rt.c.player.statuses)) {
        if (id !== ST.numb && isAffliction(rt, id)) setStatusOn(rt, 'player', id, 0);
      }
      return false;
    case 'lingerHand':
      for (const uid of rt.c.piles.hand) {
        const card = rt.c.cards[uid]!;
        const def = rt.pack.cards[card.defId];
        if (def && def.kind !== 'buried' && !def.buried) card.mem.lingerThisTurn = true;
      }
      return false;
    case 'strike':
      if (actor) strikeEffect(rt, actor, eff, ctx);
      return false;
    case 'afflict':
      giveStatus(rt, 'player', eff.id, eff.stacks);
      return false;
    case 'spawn':
      if (actor) spawnFrom(rt, actor, eff.enemy, eff.max);
      return false;
    case 'scatter':
      scatterCompanions(rt, eff.n);
      return false;
    case 'mark':
      if (actor) actor.memory[eff.key] = 1;
      return false;
    case 'unmark':
      if (actor) delete actor.memory[eff.key];
      return false;
    case 'custom':
      throw new Error(`Unknown custom hook '${eff.id}' (CUSTOM_HOOK_IDS is empty in v1)`);
    case 'if':
      return false;
  }
}

function forStatusTargets(
  rt: Rt,
  to: 'player' | 'target' | 'all' | 'self',
  ctx: EffectCtx,
  fn: (owner: 'player' | EnemyState) => void,
): void {
  if (to === 'player') return fn('player');
  if (to === 'self') {
    if (ctx.source === 'enemy') {
      const a = actorEnemy(rt, ctx);
      if (a) fn(a);
    } else fn('player');
    return;
  }
  if (to === 'target') {
    const t = findEnemy(rt, ctx.targetUid);
    if (t) fn(t);
    return;
  }
  for (const e of targetsForAll(rt, ctx)) if (findEnemy(rt, e.uid)) fn(e);
}

/** 5.5: per strike max(0, base + Flare - Hush); Guard absorbs; the Heart-0 check is immediate. */
function strikeEffect(rt: Rt, e: EnemyState, eff: Extract<Effect, { op: 'strike' }>, ctx: EffectCtx): void {
  const base = evalAmount(rt, eff.amount, ctx);
  const times = eff.times === undefined ? 1 : Math.max(0, evalAmount(rt, eff.times, ctx));
  const per = computeStrike(base, e.statuses.flare ?? 0, e.statuses.hush ?? 0);
  for (let i = 0; i < times; i++) {
    if (!findEnemy(rt, e.uid)) return;
    const r = strikePlayer(rt, e.uid, per);
    if (r.hpLoss > 0 && rt.move) rt.move.lostHeart = true;
    checkHeart(rt);
  }
}

/** Opens a pending choice (2+ options, while a card is being played) or resolves it directly. */
function openChoice(rt: Rt, purpose: PendingChoice['purpose'], options: Uid[], ctx: EffectCtx, stack: Frame[]): boolean {
  if (options.length === 0) return false;
  const canPend = options.length >= 2 && rt.play !== null && ctx.source === 'card' && !rt.draining;
  if (!canPend) {
    resolveChoicePick(rt, purpose, options[0]!);
    return false;
  }
  drain(rt);
  const play = rt.play!;
  rt.c.pending = {
    purpose,
    options,
    continuation: stack.slice(),
    play: { ...play, lights: play.lights.slice(), hit: play.hit.slice() },
  };
  emit(rt, { e: 'pending', purpose, options: options.slice() });
  return true;
}
