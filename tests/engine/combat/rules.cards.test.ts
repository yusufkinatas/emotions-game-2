// R-15 keywords and card semantics (DESIGN 6): Linger, Let Go, Innate, Reaches Shy, hand limit, Spark, costMod,
// Moods (turnStart, turnEnd, heartLostFromMove + oncePerEnemyPhase), Center, and card-specific conditions.
import { describe, expect, it } from 'vitest';
import { scenario, startScenario } from '../../helpers/scenario';

const five = ['courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm'];

describe('R-15 keywords', () => {
  it('Linger: stays in hand at the end of turn and counts turns lingered (Count to Ten gets cheaper)', () => {
    const t = scenario().hand('calm.count_to_ten').draw(...five).enemy('shade.grumble', { intent: 'huff' }).build();
    expect(t.hints()[0]!.cost).toBe(2);
    t.endTurn();
    expect(t.handIds()).toContain('calm.count_to_ten');
    expect(t.c.cards[t.uid('calm.count_to_ten')]!.mem.lingered).toBe(1);
    expect(t.hints().find((h) => h.uid === t.uid('calm.count_to_ten'))!.cost).toBe(1);
  });

  it('Wait It Out Eases 4 more per turn lingered', () => {
    const t = scenario().hand({ id: 'blend.wait_it_out', lingered: 2 }).enemy('shade.grumble', { hp: 40 }).build();
    t.play('blend.wait_it_out', 0);
    expect(t.eventsOf('hit')[0]!.b.base).toBe(15);
  });

  it('Let Go: removed for the rest of this combat', () => {
    const t = scenario().hand('neutral.pause').draw('courage.stand_firm', 'courage.stand_firm').enemy('shade.grumble').build();
    t.play('neutral.pause');
    expect(t.c.piles.letGo).toEqual([t.uid('neutral.pause')]);
    expect(t.eventsOf('letGo')).toHaveLength(1);
  });

  it('Innate: starts in your opening hand', () => {
    const t = startScenario({ deck: [...five, ...five, 'insight.instinct'], encounter: 'enc.grumble', seed: 42 });
    expect(t.handIds()).toContain('insight.instinct');
  });

  it('Shy: cards cannot target it while another Shade stands unless they Reach Shy; ALL hits still reach it', () => {
    const t = scenario().hand('courage.brave_strike', 'blend.shoulder_to_shoulder', 'joy.confetti').enemy('shade.wallflower').enemy('shade.grumble').build();
    const wall = t.enemy(0).uid;
    const targets = (card: string) => t.legal().filter((a) => a.t === 'play' && a.card === t.uid(card) && a.target === wall);
    expect(targets('courage.brave_strike')).toHaveLength(0);
    expect(targets('blend.shoulder_to_shoulder')).toHaveLength(1);
    t.play('joy.confetti');
    expect(t.eventsOf('hit').filter((h) => h.to.side === 'enemy' && h.to.uid === wall)).toHaveLength(2);
  });

  it('Shy lifts when it is the only Shade (and Cornered gives Flare +3 once)', () => {
    const t = scenario().hand('love.kind_word', 'courage.brave_strike').enemy('shade.wallflower').enemy('shade.grumble', { hp: 5 }).build();
    t.play('love.kind_word', 1);
    expect(t.enemy(0).statuses.flare).toBe(3);
    expect(t.legal().some((a) => a.t === 'play' && a.target === t.enemy(0).uid)).toBe(true);
  });

  it('hand limit 10: cards drawn with 10 in hand go to the discard pile', () => {
    const hand = Array.from({ length: 9 }, () => 'courage.stand_firm');
    const t = scenario().hand('neutral.pause', ...hand).draw('love.kind_word', 'love.kind_word').enemy('shade.grumble').build();
    t.play('neutral.pause');
    expect(t.c.piles.hand).toHaveLength(10);
    expect(t.eventsOf('burn')[0]!.uids).toHaveLength(1);
    expect(t.c.piles.discard).toHaveLength(1);
  });

  it('drawing from an empty draw pile shuffles the discard pile in', () => {
    const t = scenario().hand('neutral.pause').discard('love.kind_word', 'joy.bright_spark').enemy('shade.grumble').build();
    const r = t.play('neutral.pause');
    expect(t.eventsOf('shuffle')).toHaveLength(1);
    expect(t.c.piles.hand).toHaveLength(2);
    expect(r.revealedHiddenInfo).toBe(true);
  });

  it('Spark: +N for each card played earlier this turn', () => {
    const t = scenario().hand('courage.stand_firm', 'courage.stand_firm', 'joy.giggle').enemy('shade.grumble', { hp: 40 }).build();
    t.play(t.uid('courage.stand_firm', 0));
    t.play('courage.stand_firm');
    t.play('joy.giggle', 0);
    expect(t.eventsOf('hit')[0]!.b.base).toBe(5);
  });

  it('Grand Finale hits ALL once per card played earlier (at least once)', () => {
    const t = scenario().hand('joy.grand_finale').energy(3).enemy('shade.grumble', { hp: 40 }).enemy('shade.echo', { hp: 40 }).build();
    t.play('joy.grand_finale');
    expect(t.eventsOf('hit')).toHaveLength(2);
    const u = scenario().hand('neutral.pause', 'joy.giggle', 'joy.grand_finale').draw('courage.stand_firm', 'courage.stand_firm').energy(3)
      .enemy('shade.grumble', { hp: 40 }).enemy('shade.echo', { hp: 40 }).build();
    u.play('neutral.pause');
    u.play('joy.giggle', 0);
    u.play('joy.grand_finale');
    expect(u.eventsOf('hit')).toHaveLength(4);
  });

  it('Growing Light Eases 3 more each time you play it this combat', () => {
    const t = scenario().hand({ id: 'hope.growing_light', timesPlayed: 2 }).enemy('shade.grumble', { hp: 40 }).build();
    t.play('hope.growing_light', 0);
    expect(t.eventsOf('hit')[0]!.b.base).toBe(12);
    expect(t.c.cards[t.uid('hope.growing_light')]!.mem.timesPlayed).toBe(3);
  });

  it('Center: the next card you play this turn costs 0', () => {
    const t = scenario().hand('calm.center', 'hope.daybreak').draw('courage.stand_firm').energy(3).enemy('shade.grumble', { hp: 40 }).build();
    t.play('calm.center');
    expect(t.c.energy).toBe(2);
    expect(t.hints().find((h) => h.uid === t.uid('hope.daybreak'))!.cost).toBe(0);
    t.play('hope.daybreak');
    expect(t.c.energy).toBe(2);
    expect(t.c.turnFlags.centerActive).toBe(false);
  });

  it('Forgive counts Flare before the hit, then removes all of it', () => {
    const t = scenario().hand('love.forgive').enemy('shade.grumble', { hp: 60, statuses: { flare: 3 } }).build();
    t.play('love.forgive', 0);
    expect(t.eventsOf('hit')[0]!.b.base).toBe(20);
    expect(t.enemy(0).statuses.flare ?? 0).toBe(0);
  });

  it('Face the Storm reads the target\'s current intent; Harmony always Eases 10', () => {
    const attack = scenario().hand('courage.face_the_storm').enemy('shade.grumble', { hp: 40, intent: 'snap' }).build();
    attack.play('courage.face_the_storm', 0);
    expect(attack.eventsOf('hit')[0]!.b.base).toBe(10);
    const guard = scenario().hand('courage.face_the_storm').enemy('shade.grumble', { hp: 40, intent: 'huff' }).build();
    guard.play('courage.face_the_storm', 0);
    expect(guard.eventsOf('hit')[0]!.b.base).toBe(7);
  });

  it('Unguarded Eases 11 with no Guard, else 5', () => {
    const a = scenario().hand('love.unguarded').enemy('shade.mope', { hp: 40 }).build();
    a.play('love.unguarded', 0);
    expect(a.eventsOf('hit')[0]!.b.base).toBe(11);
    const b = scenario().player({ guard: 1 }).hand('love.unguarded').enemy('shade.mope', { hp: 40 }).build();
    b.play('love.unguarded', 0);
    expect(b.eventsOf('hit')[0]!.b.base).toBe(5);
  });

  it('Instinct gains Guard equal to all incoming strikes (after Flare and Hush), max 30', () => {
    const t = scenario().hand('insight.instinct').enemy('shade.grumble', { intent: 'snap', statuses: { flare: 2 } }).enemy('shade.mope', { intent: 'drizzle', statuses: { hush: 1 } }).build();
    t.play('insight.instinct');
    expect(t.c.player.guard).toBe(9 + 3); // snap 7+2, drizzle (2-1) x3
  });

  it('Solitude Eases 20 with no Companions', () => {
    const t = scenario().hand('insight.solitude').enemy('shade.grumble', { hp: 60 }).build();
    t.play('insight.solitude', 0);
    expect(t.eventsOf('hit')[0]!.b.base).toBe(20);
    expect(t.c.companions).toHaveLength(1);
  });
});

describe('Moods', () => {
  it('an outward Mood runs its effects and stays in play for the combat', () => {
    const t = scenario().hand('courage.find_your_nerve').enemy('shade.grumble').build();
    t.play('courage.find_your_nerve');
    expect(t.status('nerve')).toBe(2);
    expect(t.c.piles.moods).toEqual([t.uid('courage.find_your_nerve')]);
    expect(t.eventsOf('moodActive')).toHaveLength(1);
  });

  it('turnStart Moods: Lionheart (if any Shade intends to attack) and Better Days (Guard = turn, max 8)', () => {
    const t = scenario().moods('courage.lionheart', 'hope.better_days').turn(9).draw(...five).enemy('shade.grumble', { intent: 'huff' }).build();
    t.endTurn(); // next intent is snap -> attack
    expect(t.status('nerve')).toBe(1);
    expect(t.c.player.guard).toBe(8);
  });

  it('turnEnd Moods: Unhurried gains 4 Guard per unspent Spirit (before the enemy phase)', () => {
    const t = scenario().moods('calm.unhurried').energy(2).draw(...five).enemy('shade.grumble', { intent: 'snap' }).build();
    t.endTurn();
    expect(t.c.player.hp).toBe(70 - 0); // 8 Guard blocked Snap 7
    expect(t.eventsOf('strike')[0]).toMatchObject({ amount: 7, blocked: 7 });
  });

  it('Serenity: every non-Buried card in hand Lingers', () => {
    const t = scenario().moods('calm.serenity').hand('love.kind_word', 'joy.bright_spark').draw(...five).enemy('shade.grumble', { intent: 'huff' }).build();
    t.endTurn();
    expect(t.c.piles.hand).toHaveLength(7);
    expect(t.c.cards[t.uid('love.kind_word')]!.mem.lingerThisTurn).toBe(false);
  });

  it('Unconditional: the first time each enemy phase a move makes you lose Heart, gain 2 Warmth', () => {
    const t = scenario().moods('love.unconditional').draw(...five, ...five)
      .enemy('shade.mope', { intent: 'drizzle' }).enemy('shade.grumble', { intent: 'snap' }).build();
    t.endTurn();
    expect(t.status('warmth')).toBe(2);
    expect(t.c.moodFiredThisPhase).toEqual([t.uid('love.unconditional')]);
    t.endTurn(); // next phase: fires again (Warmth ticked to 1 first, then +2)
    expect(t.status('warmth')).toBe(3);
  });
});
