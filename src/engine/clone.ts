// Hand-rolled clones for plain-JSON state (DESIGN 20.6). Never structuredClone on hot paths.
//
// Sharing rules for cloneCombat: objects that the engine never mutates after creating them are shared
// (content Effect arrays inside Promises and Frames, GoneEnemy, DeckMutation, CompanionState, PromiseState).
// Everything the combat code writes to is copied.

import type { CombatCard, CombatState, CombatStats, EnemyState, Frame, GameState, PendingChoice } from './types';

/** Generic deep clone for plain JSON values (objects, arrays, primitives). */
export function deepClone<T>(x: T): T {
  if (x === null || typeof x !== 'object') return x;
  if (Array.isArray(x)) {
    const out = new Array(x.length);
    for (let i = 0; i < x.length; i++) out[i] = deepClone(x[i]);
    return out as T;
  }
  const out: Record<string, unknown> = {};
  for (const k in x) out[k] = deepClone((x as Record<string, unknown>)[k]);
  return out as T;
}

export function cloneCard(c: CombatCard): CombatCard {
  return { ...c, mem: { ...c.mem } };
}

export function cloneEnemy(e: EnemyState): EnemyState {
  return {
    ...e,
    statuses: { ...e.statuses },
    faces: e.faces.slice(),
    intent: e.intent ? { ...e.intent } : null,
    pattern: { ...e.pattern },
    memory: { ...e.memory },
    thresholdsFired: e.thresholdsFired.slice(),
  };
}

function cloneFrame(f: Frame): Frame {
  return { effects: f.effects, pc: f.pc, ctx: { ...f.ctx, lights: f.ctx.lights.slice() } };
}

function clonePending(p: PendingChoice): PendingChoice {
  const out: PendingChoice = { ...p, options: p.options.slice(), continuation: p.continuation.map(cloneFrame) };
  if (p.play) out.play = { ...p.play, lights: p.play.lights.slice(), hit: p.play.hit.slice() };
  return out;
}

function cloneStats(s: CombatStats): CombatStats {
  return {
    ...s,
    playsByLight: { ...s.playsByLight },
    playsByCard: { ...s.playsByCard },
    dmgByRelation: { ...s.dmgByRelation },
  };
}

export function cloneCombat(c: CombatState): CombatState {
  const cards: Record<number, CombatCard> = {};
  for (const k in c.cards) cards[k] = cloneCard(c.cards[k]!);
  const p = c.piles;
  return {
    ...c,
    player: { ...c.player, statuses: { ...c.player.statuses } },
    cards,
    piles: {
      draw: p.draw.slice(),
      hand: p.hand.slice(),
      discard: p.discard.slice(),
      letGo: p.letGo.slice(),
      moods: p.moods.slice(),
      removed: p.removed.slice(),
      play: p.play ? p.play.slice() : [],
    },
    enemies: c.enemies.map(cloneEnemy),
    gone: c.gone.slice(),
    companions: c.companions.slice(),
    note: c.note.slice(),
    turnFlags: { ...c.turnFlags, lightsThisTurn: c.turnFlags.lightsThisTurn.slice() },
    keepsakeFired: { ...c.keepsakeFired },
    moodFiredThisPhase: c.moodFiredThisPhase.slice(),
    promises: c.promises.slice(),
    pending: c.pending ? clonePending(c.pending) : null,
    rng: { ...c.rng },
    mutations: c.mutations.slice(),
    stats: cloneStats(c.stats),
  };
}

/** Full deep clone of a GameState (run-phase actions). Combat uses the fast path. */
export function cloneState(s: GameState): GameState {
  const out: GameState = { ...s };
  for (const k in s) {
    if (k === 'combat') continue;
    (out as unknown as Record<string, unknown>)[k] = deepClone((s as unknown as Record<string, unknown>)[k]);
  }
  out.combat = s.combat ? cloneCombat(s.combat) : null;
  return out;
}
