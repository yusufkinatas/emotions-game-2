// Shade intents and actions (DESIGN 5.7, 7): cycle/byFace/phases patterns, overrides (M13), face turning
// (R-5, M1), summons (7.0), and the enemy phase with its phase-start snapshot.

import { FESTER_FLARE, MEM_TURNS_LEFT, ST } from '../constants';
import { evalCond, selfCtx } from '../conditions';
import { runEffects, settle } from '../interpreter';
import { clearEnemyGuard, emit, insertEnemy, setFaceIndex, setIntent } from '../primitives';
import type { CmpOp, Cond, EnemyDef, EnemyState, IntentPatternSimple, Uid } from '../types';
import { enemyCtx, enemyDef, findEnemy, newUid, type Rt } from './runtime';
import { giveStatus, setStatusOn } from './statuses';
import { fireMoods, firePassives } from './triggers';

/** The simple pattern in force (a phases pattern resolves to its current phase). */
export function currentPattern(def: EnemyDef, e: EnemyState): IntentPatternSimple {
  const p = def.pattern;
  if (p.kind !== 'phases') return p;
  const ph = p.phases[Math.min(e.pattern.phase, p.phases.length - 1)];
  if (!ph) throw new Error(`${def.id}: phases pattern without phases`);
  return ph.pattern;
}

export interface DerivedIntent {
  moveId: string;
  /** The override condition that forced this move, or null for the regular pattern move. */
  override: Cond | null;
}

function firstMove(def: EnemyDef): string {
  const k = Object.keys(def.moves)[0];
  if (!k) throw new Error(`${def.id} has no moves`);
  return k;
}

/** 5.7.1: overrides first (while their condition holds), else the cycle move at the index / the face's move. */
export function deriveIntent(rt: Rt, e: EnemyState): DerivedIntent {
  const def = enemyDef(rt, e);
  const pat = currentPattern(def, e);
  if (pat.overrides) {
    const ctx = selfCtx(e);
    for (const o of pat.overrides) if (evalCond(rt, o.if, ctx)) return { moveId: o.move, override: o.if };
  }
  if (pat.kind === 'cycle') {
    const n = pat.moves.length;
    if (n === 0) return { moveId: firstMove(def), override: null };
    return { moveId: pat.moves[((e.pattern.index % n) + n) % n]!, override: null };
  }
  const face = e.faces.length ? e.faces[e.faceIndex % e.faces.length]! : null;
  const byFace = face ? pat.moves[face] : undefined;
  return { moveId: byFace ?? Object.values(pat.moves)[0] ?? firstMove(def), override: null };
}

/** The gauge behind an override condition; `empties` when it fires as the gauge runs down (Dread's Countdown). */
export function overrideGauge(cond: Cond): { id: string; empties: boolean } | null {
  const empties = (op: CmpOp, n: number) => op === '<=' || op === '<' || (op === '==' && n <= 0);
  if (cond.c === 'status') return { id: cond.id, empties: empties(cond.op, cond.n) };
  if (cond.c === 'count' && typeof cond.of === 'object') return { id: cond.of.status, empties: empties(cond.op, cond.n) };
  if (cond.c === 'and' || cond.c === 'or') {
    for (const x of cond.of) {
      const r = overrideGauge(x);
      if (r) return r;
    }
  }
  if (cond.c === 'not') {
    const r = overrideGauge(cond.of);
    return r ? { id: r.id, empties: !r.empties } : null;
  }
  return null;
}

/** Name of the gauge behind an override condition (IntentView.overriddenBy), e.g. 'pressure'. */
export function overrideName(cond: Cond): string {
  return overrideGauge(cond)?.id ?? 'override';
}

export function refreshIntent(rt: Rt, e: EnemyState): void {
  if (!e.intent) return;
  setIntent(rt, e, deriveIntent(rt, e).moveId);
}

export function refreshIntents(rt: Rt): void {
  if (rt.readonly) return;
  for (const e of rt.c.enemies) if (e.intent) setIntent(rt, e, deriveIntent(rt, e).moveId);
}

/** Sets the intent whether or not one was rolled before (combat start, spawns, after acting). */
export function rollIntent(rt: Rt, e: EnemyState): void {
  setIntent(rt, e, deriveIntent(rt, e).moveId);
}

/** Phase switches: each later phase switches in once, the first time Intensity drops to its percent. */
export function checkPhases(rt: Rt, e: EnemyState): void {
  const pat = enemyDef(rt, e).pattern;
  if (pat.kind !== 'phases') return;
  let next = e.pattern.phase;
  for (let i = e.pattern.phase + 1; i < pat.phases.length; i++) {
    if (e.hp * 100 <= e.maxHp * pat.phases[i]!.atOrBelowPct) next = i;
  }
  if (next === e.pattern.phase) return;
  e.pattern.phase = next;
  e.pattern.index = 0;
  refreshIntent(rt, e);
}

/**
 * Turns a Faced Shade to its next face (R-5). Hits turn The Mask at most maxTurnsPerPlayerTurn times per
 * player turn (M1); its own end-of-action turn is not limited.
 */
export function turnFace(rt: Rt, e: EnemyState, cause: 'hit' | 'action'): boolean {
  if (e.faces.length < 2) return false;
  const def = enemyDef(rt, e);
  if (cause === 'hit' && def.maxTurnsPerPlayerTurn !== undefined) {
    const left = e.memory[MEM_TURNS_LEFT] ?? def.maxTurnsPerPlayerTurn;
    if (left <= 0) return false;
    e.memory[MEM_TURNS_LEFT] = left - 1;
  }
  setFaceIndex(rt, e, e.faceIndex + 1);
  firePassives(rt, e, 'faceTurned');
  refreshIntent(rt, e);
  return true;
}

export interface NewEnemyOpts {
  summonerUid: Uid | null;
  surfacedFrom: Uid | null;
  offset: number;
}

export function makeEnemy(rt: Rt, defId: string, hp: number, o: NewEnemyOpts): EnemyState {
  const def = enemyDef(rt, defId);
  const memory: Record<string, number> = {};
  if (def.maxTurnsPerPlayerTurn !== undefined) memory[MEM_TURNS_LEFT] = def.maxTurnsPerPlayerTurn;
  return {
    uid: newUid(rt),
    defId,
    hp,
    maxHp: hp,
    guard: 0,
    statuses: {},
    faces: [...def.faces],
    faceIndex: 0,
    intent: null,
    pattern: { index: o.offset, phase: 0 },
    fleeting: def.fleeting === true,
    summonerUid: o.summonerUid,
    surfacedFrom: o.surfacedFrom,
    memory,
    thresholdsFired: [],
  };
}

/**
 * Summon (7.0, 5.7 step 2b): inserted directly to the right of the summoner (ahead of its earlier summons),
 * fails silently when the field has maxShades or the summoner already has `max` live summons. Spawned Shades
 * use the low end of their HP range and pattern offset 0, and roll their intent immediately.
 */
export function spawnFrom(rt: Rt, actor: EnemyState, defId: string, max: number): void {
  const list = rt.c.enemies;
  if (list.length >= rt.rules.maxShades) return;
  if (list.filter((x) => x.summonerUid === actor.uid).length >= max) return;
  const def = enemyDef(rt, defId);
  const e = makeEnemy(rt, defId, def.hp[0], { summonerUid: actor.uid, surfacedFrom: null, offset: 0 });
  insertEnemy(rt, e, list.findIndex((x) => x.uid === actor.uid) + 1);
  rollIntent(rt, e);
}

function isAttackMove(def: EnemyDef, moveId: string): boolean {
  const m = def.moves[moveId];
  return !!m && (m.intent.includes('strike') || m.effects.some((x) => x.op === 'strike'));
}

/** 5.7 step 2 for one Shade. */
function act(rt: Rt, e: EnemyState): void {
  clearEnemyGuard(rt, e);
  const def = enemyDef(rt, e);
  const d = deriveIntent(rt, e);
  const move = def.moves[d.moveId];
  if (move) {
    emit(rt, { e: 'enemyMove', enemy: e.uid, moveId: d.moveId });
    rt.move = { lostHeart: false };
    let lost = false;
    try {
      runEffects(rt, move.effects, enemyCtx(e));
    } finally {
      lost = rt.move?.lostHeart ?? false;
      rt.move = null;
    }
    if (findEnemy(rt, e.uid) && isAttackMove(def, d.moveId) && (e.statuses[ST.hush] ?? 0) > 0) {
      setStatusOn(rt, e, ST.hush, 0);
    }
    if (lost) fireMoods(rt, 'heartLostFromMove');
    settle(rt);
  }
  if (!findEnemy(rt, e.uid)) return;
  firePassives(rt, e, 'afterOwnAction');
  settle(rt);
  if (def.turnsAfterAction) {
    turnFace(rt, e, 'action');
    settle(rt);
  }
  if (!findEnemy(rt, e.uid)) return;
  const pat = currentPattern(def, e);
  if (pat.kind === 'cycle' && d.override === null && pat.moves.length > 0) {
    e.pattern.index = (e.pattern.index + 1) % pat.moves.length;
  }
  rollIntent(rt, e);
}

/** R-17: the enemy phase that follows this player turn Festers. */
export function festers(rt: Rt): boolean {
  return rt.c.turn >= rt.rules.festerTurn;
}

/**
 * 5.7 step 1 (R-17): from festerTurn every Shade gains 1 Flare. Shared by the enemy phase and the M2 intent
 * projection, so displayed strikes already include it.
 */
export function fester(rt: Rt): void {
  if (!festers(rt)) return;
  emit(rt, { e: 'festering' });
  for (const e of rt.c.enemies.slice()) giveStatus(rt, e, ST.flare, FESTER_FLARE);
  settle(rt);
}

/** 5.7: Festering, then each Shade of the phase-start snapshot acts left to right if still present. */
export function enemyPhase(rt: Rt): void {
  rt.c.moodFiredThisPhase = [];
  emit(rt, { e: 'turn', side: 'enemy', n: rt.c.turn });
  fester(rt);
  const snapshot = rt.c.enemies.map((e) => e.uid);
  for (const uid of snapshot) {
    const e = findEnemy(rt, uid);
    if (e) act(rt, e);
  }
}
