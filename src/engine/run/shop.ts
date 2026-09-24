// Sanctuary (DESIGN 13, M10): stock, prices, jitter, sale, and the Set Down / Talk it through services.

import { BLENDS, lightsOfBlend } from '../emotions';
import { rngFrom, type Rng } from '../rng';
import type { CardDef, EngineCtx, GameState, KeepsakeId, ShopItem, ShopStock } from '../types';
import { blendCards, isBuried, lightCards, neutralCards, rollRarity, type OfferRarity } from './cards';
import { addCard } from './deck';
import { openDeckSelect, selectOptions } from './deckSelect';
import { drawPoolKeepsake, grantKeepsake, keepsakeRarity } from './keepsakes';
import { cardAct, cardDef, hasFlag } from './state';
import { easeCounts, mostCommonLights } from './view';

const CARD_PRICE: Record<OfferRarity, number> = { common: 45, uncommon: 70, rare: 115 };
const BLEND_PRICE = 85;
const KEEPSAKE_PRICE: Record<OfferRarity, number> = { common: 130, uncommon: 170, rare: 220 };
const NEUTRAL_WEIGHTS: Record<OfferRarity, number> = { common: 60, uncommon: 30, rare: 10 };
const JITTER = [0.9, 0.95, 1, 1.05, 1.1] as const;
const LIGHT_SLOTS: readonly OfferRarity[] = ['common', 'common', 'uncommon', 'uncommon', 'rare'];
const KEEPSAKE_SLOTS: readonly OfferRarity[] = ['common', 'uncommon', 'rare'];
const REMOVE_BASE = 60;
const REMOVE_STEP = 20;
const TALK_PRICE = 35;
const NORMAL_BLENDS = 2;
const MO_LINES = [
  'Found it on a Tuesday.',
  "No refunds. Herons don't do refunds.",
  "Shiny. Very shiny. You'll want that.",
] as const;

export const removePriceFor = (removals: number): number => REMOVE_BASE + REMOVE_STEP * removals;

const jitter = (rng: Rng, price: number): number => Math.round(price * rng.pick(JITTER));

const cardPrice = (d: CardDef): number =>
  d.rarity === 'blend' ? BLEND_PRICE : CARD_PRICE[d.rarity === 'uncommon' || d.rarity === 'rare' ? d.rarity : 'common'];

function pickFresh(rng: Rng, pool: readonly CardDef[], taken: ShopItem[]): CardDef | null {
  const fresh = pool.filter((d) => !taken.some((t) => t.id === d.id));
  return fresh.length > 0 ? rng.pick(fresh) : null;
}

/** The Deep (M10): both Blends that contain your most common Light, plus 1 random other Blend. */
function deepBlends(d: GameState, ctx: EngineCtx, rng: Rng): CardDef[] {
  const pool = blendCards(ctx, 2);
  const top = mostCommonLights(easeCounts(d.run.deck, ctx))[0]!;
  const withTop = BLENDS.filter((b) => lightsOfBlend(b).includes(top));
  const fixed = pool.filter((c) =>
    withTop.some((b) => {
      const [x, y] = lightsOfBlend(b);
      return c.lights.includes(x) && c.lights.includes(y);
    }),
  );
  const others = pool.filter((c) => !fixed.includes(c));
  return others.length > 0 ? [...fixed, rng.pick(others)] : fixed;
}

/** Stock rolled on entry with the node's shop stream. */
export function rollShopStock(d: GameState, ctx: EngineCtx, nodeSeed: number, deep: boolean): ShopStock {
  const rng = rngFrom(nodeSeed, 'shop');
  const act = cardAct(d.run);
  const items: ShopItem[] = [];
  const cardItem = (def: CardDef): ShopItem => ({ kind: 'card', id: def.id, price: jitter(rng, cardPrice(def)), sale: false, sold: false });

  for (const rarity of LIGHT_SLOTS) {
    const def = pickFresh(rng, lightCards(ctx, act, undefined, rarity), items);
    if (def) items.push(cardItem(def));
  }
  const blendStart = items.length;
  if (deep) {
    for (const def of deepBlends(d, ctx, rng)) items.push(cardItem(def));
  } else {
    for (let n = 0; n < NORMAL_BLENDS; n++) {
      const def = pickFresh(rng, blendCards(ctx, act), items);
      if (def) items.push(cardItem(def));
    }
  }
  const blendEnd = items.length;
  const nRarity = rollRarity(rng, NEUTRAL_WEIGHTS);
  const neutral = pickFresh(rng, neutralCards(ctx, act, nRarity), items) ?? pickFresh(rng, neutralCards(ctx, act), items);
  if (neutral) items.push(cardItem(neutral));
  const cardEnd = items.length;

  const stocked: KeepsakeId[] = [];
  for (const rarity of KEEPSAKE_SLOTS) {
    const id = drawPoolKeepsake(d.run, ctx, rng, rarity, stocked);
    if (!id) continue;
    stocked.push(id);
    const r = keepsakeRarity(ctx, id);
    const base = KEEPSAKE_PRICE[r === 'uncommon' || r === 'rare' ? r : 'common'];
    items.push({ kind: 'keepsake', id, price: jitter(rng, base), sale: false, sold: false });
  }

  const saleSlots: number[] = [];
  const [from, to] = deep && blendEnd > blendStart ? [blendStart, blendEnd] : [0, cardEnd];
  for (let i = from; i < to; i++) saleSlots.push(i);
  if (saleSlots.length > 0) {
    const item = items[rng.pick(saleSlots)]!;
    item.sale = true;
    item.price = Math.floor(item.price / 2);
  }

  return {
    items,
    removeUsed: false,
    talkUsed: false,
    removePrice: removePriceFor(d.run.shopRemovals),
    talkPrice: TALK_PRICE,
    line: rng.pick(MO_LINES),
  };
}

export const canBuy = (d: GameState, item: ShopItem): boolean => !item.sold && d.run.glimmers >= item.price;

export function canRemoveService(d: GameState, stock: ShopStock): boolean {
  return !stock.removeUsed && d.run.deck.length > 0 && d.run.glimmers >= stock.removePrice;
}

export function canTalkService(d: GameState, ctx: EngineCtx, stock: ShopStock): boolean {
  return (
    !stock.talkUsed &&
    !hasFlag(d.run, ctx, 'leadBox') &&
    d.run.glimmers >= stock.talkPrice &&
    d.run.deck.some((c) => isBuried(cardDef(ctx, c.defId)))
  );
}

export function buy(d: GameState, ctx: EngineCtx, slot: number): void {
  if (d.phase.kind !== 'shop') return;
  const item = d.phase.stock.items[slot]!;
  d.run.glimmers -= item.price;
  item.sold = true;
  if (item.kind === 'card') addCard(d, ctx, item.id, false);
  else grantKeepsake(d, ctx, item.id);
}

/** Opens the card choice. Payment happens when a card is chosen, so backing out is free. */
export function openService(d: GameState, ctx: EngineCtx, id: 'remove' | 'talk'): void {
  if (d.phase.kind !== 'shop') return;
  const stock = d.phase.stock;
  const then = d.phase;
  if (id === 'remove') {
    openDeckSelect(d, 'remove', d.run.deck.map((c) => c.uid), then, true, {
      kind: 'shop',
      service: 'remove',
      price: stock.removePrice,
    });
  } else {
    openDeckSelect(d, 'tend', selectOptions(d, ctx, 'tend'), then, true, {
      kind: 'shop',
      service: 'talk',
      price: stock.talkPrice,
    });
  }
}

/** After the service's card was chosen: pay and mark it used on the shop phase we return to. */
export function settleService(d: GameState, stock: ShopStock, service: 'remove' | 'talk', price: number): void {
  d.run.glimmers -= price;
  if (service === 'remove') {
    d.run.shopRemovals += 1;
    stock.removeUsed = true;
    stock.removePrice = removePriceFor(d.run.shopRemovals);
  } else {
    stock.talkUsed = true;
  }
}
