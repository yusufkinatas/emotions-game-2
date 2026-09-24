// Public API of the combat module, consumed by src/engine/step.ts and src/engine/index.ts (run side).
// OWNER: Engine-Combat agent. Signatures are the contract; bodies are stubs until implemented.

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

export interface CombatStartSpec {
  encounter: EncounterId;
  /** Pre-rolled Intensity per member (index-aligned). If omitted, rolled from nodeSeed. */
  hps?: number[];
  nodeId: number | null;
  /** Node seed; combat streams are hash32(nodeSeed, 'shuffle') and hash32(nodeSeed, 'ai'). */
  nodeSeed: number;
  tier: CombatState['tier'];
}

const todo = (name: string): never => {
  throw new Error(`combat.${name} not implemented`);
};

/**
 * DESIGN 5.1 + the first 5.2. Returns a state with phase { kind: 'combat', nodeId } and `combat` set.
 * Reads run.deck, run.keepsakes, run.heart (read-only). Performs Surfacing for numb-rules bosses.
 */
export function startCombat(s: GameState, ctx: EngineCtx, spec: CombatStartSpec): StepResult {
  void s; void ctx; void spec;
  return todo('startCombat');
}

/** Legal combat actions in canonical order: plays (hand order, then targets left to right, Inward last), endTurn. */
export function combatLegalActions(s: GameState, ctx: EngineCtx): Action[] {
  void s; void ctx;
  return todo('combatLegalActions');
}

/**
 * Handles 'play' | 'endTurn' | 'choose' | 'confirm'. Never touches run state.
 * When the combat ends, sets combat.outcome ('won' | 'lost') and returns; the caller finishes it with
 * buildCombatResult and moves to the next phase.
 */
export function stepCombat(s: GameState, ctx: EngineCtx, a: Action): StepResult {
  void s; void ctx; void a;
  return todo('stepCombat');
}

/** 'play' and 'endTurn' previews (the real interpreter on a clone, sealed RNG). */
export function previewCombat(s: GameState, ctx: EngineCtx, a: Action): Preview | null {
  void s; void ctx; void a;
  return todo('previewCombat');
}

/** Only valid once combat.outcome is set. glimmers includes the tier base plus Resolve bonuses. */
export function buildCombatResult(s: GameState, ctx: EngineCtx): CombatResult {
  void s; void ctx;
  return todo('buildCombatResult');
}

/** Displayed intents (M2: projected after your end-of-turn steps). */
export function intents(s: GameState, ctx: EngineCtx): IntentView[] {
  void s; void ctx;
  return todo('intents');
}

export function handHints(s: GameState, ctx: EngineCtx): HandHint[] {
  void s; void ctx;
  return todo('handHints');
}

/** Rules text of a combat card with slots filled in context. */
export function cardText(s: GameState, ctx: EngineCtx, uid: Uid, target?: Uid): string {
  void s; void ctx; void uid; void target;
  return todo('cardText');
}

/** Rules text of a card definition outside combat, slots filled with base numbers. */
export function describeCard(ctx: EngineCtx, defId: CardId, upgraded: boolean, weight?: number): string {
  void ctx; void defId; void upgraded; void weight;
  return todo('describeCard');
}
