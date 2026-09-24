import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/engine/combat/index', () => import('./fakeCombat'));

import { adjacent } from '../../../src/engine/emotions';
import { pickEvent } from '../../../src/engine/run/events';
import type { GameState } from '../../../src/engine/types';
import { count, ctx, engine, freshRun, giveBuried, giveCard, step } from './helpers';

function atEvent(eventId: string, seed = 1, prep?: (s: GameState) => void): GameState {
  const s = freshRun(seed);
  s.run.map.current = s.run.map.nodes.find((n) => n.row === 3)!.id;
  prep?.(s);
  s.phase = { kind: 'event', eventId, chosen: null };
  return s;
}

const done = (s: GameState): GameState => {
  expect(s.phase.kind).toBe('event');
  expect(engine.legalActions(s)).toEqual([{ t: 'continue' }]);
  return step(s, { t: 'continue' });
};

describe('choosing a Memory (10)', () => {
  it('picks unused events only, each once per run, then the fallback', () => {
    const s = freshRun(1);
    const node = s.run.map.nodes[0]!;
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) seen.add(pickEvent(s, ctx, { ...node, seed: node.seed + i }));
    expect(seen.size).toBe(6);
    expect(seen.has('mem.quiet_moment')).toBe(false);
    expect(s.run.usedEvents).toHaveLength(6);
    expect(pickEvent(s, ctx, node)).toBe('mem.quiet_moment');
  });
});

describe('options: availability (10, minor-12)', () => {
  it('disabled options carry their reason and are not legal', () => {
    const s = atEvent('mem.unsent_letter', 1, (x) => x.run.keepsakes.push({ id: 'ks.paper_crane', counter: 0 }));
    const views = engine.eventOptions(s);
    expect(views.map((v) => v.enabled)).toEqual([true, false, true]);
    expect(views[1]!.reason).toBe('You already carry a paper crane.');
    expect(engine.legalActions(s)).toEqual([
      { t: 'option', i: 0 },
      { t: 'option', i: 2 },
    ]);
  });

  it('an option whose Heart cost is >= your Heart is disabled ("Not enough Heart")', () => {
    const at6 = atEvent('mem.unsent_letter', 1, (x) => (x.run.heart = 6));
    expect(engine.eventOptions(at6)[0]).toMatchObject({ enabled: false, reason: 'Not enough Heart' });
    const at7 = atEvent('mem.unsent_letter', 1, (x) => (x.run.heart = 7));
    expect(engine.eventOptions(at7)[0]!.enabled).toBe(true);
  });

  it('Lead Box: "Read it aloud" with a Buried card is disabled (it could only take the Heart); without one it upgrades', () => {
    const leadBox = (x: GameState): void => void x.run.keepsakes.push({ id: 'ks.lead_box', counter: 0 });
    const buried = atEvent('mem.unsent_letter', 1, (x) => {
      leadBox(x);
      giveBuried(x, 'anger', 1);
    });
    expect(engine.eventOptions(buried)[0]).toMatchObject({ enabled: false, reason: "The Lead Box won't let you Tend." });
    expect(engine.legalActions(buried)).not.toContainEqual({ t: 'option', i: 0 });
    const none = atEvent('mem.unsent_letter', 1, leadBox);
    expect(engine.eventOptions(none)[0]).toMatchObject({ enabled: true, reason: null });
    expect(step(none, { t: 'option', i: 0 }).run.deck.filter((c) => c.upgraded)).toHaveLength(2);
  });

  it('Glimmer requirements', () => {
    const poor = atEvent('mem.tea_slowly', 1, (x) => (x.run.glimmers = 24));
    expect(engine.eventOptions(poor)[1]).toMatchObject({ enabled: false, reason: 'Needs 25 Glimmers.' });
  });
});

describe('RunEffect interpreter', () => {
  it('The Unsent Letter, read aloud: lose 6 Heart, then Tend a Buried card of your choice (no skip)', () => {
    const s = atEvent('mem.unsent_letter', 2, (x) => giveBuried(x, 'sadness', 2));
    const b = s.run.deck.at(-1)!;
    const sel = step(s, { t: 'option', i: 0 });
    expect(sel.run.heart).toBe(64);
    if (sel.phase.kind !== 'deckSelect') throw new Error('expected deckSelect');
    expect(sel.phase).toMatchObject({ purpose: 'tend', options: [b.uid], skippable: false });
    expect(engine.legalActions(sel)).toEqual([{ t: 'choose', uid: b.uid }]);
    const after = step(sel, { t: 'choose', uid: b.uid });
    expect(after.run.deck.at(-1)!.weight).toBe(1);
    expect(after.phase).toEqual({ kind: 'event', eventId: 'mem.unsent_letter', chosen: 0 });
    expect(done(after).phase).toEqual({ kind: 'map' });
  });

  it('... with no Buried card: upgrade 2 random cards', () => {
    const after = step(atEvent('mem.unsent_letter', 3), { t: 'option', i: 0 });
    expect(after.run.deck.filter((c) => c.upgraded)).toHaveLength(2);
  });

  it('Fold it into a paper crane: Paper Crane and Buried Sadness', () => {
    const after = step(atEvent('mem.unsent_letter', 4), { t: 'option', i: 1 });
    expect(after.run.keepsakes.map((k) => k.id)).toContain('ks.paper_crane');
    expect(after.run.deck.at(-1)).toMatchObject({ defId: 'buried.sadness', weight: 1 });
  });

  it('The Campfire: Mend, a random upgraded Friendship card, or Heart for Glimmers', () => {
    const hurt = atEvent('mem.campfire', 5, (x) => (x.run.heart = 30));
    expect(step(hurt, { t: 'option', i: 0 }).run.heart).toBe(46);
    const swap = step(atEvent('mem.campfire', 5), { t: 'option', i: 1 });
    const added = swap.run.deck.at(-1)!;
    expect(ctx.pack.cards[added.defId]!.lights).toEqual(['friendship']);
    expect(added.upgraded).toBe(true);
    const watch = step(atEvent('mem.campfire', 5), { t: 'option', i: 2 });
    expect([watch.run.heart, watch.run.glimmers]).toEqual([65, 95]);
    expect(watch.run.stats.heartLost).toBe(5);
  });

  it('The Mirror Pond: duplicate (not Buried, not Insight) and transform to a neighbouring Light, upgraded', () => {
    const s = atEvent('mem.mirror_pond', 6, (x) => {
      giveBuried(x, 'anger', 1);
      giveCard(x, 'insight.passion');
      x.run.insightsMade = ['insight.passion'];
    });
    const dup = step(s, { t: 'option', i: 0 });
    if (dup.phase.kind !== 'deckSelect') throw new Error('expected deckSelect');
    const ids = dup.phase.options.map((u) => s.run.deck.find((c) => c.uid === u)!.defId);
    expect(ids).not.toContain('buried.anger');
    expect(ids).not.toContain('insight.passion');
    const kind = s.run.deck[0]!;
    const after = step(dup, { t: 'choose', uid: kind.uid });
    expect(count(after, 'love.kind_word')).toBe(count(s, 'love.kind_word') + 1);

    for (let seed = 1; seed <= 20; seed++) {
      const t = step(atEvent('mem.mirror_pond', seed), { t: 'option', i: 1 });
      if (t.phase.kind !== 'deckSelect') throw new Error('expected deckSelect');
      const target = t.run.deck.find((c) => c.defId === 'courage.brave_strike')!;
      const res = step(t, { t: 'choose', uid: target.uid }).run.deck.find((c) => c.uid === target.uid)!;
      const l = ctx.pack.cards[res.defId]!.lights;
      expect(l).toHaveLength(1);
      expect(adjacent(l[0]!, 'courage')).toBe(true);
      expect(l[0]).not.toBe('hope'); // Act 1: available Lights only
      expect(res.upgraded).toBe(true);
    }
  });

  it('The Stuck Balloon: a joke upgrades 2 Joy cards with 3+ Joy cards, else 10 Glimmers', () => {
    const few = step(atEvent('mem.stuck_balloon', 7), { t: 'option', i: 1 });
    expect(few.run.glimmers).toBe(60);
    const many = step(atEvent('mem.stuck_balloon', 7, (x) => giveCard(x, 'joy.giggle')), { t: 'option', i: 1 });
    const upgraded = many.run.deck.filter((c) => c.upgraded);
    expect(upgraded).toHaveLength(2);
    for (const c of upgraded) expect(ctx.pack.cards[c.defId]!.lights).toContain('joy');
    const climb = step(atEvent('mem.stuck_balloon', 7), { t: 'option', i: 0 });
    expect(climb.run.heart).toBe(63);
    expect(ctx.pack.keepsakes[climb.run.keepsakes.at(-1)!.id]!.rarity).toBe('common');
  });

  it('Tea, Slowly: advice removes a card, and Mends 6 only if it was a Buried card', () => {
    const s = atEvent('mem.tea_slowly', 8, (x) => {
      giveBuried(x, 'fear', 1);
      x.run.heart = 40;
    });
    const sel = step(s, { t: 'option', i: 2 });
    const b = s.run.deck.at(-1)!;
    expect(step(sel, { t: 'choose', uid: b.uid }).run.heart).toBe(46);
    expect(step(sel, { t: 'choose', uid: s.run.deck[0]!.uid }).run.heart).toBe(40);
    // A stale pick from an earlier selection never counts.
    const stale = atEvent('mem.tea_slowly', 8, (x) => {
      x.run.lastSelected = 'buried.fear';
      x.run.heart = 40;
      x.run.deck = [];
    });
    expect(step(stale, { t: 'option', i: 2 }).run.heart).toBe(40);
  });

  it('The Wishing Well: 20 Glimmers buy an upgraded Light card (Hope in Act 2); everything buys a rare, 80+ a Keepsake', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const a1 = step(atEvent('mem.wishing_well', seed), { t: 'option', i: 0 });
      const c1 = a1.run.deck.at(-1)!;
      expect(a1.run.glimmers).toBe(30);
      expect(c1.upgraded).toBe(true);
      expect(ctx.pack.cards[c1.defId]!.availableFromAct).toBe(1);
      const a2 = step(atEvent('mem.wishing_well', seed, (x) => { x.run.act = 2; x.run.map.act = 2; }), { t: 'option', i: 0 });
      expect(ctx.pack.cards[a2.run.deck.at(-1)!.defId]!.lights).toEqual(['hope']);
    }
    const rich = step(atEvent('mem.wishing_well', 9, (x) => (x.run.glimmers = 90)), { t: 'option', i: 1 });
    expect(rich.run.glimmers).toBe(0);
    expect(rich.run.lastPaid).toBe(90);
    expect(ctx.pack.cards[rich.run.deck.at(-1)!.defId]!.rarity).toBe('rare');
    expect(rich.run.keepsakes).toHaveLength(2);
    const modest = step(atEvent('mem.wishing_well', 9), { t: 'option', i: 1 });
    expect(modest.run.keepsakes).toHaveLength(1);
  });

  it('events with every option disabled can still be left', () => {
    const s = atEvent('mem.quiet_moment');
    s.run.heart = 70;
    expect(engine.legalActions(s)).toEqual([{ t: 'option', i: 0 }]);
    expect(done(step(s, { t: 'option', i: 0 })).phase).toEqual({ kind: 'map' });
  });
});
