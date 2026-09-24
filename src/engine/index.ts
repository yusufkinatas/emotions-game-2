// The engine's public surface (DESIGN 20.2): createEngine plus every type and helper UI and sim use.
// UI and sim import the engine only from here.

import {
  cardText as combatCardText,
  describeCard as combatDescribeCard,
  handHints as combatHandHints,
  intents as combatIntents,
  previewCombat,
} from './combat/index';
import { checkInvariants } from './invariants';
import { resolveRules } from './rules';
import { debugSetHand, debugStartCombat } from './run/debug';
import { eventOptions } from './run/events';
import { havenOptions } from './run/haven';
import { newRunState } from './run/newRun';
import { deckSummary, nodeDetail } from './run/view';
import { computeContentHash, deserializeState, hashState, serializeState } from './serialize';
import { legalActions, settleState, stepGame } from './step';
import type { Action, ContentPack, Engine, EngineCtx, GameState, RulesConfig } from './types';

export * from './types';
export {
  AFFLICTIONS,
  AFFLICTION_CURE,
  AFFLICTION_OF,
  BLENDS,
  LIGHTS,
  SHADES,
  across,
  adjacent,
  afflictionSoothedBy,
  blendOf,
  blendOfLights,
  cureOf,
  dissonantLightOf,
  dissonantShadeOf,
  harmonize,
  isLight,
  isShade,
  lethalOutcome,
  lightIndex,
  lightsOfBlend,
  relationOf,
  shadeCuredBy,
  shadeIndex,
} from './emotions';
export type { HarmonyOpts, RelationOpts, RelationPcts, TargetTyping } from './emotions';
export {
  computeGuard,
  computeHit,
  computeMend,
  computeStrike,
  recombine,
  resolveStrikes,
  showingFace,
  typingOf,
} from './damage';
export type { HitSpec, HitTarget } from './damage';
export { DEFAULT_RULES, resolveRules } from './rules';
// Seeded PRNG for sim bots and tools (DESIGN 20.5); the engine's own streams stay internal.
export { Rng, hash32, rngFrom } from './rng';
export { assertInvariants, checkInvariants } from './invariants';
export { canonicalJson } from './serialize';
/** EnemyState.memory key for The Mask's remaining hit-turns (the combat UI reads it for its tooltip). */
export { MEM_TURNS_LEFT } from './constants';
export { sameAction } from './step';

const inCombat = (s: GameState): boolean => s.phase.kind === 'combat' && s.combat !== null;

function legalOrError(s: GameState, ctx: EngineCtx): Action[] | Error {
  try {
    return legalActions(s, ctx);
  } catch (err) {
    return err instanceof Error ? err : new Error(String(err));
  }
}

export function createEngine(pack: ContentPack, rules?: Partial<RulesConfig>): Engine {
  const ctx: EngineCtx = { pack, rules: resolveRules(pack.rules, rules) };
  const contentHash = computeContentHash(pack, ctx.rules);
  return {
    pack,
    rules: ctx.rules,
    newRun: (seed, opts = {}) =>
      settleState(newRunState(ctx, seed, opts, contentHash, { ctx, events: [], revealed: false }), ctx),
    legalActions: (s) => legalActions(s, ctx),
    step: (s, a) => stepGame(s, ctx, a),
    preview: (s, a) => (inCombat(s) && (a.t === 'play' || a.t === 'endTurn') ? previewCombat(s, ctx, a) : null),
    intents: (s) => (inCombat(s) ? combatIntents(s, ctx) : []),
    handHints: (s) => (inCombat(s) ? combatHandHints(s, ctx) : []),
    cardText: (s, uid, target) => {
      if (inCombat(s) && s.combat!.cards[uid]) return combatCardText(s, ctx, uid, target);
      const c = s.run.deck.find((x) => x.uid === uid);
      return c ? combatDescribeCard(ctx, c.defId, c.upgraded, c.weight) : '';
    },
    describeCard: (defId, upgraded, weight) => combatDescribeCard(ctx, defId, upgraded, weight),
    nodeDetail: (s, nodeId) => nodeDetail(s, ctx, nodeId),
    deckSummary: (s) => deckSummary(s, ctx),
    eventOptions: (s) => eventOptions(s, ctx),
    havenOptions: (s) => (s.phase.kind === 'haven' ? havenOptions(s, ctx) : []),
    checkInvariants: (s) => checkInvariants(s, ctx, legalOrError(s, ctx)),
    hash: hashState,
    serialize: serializeState,
    deserialize: (json) => deserializeState(json, contentHash),
    debug: {
      startCombat: (s, e) => settleState(debugStartCombat(s, ctx, e), ctx),
      setHand: (s, ids) => debugSetHand(s, ctx, ids),
    },
  };
}
