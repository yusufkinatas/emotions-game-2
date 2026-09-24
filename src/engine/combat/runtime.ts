// The mutable working context of one combat reducer step (or one preview). Created on a clone of the
// input state; the input is never written to. Read-only runtimes wrap the input directly for queries.

import { cloneCombat } from '../clone';
import { DEFAULT_MAX } from '../constants';
import type {
  CardDef,
  CombatCard,
  CombatState,
  Cond,
  ContentPack,
  Effect,
  EffectCtx,
  EnemyDef,
  EnemyState,
  EngineCtx,
  GameEvent,
  GameState,
  KeepsakeFlag,
  Light,
  RulesConfig,
  RunState,
  Shade,
  StatusBag,
  StatusDef,
  StatusId,
  Uid,
} from '../types';

/** Thrown when combat.outcome has been set: the rest of the step does not run (R-8b, 5.5). */
export class CombatOver {
  readonly kind = 'combatOver';
}
/** Thrown in sealed (preview) mode when hidden information would be revealed (a draw or a shuffle). */
export class SealedStop {
  readonly kind = 'sealed';
}
export const COMBAT_OVER = new CombatOver();
export const SEALED_STOP = new SealedStop();

/** A queued trigger (Afterglow, passive, Keepsake hook, Mood). Runs FIFO after the current effect. */
export interface Trigger {
  effects: readonly Effect[];
  ctx: EffectCtx;
  /** Checked when the trigger runs. */
  cond?: Cond;
  /** Passive of this Shade: skipped if it has left the field. */
  enemyUid?: Uid;
  /** PassiveDef.once: memory key on enemyUid. */
  onceKey?: string;
}

/** The card currently being played (5.3). Stashed in PendingChoice.play across a pending choice. */
export interface PlayRecord {
  uid: Uid;
  target: Uid | null;
  lights: Light[];
  harmonized: boolean;
  hit: Uid[];
  cost: number;
  suppressed: boolean;
}

/** Preview annotations recorded while running (not part of the state). */
export interface RtNotes {
  buried: Record<Uid, { shade: Shade; weightAfter: 1 | 2 | 3 | null; overflow: boolean }>;
  tended: { uid: Uid; weightAfter: number; insight: string | null; removed: boolean } | null;
}

export interface Rt {
  c: CombatState;
  readonly run: RunState;
  readonly pack: ContentPack;
  readonly rules: RulesConfig;
  readonly flags: ReadonlySet<KeepsakeFlag>;
  events: GameEvent[];
  queue: Trigger[];
  draining: boolean;
  triggerCount: number;
  nextUid: number;
  /** Preview mode: a draw or shuffle throws SEALED_STOP. */
  readonly sealed: boolean;
  /** A draw or shuffle happened (StepResult.revealedHiddenInfo). */
  revealed: boolean;
  play: PlayRecord | null;
  /** Tracks whether the Shade move being executed made the player lose Heart (Unconditional). */
  move: { lostHeart: boolean } | null;
  notes: RtNotes;
  /** Read-only runtimes wrap the input state; never pass one to a mutating function. */
  readonly readonly: boolean;
}

const flagCache = new WeakMap<object, Set<KeepsakeFlag>>();

export function keepsakeFlags(run: RunState, pack: ContentPack): Set<KeepsakeFlag> {
  const hit = flagCache.get(run.keepsakes);
  if (hit) return hit;
  const out = new Set<KeepsakeFlag>();
  for (const k of run.keepsakes) for (const f of pack.keepsakes[k.id]?.flags ?? []) out.add(f);
  flagCache.set(run.keepsakes, out);
  return out;
}

export function createRt(s: GameState, ectx: EngineCtx, opts: { sealed?: boolean; readonly?: boolean } = {}): Rt {
  if (!s.combat) throw new Error('No combat in progress');
  return {
    c: opts.readonly ? s.combat : cloneCombat(s.combat),
    run: s.run,
    pack: ectx.pack,
    rules: ectx.rules,
    flags: keepsakeFlags(s.run, ectx.pack),
    events: [],
    queue: [],
    draining: false,
    triggerCount: 0,
    nextUid: s.nextUid,
    sealed: opts.sealed ?? false,
    revealed: false,
    play: null,
    move: null,
    notes: { buried: {}, tended: null },
    readonly: opts.readonly ?? false,
  };
}

/** A runtime over a combat state that is not wrapped in a GameState yet (combat start). */
export function createRtFor(c: CombatState, s: GameState, ectx: EngineCtx): Rt {
  return {
    c,
    run: s.run,
    pack: ectx.pack,
    rules: ectx.rules,
    flags: keepsakeFlags(s.run, ectx.pack),
    events: [],
    queue: [],
    draining: false,
    triggerCount: 0,
    nextUid: s.nextUid,
    sealed: false,
    revealed: false,
    play: null,
    move: null,
    notes: { buried: {}, tended: null },
    readonly: false,
  };
}

// ---------------------------------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------------------------------

export function enemyDef(rt: Rt, e: EnemyState | string): EnemyDef {
  const id = typeof e === 'string' ? e : e.defId;
  const d = rt.pack.enemies[id];
  if (!d) throw new Error(`Unknown enemy ${id}`);
  return d;
}

export function cardDefOf(rt: Rt, card: CombatCard | string): CardDef {
  const id = typeof card === 'string' ? card : card.defId;
  const d = rt.pack.cards[id];
  if (!d) throw new Error(`Unknown card ${id}`);
  return d;
}

export function findEnemy(rt: Rt, uid: Uid | null | undefined): EnemyState | undefined {
  if (uid === null || uid === undefined) return undefined;
  for (const e of rt.c.enemies) if (e.uid === uid) return e;
  return undefined;
}

export function statusDef(rt: Rt, id: StatusId): StatusDef | undefined {
  return rt.pack.statuses[id];
}

export function stacks(bag: StatusBag, id: StatusId): number {
  return bag[id] ?? 0;
}

export function playerStacks(rt: Rt, id: StatusId): number {
  return rt.c.player.statuses[id] ?? 0;
}

export function statusMax(rt: Rt, id: StatusId): number {
  return rt.pack.statuses[id]?.max ?? DEFAULT_MAX[id] ?? Number.POSITIVE_INFINITY;
}

export function statusMin(rt: Rt, id: StatusId): number {
  return rt.pack.statuses[id]?.min ?? 0;
}

export function isNumbRules(e: EnemyState): boolean {
  return e.faces.length === 0;
}

export function showing(e: EnemyState): Shade | null {
  return e.faces.length === 0 ? null : e.faces[e.faceIndex % e.faces.length]!;
}

export function isVeiled(e: EnemyState): boolean {
  return (e.statuses.veiled ?? 0) > 0;
}

/** The actor of an effect context: a Shade for Shade moves and passives, else the player (undefined). */
export function actorEnemy(rt: Rt, ctx: EffectCtx): EnemyState | undefined {
  return ctx.source === 'enemy' ? findEnemy(rt, ctx.sourceUid) : undefined;
}

export function newUid(rt: Rt): Uid {
  return rt.nextUid++;
}

export function playerCtx(source: EffectCtx['source'], sourceUid: Uid, targetUid: Uid | null, lights: Light[] = []): EffectCtx {
  return { source, sourceUid, targetUid, lights, harmonized: false, fromCard: false };
}

export function enemyCtx(e: EnemyState, extra: Partial<EffectCtx> = {}): EffectCtx {
  return { source: 'enemy', sourceUid: e.uid, targetUid: null, lights: [], harmonized: false, fromCard: false, ...extra };
}
