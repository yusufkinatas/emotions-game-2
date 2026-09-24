// R-13 Companions and R-14 Promises.
import { describe, expect, it } from 'vitest';
import { scenario } from '../../helpers/scenario';

const five = ['courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm'];

describe('R-13 Companions', () => {
  it('max 3: summoning a 4th makes your oldest Companion leave; Welcome Mat gives 3 Guard per summon', () => {
    const t = scenario().keepsakes('ks.welcome_mat').companions('comp.lantern_moth', 'comp.burrow_hare', 'comp.old_dog').hand('friendship.call_a_friend')
      .enemy('shade.grumble').build();
    const oldest = t.c.companions[0]!.uid;
    t.play('friendship.call_a_friend');
    expect(t.c.companions.map((x) => x.defId)).toEqual(['comp.burrow_hare', 'comp.old_dog', 'comp.lantern_moth']);
    expect(t.eventsOf('companionLeft')).toEqual([{ e: 'companionLeft', companion: oldest }]);
    expect(t.c.player.guard).toBe(3);
  });

  it('they act at the end of your turn in summon order and hit your last target', () => {
    const t = scenario().companions('comp.old_dog', 'comp.burrow_hare').hand('courage.brave_strike').draw(...five)
      .enemy('shade.grumble', { hp: 40, intent: 'huff' }).enemy('shade.echo', { hp: 40 }).build();
    t.play('courage.brave_strike', 1);
    t.endTurn();
    const acts = t.eventsOf('companionAct').map((e) => e.companion);
    expect(acts).toEqual(t.c.companions.map((x) => x.uid));
    const hit = t.eventsOf('hit')[0]!;
    expect(hit.to).toEqual({ side: 'enemy', uid: t.enemy(1).uid });
    expect(hit.from.side).toBe('companion');
  });

  it('with no last target (or it is gone) they hit the leftmost Shade', () => {
    const t = scenario().companions('comp.lantern_moth').draw(...five).enemy('shade.grumble', { hp: 40, intent: 'huff' }).enemy('shade.echo').build();
    t.endTurn();
    expect(t.eventsOf('hit')[0]!.to).toEqual({ side: 'enemy', uid: t.enemy(0).uid });
  });

  it('Companions can hit Shy Shades; Burrow Hare Guard ignores Trembling', () => {
    const t = scenario().statuses({ trembling: 2 }).companions('comp.lantern_moth', 'comp.burrow_hare').draw(...five)
      .enemy('shade.wallflower', { hp: 40, intent: 'peek' }).enemy('shade.grumble', { intent: 'huff' }).build();
    t.endTurn();
    expect(t.eventsOf('hit')[0]!.to).toEqual({ side: 'enemy', uid: t.enemy(0).uid });
    expect(t.eventsOf('guard').find((g) => g.to.side === 'player' && g.amount > 0)!.amount).toBe(3);
  });

  it('Isolated: your Companions do not act (end of turn or "act now")', () => {
    const t = scenario().statuses({ isolated: 2 }).companions('comp.lantern_moth').draw(...five).enemy('shade.grumble', { hp: 40, intent: 'huff' }).build();
    t.endTurn();
    expect(t.eventsOf('companionAct')).toHaveLength(0);
  });

  it('Scatter N: your N oldest Companions leave (Echo drift)', () => {
    const t = scenario().companions('comp.lantern_moth', 'comp.old_dog').draw(...five).enemy('shade.echo', { hp: 40, intent: 'drift' }).enemy('shade.grumble').build();
    t.endTurn();
    expect(t.c.companions.map((x) => x.defId)).toEqual(['comp.old_dog']);
  });
});

describe('R-14 Promises', () => {
  it('resolve at the start of your next turn after drawing, in creation order', () => {
    const t = scenario().hand('hope.silver_lining', 'hope.plant_a_seed').draw(...five, 'love.kind_word').enemy('shade.grumble', { intent: 'huff' }).build();
    t.play('hope.silver_lining');
    t.play('hope.plant_a_seed');
    expect(t.c.promises).toHaveLength(2);
    expect(t.c.piles.letGo).toContain(t.uid('hope.plant_a_seed'));
    t.endTurn();
    const kinds = t.events.map((e) => e.e);
    expect(kinds.indexOf('draw')).toBeLessThan(kinds.indexOf('promise'));
    expect(t.c.player.guard).toBe(5);
    expect(t.c.energy).toBe(4);
    expect(t.c.piles.hand).toHaveLength(7);
    expect(t.c.promises).toHaveLength(0);
  });

  it('carry the effective Lights of the card at play time (Harmonized Wish on a Star keeps Hope+Courage)', () => {
    const t = scenario().compass().note('courage').hand('hope.wish_on_a_star').draw(...five).enemy('shade.slump', { hp: 60, intent: 'sink' }).build();
    t.play('hope.wish_on_a_star', 0);
    expect(t.c.promises[0]!.lights).toEqual(['hope', 'courage']);
    t.endTurn();
    const hit = t.eventsOf('hit').find((h) => !h.b.fromCard)!;
    expect(hit.b.lights).toEqual(['hope', 'courage']);
    expect(hit.b.base).toBe(12); // Harmony: the Promise Eases 12 instead
    expect(hit.b.damage).toBe(24);
  });

  it('target the same Shade; if it is gone, the leftmost Shade that is not Veiled', () => {
    const t = scenario().hand('hope.wish_on_a_star', 'courage.brave_strike').draw(...five)
      .enemy('shade.grumble', { hp: 40, intent: 'huff' }).enemy('shade.mope', { hp: 10, intent: 'curl_up' }).build();
    t.play('hope.wish_on_a_star', 1);
    t.play('courage.brave_strike', 1);
    expect(t.c.enemies).toHaveLength(1);
    t.endTurn();
    expect(t.eventsOf('hit')[0]!.to).toEqual({ side: 'enemy', uid: t.enemy(0).uid });
  });

  it('Daybreak costs 1 less for each Promise made this combat', () => {
    const t = scenario().hand('hope.daybreak', 'hope.plant_a_seed', 'hope.plant_a_seed').energy(3).enemy('shade.grumble').build();
    expect(t.hints().find((h) => h.uid === t.uid('hope.daybreak'))!.cost).toBe(3);
    t.play(t.uid('hope.plant_a_seed', 0));
    t.play('hope.plant_a_seed');
    expect(t.hints().find((h) => h.uid === t.uid('hope.daybreak'))!.cost).toBe(1);
  });

  it('vanish if the combat ends', () => {
    const t = scenario().hand('hope.wish_on_a_star', 'love.kind_word').enemy('shade.grumble', { hp: 13 }).build();
    t.play('hope.wish_on_a_star', 0);
    t.play('love.kind_word', 0);
    expect(t.c.outcome).toBe('won');
    expect(t.c.promises).toEqual([]);
  });
});
