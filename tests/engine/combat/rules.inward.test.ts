// R-7 Inward plays: legality, full cleanse, Tend ordering, once per combat, Skeleton Key, Lead Box.
import { describe, expect, it } from 'vitest';
import { scenario } from '../../helpers/scenario';

const inwardOf = (t: ReturnType<ReturnType<typeof scenario>['build']>, uid: number) =>
  t.legal().some((a) => a.t === 'play' && a.card === uid && a.inward === true);

describe('R-7 Inward', () => {
  it('is legal only if it would clear an affliction or Tend a Buried card', () => {
    const none = scenario().hand('love.kind_word').enemy('shade.grumble').build();
    expect(inwardOf(none, none.uid('love.kind_word'))).toBe(false);
    const cleanse = scenario().statuses({ seething: 1 }).hand('love.kind_word').enemy('shade.grumble').build();
    expect(inwardOf(cleanse, cleanse.uid('love.kind_word'))).toBe(true);
    const tend = scenario().hand('love.kind_word', 'buried.anger').enemy('shade.grumble').build();
    expect(inwardOf(tend, tend.uid('love.kind_word'))).toBe(true);
    const wrongType = scenario().hand('joy.bright_spark', 'buried.anger').enemy('shade.grumble').build();
    expect(inwardOf(wrongType, wrongType.uid('joy.bright_spark'))).toBe(false);
  });

  it('clears all stacks, Tends one Buried card, skips the printed effects, and costs normal Spirit', () => {
    const t = scenario().statuses({ seething: 4, restless: 1 }).hand('love.kind_word', { id: 'buried.anger', weight: 2 })
      .enemy('shade.grumble', { hp: 40 }).build();
    const p = t.preview('love.kind_word', 'inward')!;
    expect(p.player.cleansed).toEqual({ seething: 4 });
    expect(p.player.tended).toEqual({ uid: t.uid('buried.anger'), weightAfter: 1, insight: null, removed: false });
    expect(p.line).toContain('Inward');
    t.play('love.kind_word', 'inward');
    expect(t.status('seething')).toBe(0);
    expect(t.c.cards[t.uid('buried.anger')]!.weight).toBe(1);
    expect(t.enemy(0).hp).toBe(40);
    expect(t.c.energy).toBe(1); // cost 1 + Restless
    expect(t.c.mutations).toEqual([{ k: 'tend', uid: t.uid('buried.anger') }]);
    expect(t.c.piles.discard).toContain(t.uid('love.kind_word'));
  });

  it('Tend ordering: highest Weight first, then wheel order of the Shade', () => {
    const t = scenario().compass().note('love').hand('joy.bright_spark', { id: 'buried.anger', weight: 2 }, { id: 'buried.sadness', weight: 2 })
      .enemy('shade.grumble').build();
    // Harmonized Joy+Love can Tend either; equal Weight -> Anger (wheel index 0) first.
    t.play('joy.bright_spark', 'inward');
    expect(t.c.cards[t.uid('buried.anger')]!.mem.tended).toBe(true);
    const u = scenario().compass().note('love').hand('joy.bright_spark', { id: 'buried.anger', weight: 1 }, { id: 'buried.sadness', weight: 2 })
      .enemy('shade.grumble').build();
    u.play('joy.bright_spark', 'inward');
    expect(u.c.cards[u.uid('buried.sadness')]!.weight).toBe(1);
  });

  it('each Buried card can be Tended at most once per combat', () => {
    const t = scenario().hand('love.kind_word', 'love.kind_word', { id: 'buried.anger', weight: 3 }).enemy('shade.grumble').build();
    t.play(t.uid('love.kind_word', 0), 'inward');
    expect(inwardOf(t, t.uid('love.kind_word'))).toBe(false);
  });

  it('is a card played: sets the Note, can be Harmonized, counts for passives (Knot Tension)', () => {
    const t = scenario().compass().note('joy').statuses({ seething: 1 }).hand('love.kind_word').enemy('shade.knot', { hp: 100 }).build();
    t.play('love.kind_word', 'inward');
    const played = t.eventsOf('cardPlayed')[0]!;
    expect(played.inward).toBe(true);
    expect(played.harmonized).toBe(true);
    expect(t.c.note).toEqual(['love']);
    expect(t.c.turnFlags.played).toBe(1);
    expect(t.enemy(0).statuses.tension ?? 0).toBe(0); // Love: no Tension
    const u = scenario().statuses({ trembling: 1 }).hand('courage.stand_firm').enemy('shade.knot', { hp: 100 }).build();
    u.play('courage.stand_firm', 'inward');
    expect(u.enemy(0).statuses.tension).toBe(1);
  });

  it('a Mood played Inward goes to the discard pile, not into play', () => {
    const t = scenario().statuses({ seething: 2 }).hand('love.unconditional').enemy('shade.grumble').build();
    t.play('love.unconditional', 'inward');
    expect(t.c.piles.discard).toContain(t.uid('love.unconditional'));
    expect(t.c.piles.moods).toHaveLength(0);
  });

  it('neutral cards cannot be played Inward', () => {
    const t = scenario().hand('neutral.name_it', 'buried.anger').statuses({ seething: 2 }).enemy('shade.grumble').build();
    expect(inwardOf(t, t.uid('neutral.name_it'))).toBe(false);
  });

  it('Skeleton Key: Inward plays can Tend any Buried card', () => {
    const t = scenario().keepsakes('ks.skeleton_key').hand('courage.stand_firm', { id: 'buried.anger', weight: 2 }).enemy('shade.grumble').build();
    t.play('courage.stand_firm', 'inward');
    expect(t.c.cards[t.uid('buried.anger')]!.mem.tended).toBe(true);
  });

  it('Lead Box: you cannot Tend', () => {
    const t = scenario().keepsakes('ks.lead_box').hand('love.kind_word', 'buried.anger').enemy('shade.grumble').build();
    expect(inwardOf(t, t.uid('love.kind_word'))).toBe(false);
  });

  it('Tending to Weight 0 makes the Insight, which stays in hand and is playable that same turn', () => {
    const t = scenario().hand('love.kind_word', { id: 'buried.anger', weight: 1 }).enemy('shade.grumble', { hp: 40 }).build();
    t.play('love.kind_word', 'inward');
    const card = t.c.cards[t.uid('insight.passion')]!;
    expect(card.upgraded).toBe(false);
    expect(t.c.piles.hand).toContain(card.uid);
    expect(t.c.mutations).toEqual([{ k: 'tend', uid: card.uid }, { k: 'transform', uid: card.uid, to: 'insight.passion', upgraded: false }]);
    expect(t.eventsOf('insight')).toHaveLength(1);
    expect(t.legal().some((a) => a.t === 'play' && a.card === card.uid)).toBe(true);
  });
});
