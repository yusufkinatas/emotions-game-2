import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/engine/combat/index', () => import('./fakeCombat'));

import type { GameState } from '../../../src/engine/types';
import { engine, freshRun, giveBuried, step } from './helpers';

function atHaven(seed: number, prep?: (s: GameState) => void): GameState {
  const s = freshRun(seed);
  prep?.(s);
  s.phase = { kind: 'haven' };
  return s;
}

describe('Haven (14)', () => {
  it('Rest Mends 30% of max Heart (rounded down), capped, and returns to the map', () => {
    const s = atHaven(1, (x) => {
      x.run.maxHeart = 67;
      x.run.heart = 20;
    });
    expect(engine.havenOptions(s)[0]).toEqual({ id: 'rest', available: true, reason: null, heartAfter: 40 });
    const r = step(s, { t: 'rest' });
    expect(r.run.heart).toBe(40);
    expect(r.phase).toEqual({ kind: 'map' });
    const full = step(atHaven(1), { t: 'rest' });
    expect(full.run.heart).toBe(70);
  });

  it('availability: Spiral Shell forbids Rest, Reflect needs a Buried card and no Lead Box', () => {
    expect(engine.legalActions(atHaven(2))).toEqual([{ t: 'rest' }, { t: 'kindle' }]);
    const buried = atHaven(2, (x) => giveBuried(x, 'anger', 1));
    expect(engine.legalActions(buried)).toEqual([{ t: 'rest' }, { t: 'kindle' }, { t: 'reflect' }]);
    const shell = atHaven(2, (x) => x.run.keepsakes.push({ id: 'ks.spiral_shell', counter: 0 }));
    expect(engine.legalActions(shell)).toEqual([{ t: 'kindle' }]);
    expect(engine.havenOptions(shell)[0]!.reason).toMatch(/Spiral Shell/);
    const lead = atHaven(2, (x) => {
      giveBuried(x, 'anger', 1);
      x.run.keepsakes.push({ id: 'ks.lead_box', counter: 0 });
    });
    expect(engine.legalActions(lead)).toEqual([{ t: 'rest' }, { t: 'kindle' }]);
    const none = atHaven(2, (x) => {
      x.run.keepsakes.push({ id: 'ks.spiral_shell', counter: 0 });
      for (const c of x.run.deck) c.upgraded = true;
    });
    expect(engine.legalActions(none)).toEqual([{ t: 'leave' }]);
    expect(engine.havenOptions(freshRun(2))).toEqual([]);
  });

  it('Kindle upgrades a card of your choice; skipping returns to the Haven', () => {
    const s = atHaven(3);
    const k = step(s, { t: 'kindle' });
    if (k.phase.kind !== 'deckSelect') throw new Error('expected deckSelect');
    expect(k.phase).toMatchObject({ purpose: 'upgrade', skippable: true });
    expect(k.phase.options).toEqual(s.run.deck.map((c) => c.uid));
    expect(step(k, { t: 'skip' }).phase).toEqual({ kind: 'haven' });
    const uid = s.run.deck[3]!.uid;
    const done = step(k, { t: 'choose', uid });
    expect(done.run.deck[3]!.upgraded).toBe(true);
    expect(done.phase).toEqual({ kind: 'map' });
  });

  it('Reflect Tends; at Weight 0 the Insight is upgraded if peakWeight >= 2 (or Worn Diary)', () => {
    const s = atHaven(4, (x) => giveBuried(x, 'fear', 1, 2));
    const b = s.run.deck.at(-1)!;
    const done = step(step(s, { t: 'reflect' }), { t: 'choose', uid: b.uid });
    expect(done.run.deck.find((c) => c.uid === b.uid)).toEqual({ uid: b.uid, defId: 'insight.instinct', upgraded: true });
    expect(done.run.insightsMade).toEqual(['insight.instinct']);
    expect([done.run.stats.tends, done.run.stats.insights]).toEqual([1, 1]);

    const plain = atHaven(4, (x) => giveBuried(x, 'fear', 1, 1));
    const p = step(step(plain, { t: 'reflect' }), { t: 'choose', uid: plain.run.deck.at(-1)!.uid });
    expect(p.run.deck.at(-1)).toMatchObject({ defId: 'insight.instinct', upgraded: false });

    const diary = atHaven(4, (x) => {
      giveBuried(x, 'fear', 1, 1);
      x.run.keepsakes.push({ id: 'ks.worn_diary', counter: 0 });
    });
    const dd = step(step(diary, { t: 'reflect' }), { t: 'choose', uid: diary.run.deck.at(-1)!.uid });
    expect(dd.run.deck.at(-1)).toMatchObject({ defId: 'insight.instinct', upgraded: true });
  });

  it('B3: Reflecting a Buried card whose Insight was already made releases it', () => {
    const s = atHaven(5, (x) => {
      giveBuried(x, 'anger', 1);
      x.run.insightsMade = ['insight.passion'];
    });
    const b = s.run.deck.at(-1)!;
    const done = step(step(s, { t: 'reflect' }), { t: 'choose', uid: b.uid });
    expect(done.run.deck.some((c) => c.uid === b.uid)).toBe(false);
    expect(done.run.deck.some((c) => c.defId === 'insight.passion')).toBe(false);
  });
});
