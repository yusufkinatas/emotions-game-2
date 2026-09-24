import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/engine/combat/index', () => import('./fakeCombat'));

import { cloneJson } from '../../../src/engine/run/clone';
import { applyCombatResult } from '../../../src/engine/run/finishCombat';
import type { CombatResult, DeckMutation, GameState } from '../../../src/engine/types';
import { emptyCombatStats } from './fakeCombat';
import { ctx, engine, freshRun, giveBuried } from './helpers';

function result(over: Partial<CombatResult> = {}): CombatResult {
  return {
    outcome: 'won',
    heartAfter: 70,
    glimmers: 0,
    mutations: [],
    keepsakeCounters: {},
    paperCraneUsed: false,
    allResolved: false,
    gone: [],
    stats: emptyCombatStats(),
    ...over,
  };
}

function apply(s: GameState, mutations: DeckMutation[], over: Partial<CombatResult> = {}): GameState {
  const d = cloneJson(s);
  applyCombatResult(d, ctx, result({ heartAfter: s.run.heart, mutations, ...over }));
  expect(engine.checkInvariants(d)).toEqual([]);
  return d;
}

const buriedOf = (s: GameState, id: string) => s.run.deck.find((c) => c.defId === id);

describe('finishCombat: Buried bookkeeping (4.10)', () => {
  it('Suppress adds Buried W1, then +1 Weight, then overflows into -3 max Heart', () => {
    const s0 = freshRun(1);
    const s1 = apply(s0, [{ k: 'suppress', shade: 'anger' }]);
    expect(buriedOf(s1, 'buried.anger')).toEqual({ uid: s0.nextUid, defId: 'buried.anger', upgraded: false, weight: 1, peakWeight: 1 });
    expect(s1.nextUid).toBe(s0.nextUid + 1);
    const s3 = apply(s1, [
      { k: 'suppress', shade: 'anger' },
      { k: 'suppress', shade: 'anger' },
    ]);
    expect(buriedOf(s3, 'buried.anger')).toMatchObject({ weight: 3, peakWeight: 3 });
    const s4 = apply(s3, [{ k: 'suppress', shade: 'anger' }]);
    expect(buriedOf(s4, 'buried.anger')).toMatchObject({ weight: 3 });
    expect([s4.run.heart, s4.run.maxHeart]).toEqual([67, 67]);
    expect(s4.run.deck.filter((c) => c.defId === 'buried.anger')).toHaveLength(1);
  });

  it('respects buriedOverflowMaxHeart from the rules', () => {
    const s = freshRun(1);
    giveBuried(s, 'fear', 3);
    const d = cloneJson(s);
    applyCombatResult(d, { ...ctx, rules: { ...ctx.rules, buriedOverflowMaxHeart: 5 } }, result({ mutations: [{ k: 'suppress', shade: 'fear' }] }));
    expect(d.run.maxHeart).toBe(65);
  });

  it('tend lowers Weight; a Tend to 0 without a follow-up mutation makes the Insight', () => {
    const s = freshRun(2);
    const b = giveBuried(s, 'sadness', 2);
    const s1 = apply(s, [{ k: 'tend', uid: b.uid }]);
    expect(buriedOf(s1, 'buried.sadness')).toMatchObject({ weight: 1, peakWeight: 2 });
    const s2 = apply(s1, [{ k: 'tend', uid: b.uid }]);
    expect(s2.run.deck.find((c) => c.uid === b.uid)).toEqual({ uid: b.uid, defId: 'insight.bittersweet', upgraded: true });
    expect(s2.run.insightsMade).toEqual(['insight.bittersweet']);
  });

  it('a combat transform wins over the Tend to 0 before it (applied once)', () => {
    const s = freshRun(3);
    const b = giveBuried(s, 'fear', 1);
    const s1 = apply(s, [
      { k: 'tend', uid: b.uid },
      { k: 'transform', uid: b.uid, to: 'insight.instinct', upgraded: false },
    ]);
    expect(s1.run.deck.find((c) => c.uid === b.uid)).toEqual({ uid: b.uid, defId: 'insight.instinct', upgraded: false });
    expect(s1.run.insightsMade).toEqual(['insight.instinct']);
  });

  it('transform (Surfaced Resolve) keeps the upgrade flag it carries and records the Insight', () => {
    const s = freshRun(4);
    const b = giveBuried(s, 'anger', 2);
    const s1 = apply(s, [{ k: 'transform', uid: b.uid, to: 'insight.passion', upgraded: true }]);
    expect(s1.run.deck.find((c) => c.uid === b.uid)).toEqual({ uid: b.uid, defId: 'insight.passion', upgraded: true });
    expect(s1.run.insightsMade).toEqual(['insight.passion']);
  });

  it('B3: an Insight already created this run is never made again; the Buried card is released', () => {
    const s = freshRun(5);
    s.run.insightsMade = ['insight.passion'];
    const b = giveBuried(s, 'anger', 1);
    const s1 = apply(s, [{ k: 'transform', uid: b.uid, to: 'insight.passion', upgraded: false }]);
    expect(s1.run.deck.some((c) => c.uid === b.uid)).toBe(false);
    const s2 = freshRun(5);
    s2.run.insightsMade = ['insight.passion'];
    const b2 = giveBuried(s2, 'anger', 1);
    const s3 = apply(s2, [{ k: 'tend', uid: b2.uid }]);
    expect(s3.run.deck.some((c) => c.uid === b2.uid)).toBe(false);
    expect(s3.run.insightsMade).toEqual(['insight.passion']);
  });

  it("'remove' drops the card and 'returnSurfaced' leaves it unchanged", () => {
    const s = freshRun(6);
    const a = giveBuried(s, 'anger', 2);
    const f = giveBuried(s, 'fear', 3);
    const s1 = apply(s, [
      { k: 'remove', uid: a.uid },
      { k: 'returnSurfaced', uid: f.uid },
    ]);
    expect(s1.run.deck.some((c) => c.uid === a.uid)).toBe(false);
    expect(s1.run.deck.find((c) => c.uid === f.uid)).toEqual(f);
  });

  it('mutations apply in chronological order', () => {
    const s = freshRun(7);
    const b = giveBuried(s, 'loneliness', 1);
    // Tend to 0 first (Insight), then a new Suppress starts a fresh Buried Loneliness.
    const s1 = apply(s, [
      { k: 'transform', uid: b.uid, to: 'insight.solitude', upgraded: false },
      { k: 'suppress', shade: 'loneliness' },
    ]);
    expect(s1.run.deck.filter((c) => c.defId === 'buried.loneliness')).toHaveLength(1);
    expect(s1.run.deck.filter((c) => c.defId === 'insight.solitude')).toHaveLength(1);
  });
});

describe('finishCombat: run counters', () => {
  it('Heart, Glimmers, Keepsake counters, Paper Crane, stats and combatsWon', () => {
    const s = freshRun(8);
    s.run.keepsakes.push({ id: 'ks.paper_crane', counter: 0 });
    const stats = {
      ...emptyCombatStats(),
      resolved: 2,
      suppressed: 1,
      harmonies: 3,
      tends: 1,
      cardsPlayed: 9,
      heartLost: 12,
      playsByLight: { love: 4, joy: 2 },
      playsByCard: { 'love.kind_word': 3 },
      dmgByRelation: { opposite: 30, dissonant: 2 },
    };
    const d = cloneJson(s);
    applyCombatResult(d, ctx, result({ heartAfter: 25, glimmers: 26, keepsakeCounters: { 'ks.paper_crane': 1 }, paperCraneUsed: true, stats }));
    expect(d.run.heart).toBe(25);
    expect(d.run.glimmers).toBe(76);
    expect(d.run.keepsakes.find((k) => k.id === 'ks.paper_crane')!.counter).toBe(1);
    expect(d.run.paperCraneUsed).toBe(true);
    expect(d.run.combatsWon).toBe(1);
    expect(d.run.stats).toMatchObject({ resolved: 2, suppressed: 1, harmonies: 3, tends: 1, cardsPlayed: 9, heartLost: 12, combats: 1 });
    expect(d.run.stats.playsByLight).toMatchObject({ love: 4, joy: 2, calm: 0 });
    expect(d.run.stats.playsByCard).toEqual({ 'love.kind_word': 3 });
    expect(d.run.stats.dmgByRelation).toMatchObject({ opposite: 30, dissonant: 2, neutral: 0 });
    applyCombatResult(d, ctx, result({ outcome: 'lost', heartAfter: 0, stats }));
    expect(d.run.combatsWon).toBe(1);
    expect(d.run.stats.combats).toBe(2);
    expect(d.run.stats.playsByCard['love.kind_word']).toBe(6);
  });

  it('caps Heart to max Heart', () => {
    const s = freshRun(9);
    const d = cloneJson(s);
    applyCombatResult(d, ctx, result({ heartAfter: 90 }));
    expect(d.run.heart).toBe(70);
  });
});
