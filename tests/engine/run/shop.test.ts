import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/engine/combat/index', () => import('./fakeCombat'));

import { cloneJson } from '../../../src/engine/run/clone';
import { rollShopStock } from '../../../src/engine/run/shop';
import type { GameState, ShopStock } from '../../../src/engine/types';
import { count, ctx, engine, freshRun, giveBuried, giveCard, has, step } from './helpers';

const rarityOf = (id: string): string => ctx.pack.cards[id]?.rarity ?? ctx.pack.keepsakes[id]!.rarity;

function inShop(seed: number, prep?: (s: GameState) => void, deep = false): GameState {
  const s = freshRun(seed);
  prep?.(s);
  if (deep) s.run.act = 3;
  s.phase = { kind: 'shop', stock: rollShopStock(s, ctx, 1000 + seed, deep) };
  return s;
}
const stockOf = (s: GameState): ShopStock => (s.phase.kind === 'shop' ? s.phase.stock : (null as never));

const BASE: Record<string, number> = { common: 45, uncommon: 70, rare: 115, blend: 85 };
const KS_BASE: Record<string, number> = { common: 130, uncommon: 170, rare: 220 };

describe('Sanctuary stock (13)', () => {
  it('5 Light cards (2 C, 2 U, 1 R), 2 Blends, 1 neutral, 3 Keepsakes (C, U, R); prices jittered; one card on sale', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const stock = stockOf(inShop(seed));
      const items = stock.items;
      expect(items).toHaveLength(11);
      expect(items.slice(0, 5).map((i) => rarityOf(i.id))).toEqual(['common', 'common', 'uncommon', 'uncommon', 'rare']);
      expect(items.slice(5, 7).map((i) => rarityOf(i.id))).toEqual(['blend', 'blend']);
      expect(ctx.pack.cards[items[7]!.id]!.lights).toEqual([]);
      expect(items.slice(8).map((i) => [i.kind, rarityOf(i.id)])).toEqual([
        ['keepsake', 'common'],
        ['keepsake', 'uncommon'],
        ['keepsake', 'rare'],
      ]);
      expect(new Set(items.map((i) => i.id)).size).toBe(11);
      for (const i of items.slice(0, 7)) expect(ctx.pack.cards[i.id]!.availableFromAct).toBe(1);
      const sale = items.filter((i) => i.sale);
      expect(sale).toHaveLength(1);
      expect(items.indexOf(sale[0]!)).toBeLessThan(8);
      items.forEach((i, idx) => {
        const base = idx >= 8 ? KS_BASE[rarityOf(i.id)]! : idx === 7 ? null : BASE[rarityOf(i.id)]!;
        if (base === null) return;
        const lo = Math.round(base * 0.9);
        const hi = Math.round(base * 1.1);
        if (i.sale) {
          expect(i.price).toBeGreaterThanOrEqual(Math.floor(lo / 2));
          expect(i.price).toBeLessThanOrEqual(Math.floor(hi / 2));
        } else {
          expect(i.price).toBeGreaterThanOrEqual(lo);
          expect(i.price).toBeLessThanOrEqual(hi);
        }
      });
      expect([stock.removePrice, stock.talkPrice, stock.removeUsed, stock.talkUsed]).toEqual([60, 35, false, false]);
      expect(['Found it on a Tuesday.', "No refunds. Herons don't do refunds.", "Shiny. Very shiny. You'll want that."]).toContain(stock.line);
    }
  });

  it('The Deep (M10): 3 Blends incl. both with your most common Light, and the sale item is a Blend', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const s = inShop(seed, (x) => {
        for (let i = 0; i < 4; i++) giveCard(x, 'calm.still_water');
      }, true);
      const blends = stockOf(s).items.filter((i) => rarityOf(i.id) === 'blend');
      expect(blends).toHaveLength(3);
      const ids = blends.map((b) => b.id);
      expect(ids).toContain('blend.wait_it_out');
      expect(ids).toContain('blend.gentle_hands');
      const sale = stockOf(s).items.find((i) => i.sale)!;
      expect(rarityOf(sale.id)).toBe('blend');
    }
  });

  it('never stocks owned Keepsakes', () => {
    const s = inShop(3, (x) => x.run.keepsakes.push({ id: 'ks.paper_crane', counter: 0 }, { id: 'ks.worn_diary', counter: 0 }));
    const rare = stockOf(s).items.at(-1)!;
    expect(rare.id).toBe('ks.friendship_bracelet');
  });
});

describe('buying and services', () => {
  it('buy: pays, adds the card or Keepsake, marks Sold; unaffordable and sold slots are not legal', () => {
    let s = inShop(4);
    s.run.glimmers = 500;
    const stock = stockOf(s);
    s = step(s, { t: 'buy', slot: 0 });
    expect(s.run.glimmers).toBe(500 - stock.items[0]!.price);
    expect(count(s, stock.items[0]!.id)).toBeGreaterThanOrEqual(1);
    expect(stockOf(s).items[0]!.sold).toBe(true);
    expect(has(engine.legalActions(s), { t: 'buy', slot: 0 })).toBe(false);
    s = step(s, { t: 'buy', slot: 10 });
    expect(s.run.keepsakes.map((k) => k.id)).toContain(stock.items[10]!.id);
    s.run.glimmers = 10;
    expect(engine.legalActions(s).filter((a) => a.t === 'buy')).toEqual([]);
    expect(engine.legalActions(s).at(-1)).toEqual({ t: 'leave' });
    expect(step(s, { t: 'leave' }).phase).toEqual({ kind: 'map' });
  });

  it('Set Down: choose any card (incl. Buried), pay 60 (+20 per earlier use), once per visit; skipping is free', () => {
    const s0 = inShop(5, (x) => giveBuried(x, 'anger', 2));
    s0.run.glimmers = 200;
    const s1 = step(s0, { t: 'service', id: 'remove' });
    if (s1.phase.kind !== 'deckSelect') throw new Error('expected deckSelect');
    expect(s1.phase).toMatchObject({ purpose: 'remove', skippable: true });
    expect(s1.phase.options).toEqual(s0.run.deck.map((c) => c.uid));
    expect(s1.run.glimmers).toBe(200);
    const back = step(s1, { t: 'skip' });
    expect(back.phase.kind).toBe('shop');
    expect(back.run.glimmers).toBe(200);
    const buried = s0.run.deck.find((c) => c.defId === 'buried.anger')!;
    const s2 = step(s1, { t: 'choose', uid: buried.uid });
    expect(s2.phase.kind).toBe('shop');
    expect(s2.run.deck.some((c) => c.uid === buried.uid)).toBe(false);
    expect(s2.run.glimmers).toBe(140);
    expect(s2.run.shopRemovals).toBe(1);
    expect(stockOf(s2).removeUsed).toBe(true);
    expect(has(engine.legalActions(s2), { t: 'service', id: 'remove' })).toBe(false);
    // The next Sanctuary charges 80.
    const later = cloneJson(s2);
    later.phase = { kind: 'shop', stock: rollShopStock(later, ctx, 77, false) };
    expect(stockOf(later).removePrice).toBe(80);
  });

  it('Talk it through: 35 to Tend a Buried card; only with one, never with Lead Box', () => {
    const plain = inShop(6);
    expect(has(engine.legalActions(plain), { t: 'service', id: 'talk' })).toBe(false);
    const s0 = inShop(6, (x) => giveBuried(x, 'fear', 2));
    expect(has(engine.legalActions(s0), { t: 'service', id: 'talk' })).toBe(true);
    const b = s0.run.deck.find((c) => c.defId === 'buried.fear')!;
    const s1 = step(step(s0, { t: 'service', id: 'talk' }), { t: 'choose', uid: b.uid });
    expect(s1.run.deck.find((c) => c.uid === b.uid)!.weight).toBe(1);
    expect(s1.run.glimmers).toBe(15);
    expect(stockOf(s1).talkUsed).toBe(true);
    expect(s1.run.stats.tends).toBe(1);
    const lead = inShop(6, (x) => {
      giveBuried(x, 'fear', 2);
      x.run.keepsakes.push({ id: 'ks.lead_box', counter: 0 });
    });
    expect(has(engine.legalActions(lead), { t: 'service', id: 'talk' })).toBe(false);
  });
});
