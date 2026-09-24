// Buried cards in combat (R-10): Tend (once per combat, not with Lead Box), Insight (B3 once per run),
// Surfaced Resolve / Suppress (R-16, M3, M4), Buried-in-hand stacks, and Suppress consequences for previews.

import { cureOf, shadeIndex } from '../emotions';
import { cardToHand, growEnemy, releaseCard, returnSurfacedCard, tendWeight, transformCard } from '../primitives';
import type { CardDef, CombatCard, EnemyState, Light, Shade, Uid } from '../types';
import { cardDefOf, enemyDef, type Rt } from './runtime';
import { fireKeepsakes } from './triggers';

export function isBuried(def: CardDef | undefined): boolean {
  return !!def && (def.kind === 'buried' || def.buried !== undefined);
}

export function buriedShade(rt: Rt, card: CombatCard): Shade | null {
  return rt.pack.cards[card.defId]?.buried?.shade ?? null;
}

/** The combat copy of the Buried card of a Shade type (one per type, R-10), if any. */
export function buriedOfShade(rt: Rt, shade: Shade): CombatCard | undefined {
  for (const k in rt.c.cards) {
    const card = rt.c.cards[k]!;
    if (rt.pack.cards[card.defId]?.buried?.shade === shade) return card;
  }
  return undefined;
}

/** B3: this Insight id was already created this run (earlier, or earlier in this combat). */
export function insightMade(rt: Rt, id: string): boolean {
  return rt.run.insightsMade.includes(id) || rt.c.mutations.some((m) => m.k === 'transform' && m.to === id);
}

function insightUpgradedByKeepsake(rt: Rt): boolean {
  return rt.flags.has('insightUpgraded') || rt.flags.has('wornDiary');
}

/**
 * The Buried card becomes its Insight (upgraded at peakWeight 2+ or with Worn Diary), or is released if
 * that Insight was already created this run. Surfaced Resolves also move it into the hand.
 */
export function makeInsight(rt: Rt, card: CombatCard, peak: number, toHand: boolean): void {
  const insight = cardDefOf(rt, card).buried?.insight;
  if (!insight) return;
  if (insightMade(rt, insight)) {
    rt.c.mutations.push({ k: 'remove', uid: card.uid });
    releaseCard(rt, card);
    if (rt.notes.tended && rt.notes.tended.uid === card.uid) rt.notes.tended.removed = true;
    return;
  }
  const upgraded = peak >= 2 || insightUpgradedByKeepsake(rt);
  rt.c.mutations.push({ k: 'transform', uid: card.uid, to: insight, upgraded });
  transformCard(rt, card, insight, upgraded, toHand);
  rt.c.stats.insights += 1;
  if (rt.notes.tended && rt.notes.tended.uid === card.uid) rt.notes.tended.insight = insight;
}

/** In-combat Tend: Weight -1 (once per combat per card, never with Lead Box). At 0: Insight. */
export function tendCard(rt: Rt, card: CombatCard): void {
  if (rt.flags.has('leadBox') || card.mem.tended) return;
  const peak = card.peakWeight ?? card.weight ?? 1;
  const after = tendWeight(rt, card);
  rt.c.mutations.push({ k: 'tend', uid: card.uid });
  rt.c.stats.tends += 1;
  rt.notes.tended = { uid: card.uid, weightAfter: after, insight: null, removed: false };
  fireKeepsakes(rt, 'tended');
  if (after === 0) makeInsight(rt, card, peak, false);
}

/** R-7 step 2: a Buried card in hand the Inward play would Tend (highest Weight, then wheel order). */
export function inwardTendCandidate(rt: Rt, lights: readonly Light[]): Uid | null {
  if (rt.flags.has('leadBox')) return null;
  const anyType = rt.flags.has('skeletonKey');
  let best: { uid: Uid; w: number; s: number } | null = null;
  for (const uid of rt.c.piles.hand) {
    const card = rt.c.cards[uid]!;
    if (card.mem.tended) continue;
    const def = rt.pack.cards[card.defId];
    if (!isBuried(def)) continue;
    const shade = def!.buried?.shade;
    if (!anyType && (!shade || !lights.includes(cureOf(shade)))) continue;
    const w = card.weight ?? 1;
    const s = shade ? shadeIndex(shade) : 6;
    if (!best || w > best.w || (w === best.w && s < best.s)) best = { uid, w, s };
  }
  return best ? best.uid : null;
}

/** Options of Look Inward (toHand: Buried in draw, then discard) and Sit With It (tend: Buried in hand). */
export function chooseTargets(rt: Rt, purpose: 'toHand' | 'tend'): Uid[] {
  const isB = (uid: Uid) => isBuried(rt.pack.cards[rt.c.cards[uid]!.defId]);
  if (purpose === 'toHand') return [...rt.c.piles.draw.filter(isB), ...rt.c.piles.discard.filter(isB)];
  if (rt.flags.has('leadBox')) return [];
  return rt.c.piles.hand.filter((uid) => isB(uid) && !rt.c.cards[uid]!.mem.tended);
}

export function resolveChoicePick(rt: Rt, purpose: 'toHand' | 'tend', uid: Uid): void {
  if (purpose === 'toHand') cardToHand(rt, uid);
  else tendCard(rt, rt.c.cards[uid]!);
}

/** The numb-rules boss that Surfaced Shades veil and grow (Apathy, The Numbness). */
export function numbBoss(rt: Rt): EnemyState | undefined {
  return rt.c.enemies.find((e) => enemyDef(rt, e).numbRules !== undefined);
}

/** Surfaced Resolve (not a Tend): Insight into your hand, or released (B3). */
export function surfacedResolved(rt: Rt, e: EnemyState): void {
  const card = e.surfacedFrom !== null ? rt.c.cards[e.surfacedFrom] : undefined;
  if (!card) return;
  makeInsight(rt, card, card.peakWeight ?? card.weight ?? 1, true);
}

/** Surfaced Suppress: the card returns unchanged and the boss grows +10 x Weight (B2, M4). */
export function surfacedSuppressed(rt: Rt, e: EnemyState): void {
  const card = e.surfacedFrom !== null ? rt.c.cards[e.surfacedFrom] : undefined;
  if (!card) return;
  rt.c.mutations.push({ k: 'returnSurfaced', uid: card.uid });
  returnSurfacedCard(rt, card.uid);
  const boss = numbBoss(rt);
  if (boss) growEnemy(rt, boss, rt.rules.surfacedSuppressGrowPerWeight * (card.weight ?? 1));
}

/** What a Suppress of a Shade showing `shade` does to the deck (preview banner, 4.10). */
export function suppressConsequence(rt: Rt, shade: Shade): { weightAfter: 1 | 2 | 3 | null; overflow: boolean } {
  const max = rt.rules.buriedMaxWeight;
  let w = buriedOfShade(rt, shade)?.weight ?? 0;
  for (const m of rt.c.mutations) if (m.k === 'suppress' && m.shade === shade) w = Math.min(max, w + 1);
  if (w >= max) return { weightAfter: null, overflow: true };
  return { weightAfter: (w + 1) as 1 | 2 | 3, overflow: false };
}
