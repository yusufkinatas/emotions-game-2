// Run flow (DESIGN 3.2, 15): entering nodes, finishing combats, act transitions, The Deep, victory, defeat.

import { buildCombatResult, startCombat } from '../combat/index';
import { hash32 } from '../rng';
import type { CombatState, EngineCtx, GameState, MapNode, RewardOffer, RulesConfig } from '../types';
import { cloneJson } from './clone';
import { enterEvent, runRunEffects } from './events';
import { applyCombatResult } from './finishCombat';
import { generateActMap, generateDeepMap, reachableNodes } from './map';
import { chestReward, combatReward, rollWheelCloses } from './rewards';
import { rollShopStock } from './shop';
import { hasFlag, nodeById, type StepScratch } from './state';

/** Spiral Shell's between-act Mend (minor-26). Read from rules when present so a RulesConfig field can take over. */
const DEFAULT_SHELL_ACT_MEND_PCT = 50;
const shellActMendPct = (rules: RulesConfig): number =>
  (rules as RulesConfig & { shellActMendPct?: number }).shellActMendPct ?? DEFAULT_SHELL_ACT_MEND_PCT;

const TUTORIAL_ROWS = 4;

export function nodeTier(d: GameState, node: MapNode): CombatState['tier'] {
  if (node.kind === 'elite') return 'elite';
  if (node.kind === 'boss') return d.run.act === 3 ? 'final' : 'boss';
  if (d.run.tutorial && d.run.act === 1 && node.row <= TUTORIAL_ROWS) return 'tutorial';
  return 'normal';
}

function startNodeCombat(d: GameState, sc: StepScratch, node: MapNode): GameState {
  if (!node.encounter) throw new Error(`Map node ${node.id} has no encounter`);
  const r = startCombat(d, sc.ctx, {
    encounter: node.encounter.id,
    hps: [...node.encounter.hps],
    nodeId: node.id,
    nodeSeed: node.seed,
    tier: nodeTier(d, node),
  });
  sc.events.push(...r.events);
  sc.revealed = true;
  return r.state;
}

/** Move onto a node and resolve what it holds. */
export function enterNode(d: GameState, sc: StepScratch, nodeId: number): GameState {
  const node = nodeById(d.run, nodeId);
  if (!node) throw new Error(`Unknown map node ${nodeId}`);
  const ctx = sc.ctx;
  d.run.map.current = nodeId;
  d.run.map.visited.push(nodeId);
  d.run.floor += 1;
  d.run.stats.floors = d.run.floor;
  sc.revealed = true;
  switch (node.kind) {
    case 'fight':
    case 'elite':
    case 'boss':
      return startNodeCombat(d, sc, node);
    case 'chest':
      d.phase = { kind: 'reward', offer: chestReward(d, ctx, node.seed) };
      return d;
    case 'sanctuary':
      d.phase = { kind: 'shop', stock: rollShopStock(d, ctx, node.seed, d.run.act === 3) };
      return d;
    case 'haven':
      d.phase = { kind: 'haven' };
      return d;
    case 'memory':
      enterEvent(d, ctx, node);
      return d;
  }
}

export function toMap(d: GameState): void {
  d.phase = { kind: 'map' };
}

/**
 * Called once combat.outcome is set: builds the CombatResult, applies it to the run, then goes to the reward
 * screen (and the event branch for RunEffect 'combat') or to defeat. combat becomes null.
 */
export function finishCombat(s: GameState, sc: StepScratch): GameState {
  const combat = s.combat!;
  const result = buildCombatResult(s, sc.ctx);
  if (!sc.events.some((e) => e.e === 'combatEnd')) sc.events.push({ e: 'combatEnd', outcome: result.outcome });
  const d: GameState = {
    ...s,
    run: cloneJson(s.run),
    eventCombat: null,
    combat: null,
    phase: { kind: 'map' },
  };
  const eventCombat = cloneJson(s.eventCombat);
  applyCombatResult(d, sc.ctx, result);
  sc.revealed = true;
  if (result.outcome === 'lost' || d.run.heart <= 0) {
    d.phase = { kind: 'defeat', cause: combat.lossCause ?? 'heart' };
    return d;
  }
  const node = nodeById(d.run, combat.nodeId);
  const base = node ? node.seed : hash32(d.seed, 'reward', d.run.floor, d.run.stats.combats);
  const rewardSeed = eventCombat ? hash32(base, 'eventCombat') : base;
  d.phase = { kind: 'reward', offer: combatReward(d, sc.ctx, result, combat, rewardSeed) };
  if (eventCombat) {
    const branch = result.allResolved ? eventCombat.onResolve : eventCombat.onSuppress;
    return runRunEffects(d, sc, branch, hash32(rewardSeed, 'branch'));
  }
  return d;
}

/** 12.4 / 15.1: Mend to full between acts, or 50% of missing Heart with Spiral Shell. */
export function actMend(d: GameState, ctx: EngineCtx): void {
  if (!ctx.rules.bossMendToFull) return;
  const missing = d.run.maxHeart - d.run.heart;
  if (hasFlag(d.run, ctx, 'halfActMend')) d.run.heart += Math.floor((missing * shellActMendPct(ctx.rules)) / 100);
  else d.run.heart = d.run.maxHeart;
}

export function enterAct2(d: GameState, ctx: EngineCtx): void {
  d.run.act = 2;
  d.run.map = generateActMap(ctx, d.seed, 2, false);
  toMap(d);
}

/**
 * 15.1: after the "The Deep" title card the run goes straight into the Deep's Sanctuary (3.2 step 5 and 15.1
 * name the Sanctuary, where Act 2 names its map). The map shows up after leaving it, like the tutorial start.
 */
export function enterDeep(d: GameState, sc: StepScratch): GameState {
  d.run.act = 3;
  d.run.map = generateDeepMap(sc.ctx, d.seed);
  const first = reachableNodes(d.run.map)[0];
  if (first === undefined) {
    toMap(d);
    return d;
  }
  return enterNode(d, sc, first);
}

/** 15.3: the ending follows how The Numbness left. */
export function victoryEnding(offer: RewardOffer, ctx: EngineCtx): 'resolved' | 'suppressed' {
  const resolvedOutcome = (o: string): boolean => o === 'resolve' || o === 'deepResolve';
  const final = offer.outcomes.find((g) => ctx.pack.enemies[g.defId]?.tier === 'final');
  if (final) return resolvedOutcome(final.outcome) ? 'resolved' : 'suppressed';
  return offer.outcomes.length > 0 && offer.outcomes.every((g) => resolvedOutcome(g.outcome)) ? 'resolved' : 'suppressed';
}

/** 'continue' on the reward screen. Returns the state to continue with. */
export function continueFromReward(d: GameState, sc: StepScratch): GameState {
  if (d.phase.kind !== 'reward') return d;
  const ctx = sc.ctx;
  const offer = d.phase.offer;
  switch (offer.then) {
    case 'map':
      toMap(d);
      return d;
    case 'wheelCloses':
      actMend(d, ctx);
      d.phase = { kind: 'wheelCloses', options: rollWheelCloses(ctx, d.seed) };
      return d;
    case 'deep':
      actMend(d, ctx);
      return enterDeep(d, sc);
    case 'victory':
      d.phase = { kind: 'victory', ending: victoryEnding(offer, ctx) };
      return d;
  }
}
