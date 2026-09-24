// Memories (DESIGN 10): event choice, option availability, and the RunEffect interpreter.

import { startCombat } from '../combat/index';
import { hash32, rngFrom } from '../rng';
import type {
  CmpOp,
  EngineCtx,
  EventId,
  EventOptionView,
  GameState,
  MapNode,
  RunCond,
  RunEffect,
} from '../types';
import { isBuried, isUpgradable, randomCardPool } from './cards';
import { catalog } from './catalog';
import { cloneJson } from './clone';
import { addBuried, addCard, upgradeCard } from './deck';
import { LEAD_BOX_NO_TEND, openDeckSelect, selectOptions } from './deckSelect';
import { drawPoolKeepsake, EXHAUSTED_GLIMMERS, grantKeepsake } from './keepsakes';
import { rollEncounterHps } from './map';
import { cardAct, cardDef, currentNode, hasFlag, ownsKeepsake, type StepScratch } from './state';

export const NOT_ENOUGH_HEART = 'Not enough Heart';
const REQUIREMENT_FALLBACK = 'Not possible right now.';

function cmp(a: number, op: CmpOp, b: number): boolean {
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

type AnyRunCond = RunCond | { c: 'lastPaid'; op: CmpOp; n: number };

export function evalRunCond(d: GameState, ctx: EngineCtx, cond: AnyRunCond): boolean {
  const run = d.run;
  switch (cond.c) {
    case 'glimmers':
      return cmp(run.glimmers, cond.op, cond.n);
    case 'heart':
      return cmp(run.heart, cond.op, cond.n);
    case 'buriedCount':
      return cmp(run.deck.filter((c) => isBuried(cardDef(ctx, c.defId))).length, cond.op, cond.n);
    case 'upgradable':
      return cmp(run.deck.filter((c) => isUpgradable(c, cardDef(ctx, c.defId))).length, cond.op, cond.n);
    case 'lightCount':
      return cmp(run.deck.filter((c) => cardDef(ctx, c.defId).lights.includes(cond.light)).length, cond.op, cond.n);
    case 'hasKeepsake':
      return ownsKeepsake(run, cond.id);
    case 'act':
      return cmp(run.act, cond.op, cond.n);
    case 'lastSelectedKind': {
      const id = run.lastSelected;
      return id != null && ctx.pack.cards[id]?.kind === cond.kind;
    }
    case 'lastPaid':
      return cmp(run.lastPaid, cond.op, cond.n);
    case 'not':
      return !evalRunCond(d, ctx, cond.of);
  }
}

/** Largest Heart an option can cost (an 'if' counts its costlier branch). */
export function heartCost(effects: readonly RunEffect[]): number {
  let total = 0;
  for (const e of effects) {
    if (e.op === 'heart' && e.n < 0) total += -e.n;
    else if (e.op === 'if') total += Math.max(heartCost(e.then), heartCost(e.else ?? []));
  }
  return total;
}

/**
 * The effects an option would run, following each 'if' by the current state. Combat branches are not
 * followed (they depend on the fight). Used only to tell whether an option leads to a Tend.
 */
function plannedEffects(d: GameState, ctx: EngineCtx, effects: readonly RunEffect[]): RunEffect[] {
  const out: RunEffect[] = [];
  for (const e of effects) {
    if (e.op === 'if') out.push(...plannedEffects(d, ctx, evalRunCond(d, ctx, e.cond) ? e.then : (e.else ?? [])));
    else out.push(e);
  }
  return out;
}

/**
 * Lead Box forbids Tending (4.10), so an option that would Tend (The Unsent Letter's "Read it aloud" with a
 * Buried card) is disabled with the reason instead of taking its Heart cost for nothing (10).
 */
function tendBlocked(d: GameState, ctx: EngineCtx, effects: readonly RunEffect[]): boolean {
  return (
    hasFlag(d.run, ctx, 'leadBox') &&
    plannedEffects(d, ctx, effects).some((e) => e.op === 'deckSelect' && e.purpose === 'tend')
  );
}

export function eventOptions(d: GameState, ctx: EngineCtx): EventOptionView[] {
  if (d.phase.kind !== 'event') return [];
  const def = ctx.pack.events[d.phase.eventId];
  if (!def) return [];
  return def.options.map((o) => {
    let reason: string | null = null;
    if (o.requires && !evalRunCond(d, ctx, o.requires)) reason = o.requiresText ?? REQUIREMENT_FALLBACK;
    else if (heartCost(o.effects) > 0 && heartCost(o.effects) >= d.run.heart) reason = NOT_ENOUGH_HEART;
    else if (tendBlocked(d, ctx, o.effects)) reason = LEAD_BOX_NO_TEND;
    return { label: o.label, result: o.result, enabled: reason === null, reason };
  });
}

/** An unused event (uniform, node event stream); the fallback once all are used. Marks it used. */
export function pickEvent(d: GameState, ctx: EngineCtx, node: MapNode): EventId {
  const fallback = ctx.pack.fallbackEvent;
  const pool = catalog(ctx.pack).events.filter((id) => id !== fallback && !d.run.usedEvents.includes(id));
  const id = pool.length > 0 ? rngFrom(node.seed, 'event').pick(pool) : fallback;
  if (!d.run.usedEvents.includes(id)) d.run.usedEvents.push(id);
  return id;
}

export function enterEvent(d: GameState, ctx: EngineCtx, node: MapNode): void {
  d.phase = { kind: 'event', eventId: pickEvent(d, ctx, node), chosen: null };
}

/** Seed for the effects of option i at the current node. */
export function optionSeed(d: GameState, i: number): number {
  const node = currentNode(d.run);
  return hash32(node ? node.seed : hash32(d.seed, 'event', d.run.floor), 'event', i);
}

export function chooseOption(d: GameState, sc: StepScratch, i: number): GameState {
  if (d.phase.kind !== 'event') return d;
  const def = sc.ctx.pack.events[d.phase.eventId];
  const opt = def?.options[i];
  d.phase = { kind: 'event', eventId: d.phase.eventId, chosen: i };
  return opt ? runRunEffects(d, sc, opt.effects, optionSeed(d, i)) : d;
}

function changeHeart(d: GameState, n: number): void {
  if (n >= 0) {
    d.run.heart = Math.min(d.run.maxHeart, d.run.heart + n);
    return;
  }
  const loss = Math.min(d.run.heart, -n);
  d.run.heart -= loss;
  d.run.stats.heartLost += loss;
}

/**
 * Runs RunEffects in order against the draft. Stops (and stores the rest) at a deckSelect that has options,
 * or at a combat. Returns the state to continue with (a new object when a combat started).
 * The phase to land on afterwards must already be set on `d` by the caller.
 */
export function runRunEffects(d: GameState, sc: StepScratch, effects: readonly RunEffect[], seed: number): GameState {
  const ctx = sc.ctx;
  const rng = rngFrom(seed, 'fx');
  const queue: RunEffect[] = cloneJson([...effects]);
  let step = 0;
  while (queue.length > 0) {
    const e = queue.shift()!;
    step += 1;
    switch (e.op) {
      case 'heart':
        changeHeart(d, e.n);
        break;
      case 'maxHeart':
        d.run.maxHeart = Math.max(1, d.run.maxHeart + e.n);
        if (e.n > 0) d.run.heart += e.n;
        d.run.heart = Math.min(d.run.heart, d.run.maxHeart);
        break;
      case 'glimmers':
        d.run.glimmers = Math.max(0, d.run.glimmers + e.n);
        break;
      case 'payAll':
        d.run.lastPaid = d.run.glimmers;
        d.run.glimmers = 0;
        break;
      case 'addCard':
        if (typeof e.card === 'string') addCard(d, ctx, e.card, false);
        else {
          const pool = randomCardPool(ctx, e.card.random, cardAct(d.run));
          if (pool.length > 0) addCard(d, ctx, rng.pick(pool).id, e.card.upgraded);
          sc.revealed = true;
        }
        break;
      case 'addBuried':
        addBuried(d, ctx, e.shade);
        break;
      case 'upgradeRandom': {
        const cands = selectOptions(d, ctx, 'upgrade', e.filter);
        for (const uid of rng.shuffle(cands).slice(0, e.n)) upgradeCard(d, uid);
        sc.revealed = true;
        break;
      }
      case 'deckSelect': {
        d.run.lastSelected = null;
        const options = selectOptions(d, ctx, e.purpose, e.filter);
        if (options.length === 0) break;
        openDeckSelect(d, e.purpose, options, d.phase, false, {
          kind: 'effects',
          continuation: queue,
          seed: hash32(seed, 'cont', step),
        });
        return d;
      }
      case 'keepsake': {
        const id =
          typeof e.id === 'string' ? e.id : drawPoolKeepsake(d.run, ctx, rng, e.id.randomRarity);
        if (id === null) d.run.glimmers += EXHAUSTED_GLIMMERS;
        else grantKeepsake(d, ctx, id);
        break;
      }
      case 'combat':
        return startEventCombat(d, sc, e, queue, hash32(seed, 'combat', step));
      case 'if':
        queue.unshift(...(evalRunCond(d, ctx, e.cond) ? e.then : (e.else ?? [])));
        break;
    }
    if (d.run.heart <= 0) {
      d.phase = { kind: 'defeat', cause: 'heart' };
      return d;
    }
  }
  return d;
}

/** RunEffect 'combat' (The Wishing Well's Echo): no card reward; its branch runs after the fight. */
function startEventCombat(
  d: GameState,
  sc: StepScratch,
  e: Extract<RunEffect, { op: 'combat' }>,
  rest: RunEffect[],
  nodeSeed: number,
): GameState {
  d.eventCombat = { onResolve: [...e.onResolve, ...rest], onSuppress: [...e.onSuppress, ...rest] };
  const node = currentNode(d.run);
  const hps = rollEncounterHps(sc.ctx, e.encounter, rngFrom(nodeSeed, 'enc'));
  const r = startCombat(d, sc.ctx, { encounter: e.encounter, hps, nodeId: node?.id ?? null, nodeSeed, tier: 'event' });
  sc.events.push(...r.events);
  sc.revealed = true;
  return r.state;
}
