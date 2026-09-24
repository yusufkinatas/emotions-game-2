// Random-bot combat playthroughs for property tests: preview == step, determinism, purity.

import { combatLegalActions, previewCombat, startCombat, stepCombat } from '../../src/engine/combat/index';
import { hash32, Rng } from '../../src/engine/rng';
import type { Action, CombatState, ContentPack, EngineCtx, GameState, KeepsakeId, Preview, Shade } from '../../src/engine/types';
import { ctxFor, makeState } from './run';

const showing = (e: CombatState['enemies'][number]): Shade | null => (e.faces.length ? e.faces[e.faceIndex % e.faces.length]! : null);

/** A random but valid combat start: random deck from the pack, random Keepsakes, random encounter. */
export function randomCombat(pack: ContentPack, seed: number): { state: GameState; ctx: EngineCtx } {
  const rng = new Rng(hash32(seed, 'fixture'));
  const ctx = ctxFor(pack);
  const playable = Object.values(pack.cards).filter((c) => c.kind !== 'buried');
  const buried = Object.values(pack.cards).filter((c) => c.kind === 'buried');
  const deck: { id: string; upgraded?: boolean; weight?: 1 | 2 | 3 }[] = [];
  const n = rng.int(8, 16);
  for (let i = 0; i < n; i++) deck.push({ id: rng.pick(playable).id, upgraded: rng.float() < 0.25 });
  const nb = rng.int(0, 2);
  const shuffledBuried = rng.shuffle(buried).slice(0, nb);
  for (const b of shuffledBuried) deck.push({ id: b.id, weight: rng.int(1, 3) as 1 | 2 | 3 });
  const ks = Object.values(pack.keepsakes).map((k) => k.id);
  const keepsakes: KeepsakeId[] = rng.shuffle(ks).slice(0, rng.int(0, 5));
  if (rng.float() < 0.6 && !keepsakes.includes('ks.compass') && pack.keepsakes['ks.compass']) keepsakes.push('ks.compass');
  const encounters = Object.keys(pack.encounters);
  const encounter = rng.pick(encounters);
  const s = makeState(deck, { keepsakes, heart: rng.int(30, 70), seed });
  const tier = rng.pick(['normal', 'elite', 'boss', 'tutorial'] as const);
  const r = startCombat(s, ctx, { encounter, nodeId: 1, nodeSeed: hash32(seed, 'node'), tier });
  return { state: r.state, ctx };
}

export interface Mismatch {
  seed: number;
  step: number;
  action: Action;
  what: string;
}

/** Compares a certain preview against the real step result. Returns a list of differences. */
export function comparePreview(p: Preview, before: CombatState, after: CombatState): string[] {
  const out: string[] = [];
  const diff = (what: string, a: unknown, b: unknown) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push(`${what}: preview ${JSON.stringify(a)} actual ${JSON.stringify(b)}`);
  };
  const listed = new Set(p.targets.map((t) => t.uid));
  for (const t of p.targets) {
    const e0 = before.enemies.find((x) => x.uid === t.uid)!;
    const e1 = after.enemies.find((x) => x.uid === t.uid);
    if (e1) {
      diff(`hp ${t.uid}`, t.hpAfter, e1.hp);
      diff(`guard ${t.uid}`, t.guardAfter, e1.guard);
      diff(`maxHp ${t.uid}`, t.maxHpAfter, e1.maxHp);
      diff(`face ${t.uid}`, t.faceAfter, showing(e1));
      diff(`flare ${t.uid}`, t.flareDelta, (e1.statuses.flare ?? 0) - (e0.statuses.flare ?? 0));
      if (t.outcome !== null && t.outcome !== 'wavering') out.push(`outcome ${t.uid}: preview ${t.outcome} but still present`);
    } else {
      const g = after.gone.find((x) => x.uid === t.uid);
      diff(`outcome ${t.uid}`, t.outcome, g?.outcome ?? 'missing');
    }
  }
  for (const e0 of before.enemies) {
    if (listed.has(e0.uid)) continue;
    const e1 = after.enemies.find((x) => x.uid === e0.uid);
    if (!e1) {
      out.push(`enemy ${e0.uid} left but not in preview targets`);
      continue;
    }
    diff(`unlisted ${e0.uid}`, [e0.hp, e0.guard, e0.maxHp, e0.faceIndex, e0.statuses], [e1.hp, e1.guard, e1.maxHp, e1.faceIndex, e1.statuses]);
  }
  diff('player hp', p.player.hpAfter, after.player.hp);
  diff('player guard', p.player.guardAfter, after.player.guard);
  diff('energy', p.player.energyAfter, after.energy);
  const bag: Record<string, number> = { ...before.player.statuses } as Record<string, number>;
  for (const [id, [, a]] of Object.entries(p.player.statuses)) {
    if (a === 0) delete bag[id];
    else bag[id] = a;
  }
  const sortKeys = (o: Record<string, number | undefined>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  diff('player statuses', sortKeys(bag), sortKeys(after.player.statuses));
  diff('partial', p.partial, after.pending !== null);
  diff('note', p.noteAfter, after.note);
  return out;
}

/**
 * Plays a combat with a uniform random bot. For every legal play, a certain preview must equal the step.
 * Returns mismatches and the list of hashes after every step (for determinism tests).
 */
export function playRandomCombat(
  pack: ContentPack,
  seed: number,
  o: { maxSteps?: number; checkPreviews?: boolean; onStep?: (s: GameState, a: Action) => void } = {},
): { mismatches: Mismatch[]; hashes: string[]; actions: Action[]; final: GameState; previews: number; certain: number } {
  let { state, ctx } = randomCombat(pack, seed);
  const rng = new Rng(hash32(seed, 'bot'));
  const mismatches: Mismatch[] = [];
  const hashes: string[] = [];
  const actions: Action[] = [];
  let previews = 0;
  let certain = 0;
  const maxSteps = o.maxSteps ?? 200;
  for (let step = 0; step < maxSteps && state.combat && !state.combat.outcome; step++) {
    const legal = combatLegalActions(state, ctx);
    if (legal.length === 0) {
      mismatches.push({ seed, step, action: { t: 'endTurn' }, what: 'no legal actions in a live combat' });
      break;
    }
    if (o.checkPreviews !== false) {
      for (const a of legal) {
        if (a.t !== 'play') continue;
        const p = previewCombat(state, ctx, a);
        previews++;
        if (!p) {
          mismatches.push({ seed, step, action: a, what: 'legal play has no preview' });
          continue;
        }
        if (p.uncertain) continue;
        certain++;
        const r = stepCombat(state, ctx, a);
        for (const what of comparePreview(p, state.combat, r.state.combat!)) mismatches.push({ seed, step, action: a, what });
      }
    }
    // Prefer plays a little so combats progress.
    const plays = legal.filter((a) => a.t !== 'endTurn');
    const a = plays.length > 0 && rng.float() < 0.8 ? rng.pick(plays) : rng.pick(legal);
    o.onStep?.(state, a);
    state = stepCombat(state, ctx, a).state;
    actions.push(a);
    hashes.push(String(hash32(JSON.stringify(state))));
  }
  return { mismatches, hashes, actions, final: state, previews, certain };
}

export function deepFreeze<T>(x: T): T {
  if (x && typeof x === 'object' && !Object.isFrozen(x)) {
    Object.freeze(x);
    for (const k of Object.keys(x as object)) deepFreeze((x as Record<string, unknown>)[k]);
  }
  return x;
}
