// Deck mutations between combats (DESIGN 4.10, 10, 13, 14). All functions mutate a cloned draft state.

import { adjacent } from '../emotions';
import type { Rng } from '../rng';
import type { CardId, CardInstance, EngineCtx, GameState, Shade, Uid } from '../types';
import { catalog } from './catalog';
import { cardAct, allocUid, cardDef, hasFlag } from './state';
import { isBuried, lightCards } from './cards';

export function findCard(d: GameState, uid: Uid): CardInstance | null {
  return d.run.deck.find((c) => c.uid === uid) ?? null;
}

export function addCard(d: GameState, ctx: EngineCtx, defId: CardId, upgraded: boolean): CardInstance {
  cardDef(ctx, defId);
  const card: CardInstance = { uid: allocUid(d), defId, upgraded };
  d.run.deck.push(card);
  return card;
}

export function removeCard(d: GameState, uid: Uid): void {
  d.run.deck = d.run.deck.filter((c) => c.uid !== uid);
}

export function upgradeCard(d: GameState, uid: Uid): void {
  const c = findCard(d, uid);
  if (c) c.upgraded = true;
}

export function duplicateCard(d: GameState, ctx: EngineCtx, uid: Uid): void {
  const c = findCard(d, uid);
  if (c) addCard(d, ctx, c.defId, c.upgraded);
}

export type BuriedChange = 'added' | 'heavier' | 'overflow';

/** Suppress bookkeeping (4.10): add Buried W1, or +1 Weight, or at max Weight lose max Heart instead. */
export function addBuried(d: GameState, ctx: EngineCtx, shade: Shade): BuriedChange {
  const def = catalog(ctx.pack).buriedByShade[shade];
  if (!def) throw new Error(`No Buried card for ${shade}`);
  const existing = d.run.deck.find((c) => c.defId === def.id);
  if (!existing) {
    d.run.deck.push({ uid: allocUid(d), defId: def.id, upgraded: false, weight: 1, peakWeight: 1 });
    return 'added';
  }
  const w = existing.weight ?? 1;
  if (w < Math.min(3, ctx.rules.buriedMaxWeight)) {
    const next = (w + 1) as 1 | 2 | 3;
    existing.weight = next;
    existing.peakWeight = Math.max(existing.peakWeight ?? w, next) as 1 | 2 | 3;
    return 'heavier';
  }
  d.run.maxHeart = Math.max(1, d.run.maxHeart - ctx.rules.buriedOverflowMaxHeart);
  d.run.heart = Math.min(d.run.heart, d.run.maxHeart);
  return 'overflow';
}

export const insightUpgradedFor = (d: GameState, ctx: EngineCtx, card: CardInstance): boolean =>
  (card.peakWeight ?? card.weight ?? 1) >= 2 || hasFlag(d.run, ctx, 'insightUpgraded') || hasFlag(d.run, ctx, 'wornDiary');

export type ZeroOutcome = 'insight' | 'peace';

/**
 * A Buried card reached Weight 0 (B3): it becomes its Insight, or is removed if that Insight was already
 * created this run. `upgraded` overrides the peakWeight/Worn Diary rule (combat mutations carry their own).
 */
export function buriedToInsight(d: GameState, ctx: EngineCtx, uid: Uid, to?: CardId, upgraded?: boolean): ZeroOutcome {
  const card = findCard(d, uid);
  if (!card) return 'peace';
  const def = cardDef(ctx, card.defId);
  const insight = to ?? def.buried?.insight;
  if (!insight || d.run.insightsMade.includes(insight)) {
    removeCard(d, uid);
    return 'peace';
  }
  const up = upgraded ?? insightUpgradedFor(d, ctx, card);
  card.defId = insight;
  card.upgraded = up;
  delete card.weight;
  delete card.peakWeight;
  d.run.insightsMade.push(insight);
  return 'insight';
}

export type TendOutcome = 'tended' | ZeroOutcome | 'none';

/** Out-of-combat Tend (Haven Reflect, Talk it through, The Unsent Letter). */
export function tendCard(d: GameState, ctx: EngineCtx, uid: Uid): TendOutcome {
  const card = findCard(d, uid);
  if (!card || !isBuried(cardDef(ctx, card.defId))) return 'none';
  d.run.stats.tends += 1;
  const w = card.weight ?? 1;
  if (w > 1) {
    card.weight = (w - 1) as 1 | 2;
    return 'tended';
  }
  const out = buriedToInsight(d, ctx, uid);
  if (out === 'insight') d.run.stats.insights += 1;
  return out;
}

/** Mirror Pond "Make a face": becomes a random upgraded card of a Light adjacent to its own (available Lights). */
export function mirrorTransform(d: GameState, ctx: EngineCtx, uid: Uid, rng: Rng): void {
  const card = findCard(d, uid);
  if (!card) return;
  const own = cardDef(ctx, card.defId).lights;
  if (own.length !== 1) return;
  const pool = lightCards(ctx, cardAct(d.run)).filter((x) => adjacent(x.lights[0]!, own[0]!));
  if (pool.length === 0) return;
  card.defId = rng.pick(pool).id;
  card.upgraded = true;
}

export const buriedCards = (d: GameState, ctx: EngineCtx): CardInstance[] =>
  d.run.deck.filter((c) => isBuried(cardDef(ctx, c.defId)));
