// R-10 Buried cards in combat: in-hand stacks after decay, never Linger, Tend once, Insight (upgrade, once
// per run / B3), Journal, Worn Diary, Lead Box, Look Inward and Sit With It choices.
import { describe, expect, it } from 'vitest';
import { scenario, startScenario } from '../../helpers/scenario';

const five = ['courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm'];

describe('R-10 Buried cards', () => {
  it('in hand at end of turn: gain Weight stacks after decay, so they last through your next turn', () => {
    const t = scenario().statuses({ seething: 1 }).hand({ id: 'buried.anger', weight: 2 }).draw(...five).enemy('shade.grumble', { intent: 'huff' }).build();
    t.endTurn();
    expect(t.c.player.hp).toBe(69); // tick of 1 happened before the new stacks
    expect(t.status('seething')).toBe(2);
    expect(t.c.piles.discard).toContain(t.uid('buried.anger'));
  });

  it('Lead Box: Buried cards in hand never afflict you', () => {
    const t = scenario().keepsakes('ks.lead_box').hand({ id: 'buried.anger', weight: 3 }).draw(...five).enemy('shade.grumble', { intent: 'huff' }).build();
    t.endTurn();
    expect(t.status('seething')).toBe(0);
  });

  it('Buried cards never Linger, even with Serenity', () => {
    const t = scenario().moods('calm.serenity').hand('buried.anger', 'love.kind_word').draw(...five).enemy('shade.grumble', { intent: 'huff' }).build();
    t.endTurn();
    expect(t.handIds()).toContain('love.kind_word');
    expect(t.c.piles.discard).toContain(t.uid('buried.anger'));
    expect(t.c.cards[t.uid('love.kind_word')]!.mem.lingered).toBe(1);
  });

  it('Insight is upgraded if peakWeight was 2+', () => {
    const t = scenario().hand('love.kind_word', { id: 'buried.anger', weight: 1, peakWeight: 2 }).enemy('shade.grumble').build();
    t.play('love.kind_word', 'inward');
    expect(t.eventsOf('insight')[0]).toMatchObject({ to: 'insight.passion', upgraded: true });
  });

  it('Worn Diary: Insights are always upgraded', () => {
    const t = scenario().keepsakes('ks.worn_diary').hand('love.kind_word', { id: 'buried.anger', weight: 1 }).enemy('shade.grumble').build();
    t.play('love.kind_word', 'inward');
    expect(t.eventsOf('insight')[0]!.upgraded).toBe(true);
  });

  it('B3: Tending to 0 when that Insight was already made this run releases the Buried card', () => {
    const t = scenario().insightsMade('insight.passion').hand('love.kind_word', { id: 'buried.anger', weight: 1 }).enemy('shade.grumble').build();
    const p = t.preview('love.kind_word', 'inward')!;
    expect(p.player.tended).toMatchObject({ removed: true, insight: null });
    t.play('love.kind_word', 'inward');
    const uid = t.uid('buried.anger');
    expect(t.eventsOf('peace')).toEqual([{ e: 'peace', uid }]);
    expect(t.c.mutations).toEqual([{ k: 'tend', uid }, { k: 'remove', uid }]);
    expect(t.c.piles.removed).toContain(uid);
  });

  it('B3 inside one combat: the second Buried card of an Insight made this combat is released', () => {
    const t = scenario().keepsakes('ks.skeleton_key').hand('love.kind_word', 'love.kind_word', { id: 'buried.anger', weight: 1 }, { id: 'buried.anger', weight: 1 })
      .enemy('shade.grumble').build();
    t.play(t.uid('love.kind_word', 0), 'inward');
    t.play('love.kind_word', 'inward');
    expect(t.c.mutations.map((m) => m.k)).toEqual(['tend', 'transform', 'tend', 'remove']);
  });

  it('Journal: whenever you Tend in combat, draw 1 and gain 3 Guard', () => {
    const t = scenario().keepsakes('ks.journal').statuses({ trembling: 2 }).hand('love.kind_word', { id: 'buried.anger', weight: 2 }).draw('courage.stand_firm')
      .enemy('shade.grumble').build();
    t.play('love.kind_word', 'inward');
    expect(t.c.player.guard).toBe(3);
    expect(t.handIds()).toContain('courage.stand_firm');
  });

  it('Worn Diary: your heaviest Buried card starts in your opening hand', () => {
    const t = startScenario({
      keepsakes: ['ks.worn_diary'],
      deck: [...five, ...five, { id: 'buried.anger', weight: 1 }, { id: 'buried.fear', weight: 3 }],
      encounter: 'enc.grumble',
      seed: 9,
    });
    expect(t.handIds()).toContain('buried.fear');
  });

  it('Look Inward: one Buried card is fetched directly; with 2+ it opens a choice, then the rest of the card runs', () => {
    const one = scenario().hand('neutral.look_inward').draw('courage.stand_firm', 'buried.anger').enemy('shade.grumble').build();
    one.play('neutral.look_inward');
    expect(one.handIds()).toEqual(['buried.anger', 'courage.stand_firm']);

    const t = scenario().hand('neutral.look_inward').draw('courage.stand_firm', 'buried.anger').discard('buried.fear').enemy('shade.kettle').build();
    const p = t.preview('neutral.look_inward')!;
    expect(p.partial).toBe(true);
    t.play('neutral.look_inward');
    expect(t.c.pending).toMatchObject({ purpose: 'toHand', options: [t.uid('buried.anger'), t.uid('buried.fear')] });
    expect(t.legal()).toEqual([
      { t: 'choose', uid: t.uid('buried.anger') },
      { t: 'choose', uid: t.uid('buried.fear') },
    ]);
    expect(() => t.endTurn()).toThrow();
    t.choose(t.uid('buried.fear'));
    expect(t.c.pending).toBe(null);
    expect(t.handIds()).toEqual(['buried.fear', 'courage.stand_firm']);
    // cleanup ran after the continuation: the card is discarded and Kettle's Pressure did not move (no hit)
    expect(t.c.piles.discard).toContain(t.uid('neutral.look_inward'));
    expect(t.c.turnFlags.played).toBe(1);
  });

  it('Sit With It: Tend any type in hand (choice with 2+), not with Lead Box', () => {
    const t = scenario().hand('neutral.sit_with_it', { id: 'buried.anger', weight: 2 }, { id: 'buried.fear', weight: 3 }).enemy('shade.grumble').build();
    t.play('neutral.sit_with_it');
    expect(t.c.pending!.purpose).toBe('tend');
    t.choose(t.uid('buried.fear'));
    expect(t.c.cards[t.uid('buried.fear')]!.weight).toBe(2);
    expect(t.c.piles.letGo).toContain(t.uid('neutral.sit_with_it'));
    const lead = scenario().keepsakes('ks.lead_box').hand('neutral.sit_with_it', { id: 'buried.anger', weight: 2 }).enemy('shade.grumble').build();
    lead.play('neutral.sit_with_it');
    expect(lead.c.pending).toBe(null);
    expect(lead.c.cards[lead.uid('buried.anger')]!.weight).toBe(2);
  });
});
