// Public API of the combat module, consumed by src/engine/step.ts and src/engine/index.ts (run side).
// OWNER: Engine-Combat agent. Signatures are the contract.

import type {
  Action,
  CardId,
  CombatResult,
  CombatState,
  EncounterId,
  EngineCtx,
  GameState,
  HandHint,
  IntentView,
  Preview,
  StepResult,
  Uid,
} from '../types';
import { IllegalActionError } from '../types';
import { buildResult } from './finish';
import { checkPlay, legalActionsOf } from './legal';
import { playCard, resumeChoice } from './play';
import { previewAction } from './preview';
import { CombatOver, createRt } from './runtime';
import { startCombatState } from './setup';
import { describeDef } from './text';
import { endTurn } from './turn';
import { cardTextView, handHintsView, intentsView } from './view';

export interface CombatStartSpec {
  encounter: EncounterId;
  /** Pre-rolled Intensity per member (index-aligned). If omitted, rolled from nodeSeed. */
  hps?: number[];
  nodeId: number | null;
  /** Node seed; combat streams are hash32(nodeSeed, 'shuffle') and hash32(nodeSeed, 'ai'). */
  nodeSeed: number;
  tier: CombatState['tier'];
}

/**
 * DESIGN 5.1 + the first 5.2. Returns a state with phase { kind: 'combat', nodeId } and `combat` set.
 * Reads run.deck, run.keepsakes, run.heart (read-only). Performs Surfacing for numb-rules bosses.
 */
export function startCombat(s: GameState, ctx: EngineCtx, spec: CombatStartSpec): StepResult {
  return startCombatState(s, ctx, spec);
}

/** Legal combat actions in canonical order: plays (hand order, then targets left to right, Inward last), endTurn. */
export function combatLegalActions(s: GameState, ctx: EngineCtx): Action[] {
  if (!s.combat) return [];
  return legalActionsOf(createRt(s, ctx, { readonly: true }));
}

/**
 * Handles 'play' | 'endTurn' | 'choose' | 'confirm'. Never touches run state.
 * When the combat ends, sets combat.outcome ('won' | 'lost') and returns; the caller finishes it with
 * buildCombatResult and moves to the next phase.
 */
export function stepCombat(s: GameState, ctx: EngineCtx, a: Action): StepResult {
  const c = s.combat;
  if (!c) throw new IllegalActionError('No combat in progress', a);
  if (c.outcome) throw new IllegalActionError('The combat is over', a);
  const rt = createRt(s, ctx);
  try {
    switch (a.t) {
      case 'play':
        playCard(rt, checkPlay(rt, a), a.inward ? null : (a.target ?? null), a.inward === true);
        break;
      case 'endTurn':
        if (rt.c.pending) throw new IllegalActionError('A choice is pending', a);
        endTurn(rt);
        break;
      case 'choose':
        if (!rt.c.pending || !rt.c.pending.options.includes(a.uid)) throw new IllegalActionError('Not a pending option', a);
        resumeChoice(rt, a.uid);
        break;
      default:
        // 'confirm' is not used in combat: every choice is a single pick that resolves at once.
        throw new IllegalActionError(`Action '${a.t}' is not legal in combat`, a);
    }
  } catch (err) {
    if (!(err instanceof CombatOver)) throw err;
  }
  return { state: { ...s, nextUid: rt.nextUid, combat: rt.c }, events: rt.events, revealedHiddenInfo: rt.revealed };
}

/** 'play' and 'endTurn' previews (the real interpreter on a clone, sealed RNG). */
export function previewCombat(s: GameState, ctx: EngineCtx, a: Action): Preview | null {
  return previewAction(s, ctx, a);
}

/** Only valid once combat.outcome is set. glimmers includes the tier base plus Resolve bonuses. */
export function buildCombatResult(s: GameState, ctx: EngineCtx): CombatResult {
  if (!s.combat) throw new Error('buildCombatResult: no combat');
  return buildResult(s.combat, s.run, ctx);
}

/** Displayed intents (M2: projected after your end-of-turn steps). */
export function intents(s: GameState, ctx: EngineCtx): IntentView[] {
  return intentsView(s, ctx);
}

export function handHints(s: GameState, ctx: EngineCtx): HandHint[] {
  return handHintsView(s, ctx);
}

/** Rules text of a combat card with slots filled in context. */
export function cardText(s: GameState, ctx: EngineCtx, uid: Uid, target?: Uid): string {
  return cardTextView(s, ctx, uid, target);
}

/** Rules text of a card definition outside combat, slots filled with base numbers. */
export function describeCard(ctx: EngineCtx, defId: CardId, upgraded: boolean, weight?: number): string {
  const def = ctx.pack.cards[defId];
  if (!def) throw new Error(`Unknown card ${defId}`);
  return describeDef(ctx, def, upgraded, weight);
}
