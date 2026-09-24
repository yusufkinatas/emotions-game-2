// Pure helpers behind the non-combat screens: reward wheel lines, card grouping (the draw pile's order stays
// hidden), the Light Mix "+1" ghost and the Lights-used ring. DOM-free, so they run in Node.
import { describe, expect, it } from 'vitest';
import { defaultPack } from '../../../src/content/index';
import { createEngine } from '../../../src/engine/index';
import type { CardInstance } from '../../../src/engine/index';
import { buriedShades, wheelLines } from '../../../src/ui/components/cards';
import { groupCards, lightMixSegments } from '../../../src/ui/components/cardGrid';
import { lightsRingMarkup } from '../../../src/ui/screens/ending';

const engine = createEngine(defaultPack);
const def = (id: string) => {
  const d = defaultPack.cards[id];
  if (!d) throw new Error(`missing card ${id}`);
  return d;
};
const card = (uid: number, defId: string, extra: Partial<CardInstance> = {}): CardInstance => ({ uid, defId, upgraded: false, ...extra });

describe('reward wheel lines (16.5)', () => {
  it('a Love card answers Anger, Harmonizes with Joy and Calm and is DISSONANT vs Sadness', () => {
    const w = wheelLines(def('love.kind_word'), []);
    expect(w.answers).toEqual(['anger']);
    expect(w.harmonizes.sort()).toEqual(['calm', 'joy']);
    expect(w.dissonant).toBe('sadness');
    expect(w.tends).toEqual([]);
  });

  it('a Blend answers both faces, is never DISSONANT and Harmonizes only outside its pair', () => {
    const w = wheelLines(def('blend.sunbeam'), ['sadness']);
    expect(w.answers).toEqual(['anger', 'sadness']);
    expect(w.dissonant).toBeNull();
    expect(w.harmonizes.sort()).toEqual(['calm', 'friendship']);
    expect(w.tends).toEqual(['sadness']);
  });

  it('lists the Buried Shades a deck holds', () => {
    const deck = [card(1, 'buried.anger', { weight: 2 }), card(2, 'love.kind_word'), card(3, 'buried.anger', { weight: 1 })];
    expect(buriedShades(engine, deck)).toEqual(['anger']);
  });
});

describe('card groups (16.6)', () => {
  const views = [
    { defId: 'buried.fear', upgraded: false, weight: 1 },
    { defId: 'courage.brave_strike', upgraded: false },
    { defId: 'blend.sunbeam', upgraded: false },
    { defId: 'love.kind_word', upgraded: false },
    { defId: 'joy.bright_spark', upgraded: false },
  ];

  it('orders Lights in wheel order, then Blends, neutral, Insight and Buried', () => {
    expect(groupCards(defaultPack, views).map((g) => g.key)).toEqual(['love', 'joy', 'courage', 'blend', 'buried']);
  });

  it('never shows pile order: any shuffle of the same cards groups identically', () => {
    const a = groupCards(defaultPack, views).map((g) => g.items.map((v) => v.defId));
    const b = groupCards(defaultPack, [...views].reverse()).map((g) => g.items.map((v) => v.defId));
    expect(b).toEqual(a);
  });
});

describe('Light Mix segments (16.4, 16.5)', () => {
  it('puts the +1 ghost on the hovered card\'s segment', () => {
    const s = engine.newRun(3, { tutorial: false, charm: 'ks.warm_locket' });
    const summary = engine.deckSummary(s);
    const segs = lightMixSegments(engine, s.run.deck, summary, def('joy.bright_spark'));
    expect(segs.ghost).toBeDefined();
    const g = segs[segs.ghost!]!;
    expect(g.kind === 'light' && g.light).toBe('joy');
    expect(g.count).toBe(summary.byLight.joy + 1);
  });

  it('splits Buried cards by Shade', () => {
    const s = engine.newRun(3, { tutorial: false, charm: 'ks.warm_locket' });
    const deck = [...s.run.deck, card(900, 'buried.anger', { weight: 2 })];
    const segs = lightMixSegments(engine, deck, engine.deckSummary({ ...s, run: { ...s.run, deck } }));
    expect(segs.find((x) => x.kind === 'buried' && x.shade === 'anger')?.count).toBe(1);
  });
});

describe('Lights used ring (15.4)', () => {
  it('labels every Light played with its count', () => {
    const m = lightsRingMarkup({ love: 3, joy: 1 });
    expect(m).toContain('aria-label="Lights used: Love 3, Joy 1"');
    expect((m.match(/data-light=/g) ?? []).length).toBe(2);
  });

  it('reads cleanly with no plays', () => {
    expect(lightsRingMarkup({})).toContain('No Light cards played');
  });
});
