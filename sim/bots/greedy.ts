// The one greedy scoring core (DESIGN 21.1): 1-ply, scores engine previews under a Belief and re-plans after
// every action. Beliefs whose chart differs from the engine's re-derive each hit with damage.recombine.

import {
  harmonize,
  recombine,
  type Action,
  type CombatState,
  type Effect,
  type EnemyState,
  type HitBreakdown,
  type Light,
  type LethalOutcome,
  type PreviewTarget,
  type Shade,
  type TargetTyping,
  type Uid,
} from '../../src/engine/index';
import type { Belief } from './belief';
import { amountOf, cardParts, COMPANION_VALUE, moodValue, W, type Estimator } from './cardValue';
import { enemyOf, RUN_FLOORS, strikeTotal, type Candidate, type CombatView } from './combatView';

/** Behaviour switches on top of a belief (21.1 ablations and policy bots). */
export interface CombatFlags {
  /** aware-noInward: never plays Inward. */
  noInward?: boolean;
  /** resolveOnly: never plays a Suppressing lethal unless ending the turn would drop Heart to 0. */
  resolveOnly?: boolean;
  /** buryAll: always Tends when an Inward play can. */
  alwaysTend?: boolean;
}

export interface Pick {
  key: string;
  action: Action;
  score: number;
}

export const END_TURN: Pick = { key: 'endTurn', action: { t: 'endTurn' }, score: 0 };

/** 21.1 afterglowValue. Perspective also counts the afflictions it would remove. */
function afterglowValue(shade: Shade, c: CombatState): number {
  switch (shade) {
    case 'anger':
      return 4;
    case 'sadness':
      return 4;
    case 'loneliness':
      return 5;
    case 'fear':
      return 6;
    case 'despair': {
      let stacks = 0;
      for (const [id, n] of Object.entries(c.player.statuses)) {
        if (id !== 'numb' && AFFLICTION_IDS.has(id)) stacks += n ?? 0;
      }
      return 2 + stacks;
    }
    case 'anxiety':
      return 5;
  }
}

const AFFLICTION_IDS = new Set(['seething', 'heavy', 'isolated', 'trembling', 'hollow', 'restless']);

const showingFace = (e: EnemyState): Shade | null => (e.faces.length === 0 ? null : e.faces[e.faceIndex % e.faces.length]!);

/** What a belief thinks one previewed target goes through. */
interface BelievedTarget {
  hpLoss: number;
  killed: boolean;
  outcome: LethalOutcome | null;
  flareDelta: number;
  faceAfter: Shade | null;
  /** Face showing when the finishing hit landed (Buried card / Afterglow). */
  faceAtKill: Shade | null;
}

function exactTarget(t: PreviewTarget): BelievedTarget {
  const killed = t.outcome !== null && t.outcome !== 'wavering';
  return {
    hpLoss: Math.max(0, t.hpBefore - t.hpAfter),
    killed,
    outcome: t.outcome,
    flareDelta: t.flareDelta,
    faceAfter: t.faceAfter,
    faceAtKill: t.faceAfter,
  };
}

function typingAt(e: EnemyState, faceIndex: number, understood: boolean): TargetTyping {
  if (e.faces.length === 0) return { rule: 'numb', veiled: false };
  return { rule: 'standard', face: e.faces[faceIndex % e.faces.length]!, understood };
}

/** Believed lethal outcome (4.8) under the belief's cures. */
function believedOutcome(b: Belief, e: EnemyState, face: Shade | null, h: HitBreakdown, relFelt: boolean, understood: boolean): LethalOutcome {
  if (e.fleeting) return 'fade';
  if (face === null) return relFelt ? 'resolve' : h.fromCard ? 'suppress' : 'wavering';
  const cures = (s: Shade) => {
    const l = b.cureOf(s);
    return l !== null && h.lights.includes(l);
  };
  if ((understood && h.fromCard) || cures(face)) {
    return h.fromCard && e.faces.length === 2 && e.faces.every(cures) ? 'deepResolve' : 'resolve';
  }
  return h.fromCard ? 'suppress' : 'wavering';
}

/** Re-derive a target's hits under a belief that disagrees with the real chart (recombine per hit). */
function believedTarget(b: Belief, t: PreviewTarget, e: EnemyState): BelievedTarget {
  let hp = t.hpBefore;
  let guard = t.guardBefore;
  let face = e.faceIndex;
  let flare = e.statuses.flare ?? 0;
  let understood = (e.statuses.understood ?? 0) > 0;
  let loss = 0;
  let flareDelta = 0;
  let outcome: LethalOutcome | null = null;
  let faceAtKill: Shade | null = null;
  for (const h of t.hits) {
    if (outcome !== null && outcome !== 'wavering') break;
    const typing = typingAt(e, face, understood);
    const rel = b.relation(h.lights, typing, h.fromCard);
    const r = recombine(h, rel.pct, guard);
    guard -= r.damage - r.hpLoss;
    if (hp - r.hpLoss <= 0) {
      const f = typing.rule === 'standard' ? typing.face : null;
      outcome = believedOutcome(b, e, f, h, rel.relation === 'felt', understood);
      faceAtKill = f;
      const floor = outcome === 'wavering' ? 1 : 0;
      loss += hp - floor;
      hp = floor;
      continue;
    }
    hp -= r.hpLoss;
    loss += r.hpLoss;
    if (typing.rule === 'numb') continue;
    if (rel.relation === 'dissonant' && h.fromCard) {
      flare += 1;
      flareDelta += 1;
    } else if (rel.relation === 'opposite') {
      if (flare > 0) {
        flare -= 1;
        flareDelta -= 1;
      }
      if (e.faces.length >= 2) face += 1;
    }
    if (h.fromCard) understood = false;
  }
  const killed = outcome !== null && outcome !== 'wavering';
  return {
    hpLoss: Math.max(0, loss),
    killed,
    outcome,
    flareDelta,
    faceAfter: e.faces.length === 0 ? null : e.faces[face % e.faces.length]!,
    faceAtKill,
  };
}

/** Current Weight of the Buried card of a Shade, counting this combat's earlier Suppresses. */
function buriedWeightNow(v: CombatView, shade: Shade): number {
  let w = 0;
  for (const card of v.s.run.deck) {
    const def = v.engine.pack.cards[card.defId];
    if (def?.buried?.shade === shade) w = card.weight ?? 1;
  }
  for (const m of v.c.mutations) if (m.k === 'suppress' && m.shade === shade) w += 1;
  return w;
}

/** S(floorsLeft, weightAfter) of 21.1, plus the Surfaced growth and numb-rules cases. */
function suppressPenalty(v: CombatView, t: PreviewTarget, e: EnemyState, bt: BelievedTarget, exact: boolean): number {
  const scale = v.floorsLeft / RUN_FLOORS;
  if (e.surfacedFrom !== null) {
    const weight = v.c.cards[e.surfacedFrom]?.weight ?? 1;
    return 0.8 * v.engine.rules.surfacedSuppressGrowPerWeight * weight;
  }
  if (e.faces.length === 0) return 2;
  if (exact) {
    if (!t.buried) return 0;
    if (t.buried.overflow || t.buried.weightAfter === null) return 12;
    return (4 + 1.5 * t.buried.weightAfter) * scale;
  }
  const shade = bt.faceAtKill ?? showingFace(e);
  if (!shade) return 0;
  const now = buriedWeightNow(v, shade);
  if (now >= v.engine.rules.buriedMaxWeight) return 12;
  return (4 + 1.5 * (now + 1)) * scale;
}

function outcomeValue(v: CombatView, t: PreviewTarget, e: EnemyState, bt: BelievedTarget, exact: boolean): number {
  switch (bt.outcome) {
    case 'resolve':
    case 'deepResolve': {
      let ag = 0;
      const faces: readonly Shade[] = exact
        ? t.afterglows
        : bt.outcome === 'deepResolve'
          ? e.faces
          : bt.faceAtKill
            ? [bt.faceAtKill]
            : [];
      for (const f of faces) ag += afterglowValue(f, v.c);
      return 8 + ag;
    }
    case 'suppress':
      return -suppressPenalty(v, t, e, bt, exact);
    default:
      return 0;
  }
}

/** Uids of hand cards other than the one being played. */
function otherHand(v: CombatView, played: Uid): Uid[] {
  return v.c.piles.hand.filter((u) => u !== played);
}

function handHasLight(v: CombatView, played: Uid, light: Light | null): boolean {
  if (light === null) return false;
  for (const u of otherHand(v, played)) {
    const def = v.engine.pack.cards[v.c.cards[u]!.defId];
    if (def && def.kind !== 'buried' && def.lights.includes(light)) return true;
  }
  return false;
}

function leavesHarmonizable(v: CombatView, played: Uid, noteAfter: Light[]): boolean {
  const opts = { enabled: v.hasCompass, isolated: (v.c.player.statuses.isolated ?? 0) > 0, mirror: v.mirror };
  if (!opts.enabled || opts.isolated) return false;
  for (const u of otherHand(v, played)) {
    const def = v.engine.pack.cards[v.c.cards[u]!.defId];
    if (!def || def.kind === 'buried' || def.lights.length === 0) continue;
    if (harmonize(noteAfter, def.lights, opts).harmonized) return true;
  }
  return false;
}

function expectedStrikesLeft(v: CombatView, e: EnemyState, hpAfter: number): number {
  const iv = v.intents.get(e.uid);
  const perTurn = Math.max(1, iv?.strikes?.count ?? 0);
  return perTurn * Math.max(1, Math.min(4, Math.ceil(hpAfter / 12)));
}

/** In-combat estimates for amounts (Promise and Mood values). */
function combatEstimator(v: CombatView): Estimator {
  return (per) => {
    if (typeof per === 'object') return per.status === 'flare' ? 1 : 0.5;
    switch (per) {
      case 'playedThisTurn':
        return v.c.turnFlags.played;
      case 'companions':
        return v.c.companions.length;
      case 'turn':
        return v.c.turn + 1;
      case 'incoming':
        return v.incoming;
      case 'promisesMade':
        return v.c.promisesMade;
      default:
        return 1;
    }
  };
}

/** Cards drawn, Promises made and Companions summoned by a play (the sealed preview stops at a draw). */
interface Collected {
  draws: number;
  promises: Effect[][];
  summons: string[];
  /** Center: the next card this turn costs 0. */
  freeNext: number;
}

function collect(effects: readonly Effect[], harmonized: boolean, noGuard: boolean, out: Collected, est: Estimator): void {
  for (const e of effects) {
    switch (e.op) {
      case 'draw':
        out.draws += amountOf(e.n, est);
        break;
      case 'promise':
        out.promises.push(e.effects);
        break;
      case 'summon':
        out.summons.push(e.companion);
        break;
      case 'nextCardFree':
        out.freeNext += 1;
        break;
      case 'if': {
        const take =
          e.cond.c === 'harmonized' ? harmonized : e.cond.c === 'noGuard' ? noGuard : e.cond.c === 'suppressedTarget' ? false : true;
        collect(take ? e.then : (e.else ?? []), harmonized, noGuard, out, est);
        break;
      }
      default:
        break;
    }
  }
}

/** Believed percent of an automatic (Promise) hit carrying `lights` on a Shade. */
function promiseHitPct(b: Belief, lights: Light[], e: EnemyState | undefined): number {
  if (!e) return 100;
  return b.typePct(lights, typingAt(e, e.faceIndex, false), false);
}

function promiseValue(v: CombatView, b: Belief, effects: readonly Effect[], lights: Light[], target: EnemyState | undefined, est: Estimator): number {
  let val = 0;
  for (const e of effects) {
    if (e.op === 'hit') {
      const n = amountOf(e.amount, est) * (e.times === undefined ? 1 : amountOf(e.times, est));
      val += n * (promiseHitPct(b, lights, target) / 100) * (e.to === 'all' ? W.allTargets : 1);
    } else if (e.op === 'guard') val += W.guard * amountOf(e.amount, est);
    else if (e.op === 'draw') val += W.draw * amountOf(e.n, est);
    else if (e.op === 'energy') val += W.spirit * amountOf(e.n, est);
    else if (e.op === 'if') val += promiseValue(v, b, e.then, lights, target, est);
  }
  return W.promise * val;
}

/** Companion action value per turn (Lantern Moth Ease 3, Burrow Hare 3 Guard, Old Dog Ease 6). */
const COMPANION_PER_TURN: Record<string, number> = { 'comp.lantern_moth': 3, 'comp.burrow_hare': 2.4, 'comp.old_dog': 6 };

function summonValue(v: CombatView, summons: string[]): number {
  if (summons.length === 0) return 0;
  const turns = Math.max(1, v.turnsLeft);
  const isolated = (v.c.player.statuses.isolated ?? 0) > 0 ? 0.5 : 1;
  let val = 0;
  let count = v.c.companions.length;
  const oldest = [...v.c.companions];
  for (const id of summons) {
    val += (COMPANION_PER_TURN[id] ?? (COMPANION_VALUE[id] ?? 4) / 2) * turns;
    count += 1;
    if (count > v.engine.rules.maxCompanions) {
      const gone = oldest.shift();
      if (gone) val -= (COMPANION_PER_TURN[gone.defId] ?? 2) * turns;
      count -= 1;
    }
  }
  return val * isolated;
}

const tri = (n: number): number => (n * (n + 1)) / 2;

/** score(a) of 21.1 for one candidate play (plus the documented extensions for lasting effects). */
export function scoreCandidate(v: CombatView, cand: Candidate, b: Belief, flags: CombatFlags = {}): number {
  const p = cand.preview;
  if (!p) return Number.NEGATIVE_INFINITY;
  const c = v.c;
  let score = 0;
  let suppresses = false;

  for (const t of p.targets) {
    const e = enemyOf(c, t.uid);
    if (!e) continue;
    const bt = b.exactChart ? exactTarget(t) : believedTarget(b, t, e);
    const threat = v.threat.get(t.uid) ?? 0;
    score += bt.hpLoss * (1 + threat / Math.max(1, t.hpBefore));
    if (bt.killed) {
      score += 5 + 1.5 * threat;
      if (b.knowsResolve) score += outcomeValue(v, t, e, bt, b.exactChart);
      if (t.outcome === 'suppress') suppresses = true;
      continue;
    }
    // Extension: intent changes the play causes (a gauge override, a face turned to a Guard move). Only a
    // bot that knows faces and reads the true chart may use it: the change also carries Flare and face turns,
    // which would leak the chart to blind and confused play.
    if (t.intentAfter && b.knowsFaces && b.exactChart) score += 0.5 * (threat - strikeTotal(t.intentAfter));
    if (b.knowsFaces && e.faces.length >= 2 && bt.faceAfter && bt.faceAfter !== showingFace(e)) {
      if (handHasLight(v, cand.action.card, b.cureOf(bt.faceAfter))) score += 2;
    }
    if (b.knowsFlare && bt.flareDelta !== 0) score -= bt.flareDelta * expectedStrikesLeft(v, e, t.hpAfter) * 1.5;
    const hush = t.gauges.hush;
    if (hush && hush[1] > hush[0]) {
      const iv = v.intents.get(t.uid);
      const per = iv?.strikes ? Math.min(hush[1] - hush[0], iv.strikes.perStrike) * iv.strikes.count : 0.5 * (hush[1] - hush[0]);
      score += W.guard * per;
    }
    const und = t.gauges.understood;
    if (b.knowsResolve && und && und[1] > und[0]) score += W.understood;
  }

  const pl = p.player;
  const guardGain = pl.guardAfter - pl.guardBefore;
  if (guardGain > 0) {
    const useful = Math.min(guardGain, Math.max(0, v.incoming - pl.guardBefore));
    score += useful + 0.1 * (guardGain - useful);
  }
  const mend = pl.hpAfter - pl.hpBefore;
  if (mend > 0 && pl.hpBefore < 0.7 * c.player.maxHp) score += 0.8 * mend;
  for (const n of Object.values(pl.cleansed)) score += 3 * (n ?? 0);
  const energyGained = pl.energyAfter - (c.energy - p.cost);
  if (energyGained > 0) score += 3 * energyGained;

  if (!cand.inward) {
    const est = combatEstimator(v);
    const parts = cardParts(cand.def, cand.upgraded);
    const got: Collected = { draws: 0, promises: [], summons: [], freeNext: 0 };
    collect(parts.effects, p.harmonized, pl.guardBefore === 0, got, est);
    if (c.piles.draw.length + c.piles.discard.length > 0) score += 2.5 * got.draws;
    if (got.freeNext > 0 && !c.turnFlags.centerActive) score += W.nextCardFree;
    const target = cand.action.target !== undefined ? enemyOf(c, cand.action.target) : undefined;
    for (const pe of got.promises) score += promiseValue(v, b, pe, p.effectiveLights, target, est);
    score += summonValue(v, got.summons);
    if (cand.def.kind === 'mood' && parts.mood.length > 0) {
      score += (moodValue(parts.mood, { est, harmonized: p.harmonized ? 1 : 0 }) * Math.max(0, v.turnsLeft - 1)) / 3;
    }
    const nerve = pl.statuses.nerve;
    if (nerve && nerve[1] > nerve[0]) score += (nerve[1] - nerve[0]) * Math.min(8, 2 * v.turnsLeft);
    const warmth = pl.statuses.warmth;
    if (warmth && warmth[1] > warmth[0]) {
      const missing = c.player.maxHp - pl.hpAfter;
      score += 0.8 * Math.min(missing, tri(warmth[1]) - tri(warmth[0]));
    }
  }

  if (pl.tended) {
    if (b.knowsCleanse) score += 6 + (pl.tended.insight ? 6 : 0);
    if (flags.alwaysTend) score += 100;
  }
  if (b.knowsHarmony) {
    if (p.harmonized) score += 2;
    if (leavesHarmonizable(v, cand.action.card, p.noteAfter)) score += 1;
  }
  score -= 0.5 * p.cost;
  if (suppresses && flags.resolveOnly && !v.dyingIfEndTurn()) return Number.NEGATIVE_INFINITY;
  return score;
}

/** Best candidate under a belief; endTurn when nothing scores above 0 (21.1). */
export function bestPick(v: CombatView, b: Belief, flags: CombatFlags = {}): Pick {
  let best = END_TURN;
  for (const cand of v.candidates) {
    if (flags.noInward && cand.inward) continue;
    const s = scoreCandidate(v, cand, b, flags);
    if (s > best.score) best = { key: cand.key, action: cand.action, score: s };
  }
  return best;
}

/** A pending combat choice: Look Inward fetches (toHand) and Sit With It (tend). */
export function choosePending(v: CombatView, b: Belief): Action {
  const pend = v.c.pending!;
  const weight = (u: Uid) => v.c.cards[u]?.weight ?? 0;
  let best = pend.options[0]!;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const u of pend.options) {
    let s = weight(u);
    if (pend.purpose === 'toHand' && b.knowsCleanse) {
      const shade = v.engine.pack.cards[v.c.cards[u]!.defId]?.buried?.shade;
      if (shade && handHasLight(v, -1, b.cureOf(shade))) s += 10;
    }
    if (s > bestScore) {
      best = u;
      bestScore = s;
    }
  }
  return { t: 'choose', uid: best };
}
