// R-6 afflictions (one shape), R-6a automatic cleanse, Warmth, Yellow Umbrella, Perspective.
import { describe, expect, it } from 'vitest';
import { scenario } from '../../helpers/scenario';

const five = ['courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm'];

describe('R-6 afflictions', () => {
  it('Seething: lose Heart = stacks at the end of your turn (ignores Guard), then it drops by 1', () => {
    const t = scenario().statuses({ seething: 3 }).player({ guard: 10 }).draw(...five).enemy('shade.grumble', { intent: 'huff' }).build();
    t.endTurn();
    expect(t.c.player.hp).toBe(67);
    expect(t.status('seething')).toBe(2);
    expect(t.eventsOf('hpLoss')[0]).toMatchObject({ amount: 3, cause: 'seething' });
  });

  it('Heavy: hits from your cards x3/4; Promise hits are unaffected', () => {
    const t = scenario().statuses({ heavy: 2 }).hand('courage.brave_strike', 'blend.against_the_odds').energy(5).draw(...five)
      .enemy('shade.grumble', { hp: 60, intent: 'huff' }).build();
    t.play('courage.brave_strike', 0);
    expect(t.enemy(0).hp).toBe(60 - 4);
    t.play('blend.against_the_odds', 0);
    expect(t.enemy(0).hp).toBe(56 - 7);
    t.endTurn();
    const promiseHit = t.eventsOf('hit').find((h) => !h.b.fromCard)!;
    expect(promiseHit.b.damage).toBe(10);
  });

  it('Trembling: Guard from cards x3/4 (after the Courage card soothed 1 stack)', () => {
    const t = scenario().statuses({ trembling: 2 }).hand('courage.stand_firm').enemy('shade.grumble').build();
    t.play('courage.stand_firm');
    expect(t.c.player.guard).toBe(3);
  });

  it('Keepsake Guard ignores Trembling (Warm Socks on turn 1)', () => {
    const t = scenario().statuses({ trembling: 3 }).keepsakes('ks.warm_socks').draw(...five, ...five).enemy('shade.grumble', { intent: 'huff' }).turn(0).build();
    t.endTurn(); // turn 0 -> turn 1 start: Warm Socks fires
    expect(t.c.turn).toBe(1);
    expect(t.c.player.guard).toBe(6);
  });

  it('Hollow: gain 1 less Spirit at the start of your turn', () => {
    const t = scenario().statuses({ hollow: 2 }).draw(...five).enemy('shade.grumble', { intent: 'huff' }).build();
    t.endTurn();
    expect(t.c.energy).toBe(2);
    expect(t.status('hollow')).toBe(1);
  });

  it('Restless: only the first card each turn costs 1 more', () => {
    const t = scenario().statuses({ restless: 1 }).hand('courage.brave_strike', 'courage.brave_strike').enemy('shade.grumble', { hp: 40 }).build();
    t.play(t.uid('courage.brave_strike', 0), 0);
    expect(t.c.energy).toBe(1);
    t.play('courage.brave_strike', 0);
    expect(t.c.energy).toBe(0);
  });

  it('Numb greys only the first card each turn', () => {
    const t = scenario().compass().note('joy').statuses({ numb: 1 }).hand('love.kind_word', 'love.kind_word').enemy('shade.grumble', { hp: 40 }).build();
    const hints = t.hints();
    expect(hints.every((h) => h.numbed)).toBe(true);
    t.play(t.uid('love.kind_word', 0), 0);
    expect(t.eventsOf('cardPlayed')[0]!.effectiveLights).toEqual([]);
    expect(t.enemy(0).hp).toBe(34);
    expect(t.c.note).toEqual(['joy']);
    expect(t.hints()[0]!.numbed).toBe(false);
    t.play('love.kind_word', 0);
    expect(t.enemy(0).hp).toBe(22);
  });

  it('a Numb-greyed card cannot be played Inward', () => {
    const t = scenario().statuses({ numb: 1, seething: 2 }).hand('love.kind_word').enemy('shade.grumble').build();
    expect(t.legal().some((a) => a.t === 'play' && a.inward)).toBe(false);
  });

  it('R-6a: outward plays remove 1 stack per effective Light; Harmonized Love+Joy removes Seething and Heavy', () => {
    const t = scenario().compass().note('love').statuses({ seething: 3, heavy: 2 }).hand('joy.bright_spark').draw(...five)
      .enemy('shade.grumble', { hp: 40 }).build();
    t.play('joy.bright_spark', 0);
    expect(t.status('seething')).toBe(2);
    expect(t.status('heavy')).toBe(1);
    expect(t.eventsOf('cleanse').map((e) => [e.id, e.removed, e.byLight, e.inward])).toEqual([
      ['heavy', 1, 'joy', false],
      ['seething', 1, 'love', false],
    ]);
  });

  it('Warmth: Mend = stacks at the end of your turn, then -1; max 6', () => {
    const t = scenario().player({ hp: 50 }).hand('love.warm_embrace', 'love.warm_embrace', 'love.warm_embrace', 'love.warm_embrace')
      .energy(4).draw(...five).enemy('shade.grumble', { intent: 'huff' }).build();
    for (let i = 0; i < 4; i++) t.play('love.warm_embrace');
    expect(t.status('warmth')).toBe(6);
    t.endTurn();
    expect(t.c.player.hp).toBe(56);
    expect(t.status('warmth')).toBe(5);
  });

  it('decay: each affliction loses 1 stack at the end of your turn, including Numb', () => {
    const t = scenario().statuses({ heavy: 1, trembling: 2, numb: 1, nerve: 2 }).draw(...five).enemy('shade.grumble', { intent: 'huff' }).build();
    t.endTurn();
    expect(t.c.player.statuses).toEqual({ trembling: 1, nerve: 2 });
  });

  it('Yellow Umbrella blocks the first affliction stacks from any source, including Numb', () => {
    const t = scenario().keepsakes('ks.yellow_umbrella').draw(...five, ...five).enemy('shade.numbness', { hp: 180, intent: 'fog' }).build();
    t.endTurn();
    expect(t.status('numb')).toBe(0);
    expect(t.log.some((e) => e.e === 'afflictBlocked')).toBe(true);
    expect(t.c.umbrellaUsed).toBe(true);
  });

  it('Perspective removes every affliction except Numb, then draws 1', () => {
    const t = scenario().statuses({ numb: 1, heavy: 2, seething: 1 }).hand('hope.wish_on_a_star').turnFlags({ firstCardDone: true })
      .draw('courage.stand_firm', 'courage.stand_firm').enemy('shade.slump', { hp: 3 }).enemy('shade.grumble').build();
    t.play('hope.wish_on_a_star', 0);
    expect(t.c.gone[0]!.outcome).toBe('resolve');
    expect(t.c.player.statuses).toEqual({ numb: 1 });
    expect(t.handIds()).toEqual(['courage.stand_firm']);
  });
});
