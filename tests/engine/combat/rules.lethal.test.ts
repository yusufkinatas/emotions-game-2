// R-8 lethal outcomes, R-8a summoner Fades, R-8b immediate win check (4.18 ordering), R-9 Afterglows,
// Buried Weight add / +1 / overflow.
import { describe, expect, it } from 'vitest';
import { scenario } from '../../helpers/scenario';

const five = ['courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm'];

describe('R-8 lethal outcomes', () => {
  it('RESOLVE: finishing with the opposite pays Glimmers and the showing face\'s Afterglow', () => {
    const t = scenario().hand('love.kind_word').enemy('shade.grumble', { hp: 10 }).enemy('shade.mope').build();
    const p = t.preview('love.kind_word', 0)!;
    expect(p.targets[0]).toMatchObject({ outcome: 'resolve', glimmers: 8, afterglows: ['anger'] });
    expect(p.line).toBe('Kind Word -> Grumble: 12 (OPPOSITE x2). Finishes it: RESOLVE, +8 Glimmers, Conviction: Gain 1 Nerve.');
    t.play('love.kind_word', 0);
    expect(t.c.gone[0]).toMatchObject({ outcome: 'resolve', face: 'anger' });
    expect(t.c.glimmers).toBe(8);
    expect(t.status('nerve')).toBe(1);
    expect(t.c.stats.resolved).toBe(1);
  });

  it('DEEP RESOLVE: a hit with both faces\' opposites gives both Afterglows', () => {
    const t = scenario().hand('blend.sunbeam').draw('courage.stand_firm').player({ hp: 50 }).enemy('shade.old_grudge', { hp: 5 }).enemy('shade.mope').build();
    t.play('blend.sunbeam', 0);
    expect(t.c.gone[0]!.outcome).toBe('deepResolve');
    expect(t.eventsOf('resolved')[0]).toMatchObject({ deep: true, afterglows: ['anger', 'sadness'] });
    expect(t.status('nerve')).toBe(1);
    expect(t.c.player.hp).toBe(50 + 2 + 4); // Sunbeam Mend 2 runs after the hit; Release Mend 4
    expect(t.c.stats.deepResolved).toBe(1);
  });

  it('SUPPRESS: any other finishing card hit Buries the showing face', () => {
    const t = scenario().hand('courage.brave_strike').enemy('shade.old_grudge', { hp: 5, faceIndex: 1 }).enemy('shade.mope').build();
    const p = t.preview('courage.brave_strike', 0)!;
    expect(p.targets[0]!.buried).toEqual({ shade: 'sadness', weightAfter: 1, overflow: false });
    expect(p.line).toContain('Buried Sadness joins your deck (Weight 1)');
    t.play('courage.brave_strike', 0);
    expect(t.c.mutations).toEqual([{ k: 'suppress', shade: 'sadness' }]);
    expect(t.eventsOf('suppressed')[0]!.buried).toBe('sadness');
    expect(t.c.glimmers).toBe(0);
  });

  it('SUPPRESS consequences: +1 Weight, and overflow at Weight 3', () => {
    const w1 = scenario().removed({ id: 'buried.anger', weight: 1 }).hand('courage.brave_strike').enemy('shade.grumble', { hp: 5 }).enemy('shade.mope').build();
    expect(w1.preview('courage.brave_strike', 0)!.targets[0]!.buried).toEqual({ shade: 'anger', weightAfter: 2, overflow: false });
    const w3 = scenario().removed({ id: 'buried.anger', weight: 3 }).hand('courage.brave_strike').enemy('shade.grumble', { hp: 5 }).enemy('shade.mope').build();
    const p = w3.preview('courage.brave_strike', 0)!;
    expect(p.targets[0]!.buried).toEqual({ shade: 'anger', weightAfter: null, overflow: true });
    expect(p.line).toContain('Buried Anger is full: lose 3 max Heart');
  });

  it('FADE: a Fleeting Shade finished by anything is removed with no reward', () => {
    const t = scenario().hand('courage.brave_strike').enemy('shade.skitter', { hp: 20 }).enemy('shade.doubt', { hp: 7, summonedBy: 0 }).build();
    t.play('courage.brave_strike', 1);
    expect(t.c.gone[0]!.outcome).toBe('fade');
    expect(t.c.mutations).toEqual([]);
    expect(t.c.glimmers).toBe(0);
  });

  it('WAVERING: an automatic hit that would not Resolve leaves it at 1; a card hit clears it', () => {
    const t = scenario().companions('comp.lantern_moth').hand().draw(...five).enemy('shade.grumble', { hp: 2, intent: 'huff' }).build();
    const pe = t.previewEndTurn()!;
    expect(pe.targets[0]!.outcome).toBe('wavering');
    t.endTurn();
    expect(t.enemy(0).hp).toBe(1);
    expect(t.enemy(0).statuses.wavering).toBe(1);
    expect(t.eventsOf('wavering')).toHaveLength(1);
  });

  it('an automatic OPPOSITE finishing hit Resolves', () => {
    const t = scenario().companions('comp.lantern_moth').draw(...five).enemy('shade.echo', { hp: 3 }).enemy('shade.grumble', { intent: 'huff' }).lastTarget(0).build();
    t.endTurn();
    expect(t.c.gone[0]).toMatchObject({ outcome: 'resolve' });
  });

  it('R-8a: when a summoner leaves by any outcome, its Fleeting summons Fade', () => {
    const t = scenario().hand('courage.brave_strike').enemy('shade.skitter', { hp: 5 }).enemy('shade.doubt', { summonedBy: 0 }).enemy('shade.mope').build();
    t.play('courage.brave_strike', 0);
    expect(t.c.gone.map((g) => g.outcome)).toEqual(['resolve', 'fade']);
    expect(t.c.enemies.map((e) => e.defId)).toEqual(['shade.mope']);
  });

  it('R-8b: a Fleeting-only field is a win (the Doubts fade)', () => {
    const t = scenario().hand('courage.brave_strike').enemy('shade.mope', { hp: 5 }).enemy('shade.doubt').build();
    t.play('courage.brave_strike', 0);
    expect(t.c.outcome).toBe('won');
    expect(t.c.gone.map((g) => g.outcome)).toEqual(['suppress', 'fade']);
  });
});

describe('R-8b immediate win check', () => {
  it('a Companion finishing blow wins before the Seething tick and the enemy phase', () => {
    const t = scenario().statuses({ seething: 5 }).companions('comp.lantern_moth').draw(...five).enemy('shade.echo', { hp: 3 }).lastTarget(0).build();
    t.endTurn();
    expect(t.c.outcome).toBe('won');
    expect(t.c.player.hp).toBe(70);
    expect(t.eventsOf('enemyMove')).toHaveLength(0);
  });

  it('win before Heart 0 in the same step (lethal Seething, Companion finishes the last Shade)', () => {
    const t = scenario().player({ hp: 3 }).statuses({ seething: 5 }).companions('comp.lantern_moth').draw(...five).enemy('shade.echo', { hp: 3 }).lastTarget(0).build();
    t.endTurn();
    expect(t.c.outcome).toBe('won');
    expect(t.c.player.hp).toBe(3);
  });

  it('a Promise finishing blow at turn start wins before you act', () => {
    const t = scenario().hand('hope.wish_on_a_star').draw(...five, ...five).enemy('shade.slump', { hp: 10 }).build();
    t.play('hope.wish_on_a_star', 0);
    t.endTurn(); // Slump acts (and Guards 8 from Heavy Silence); the Promise's OPPOSITE 16 finishes it at turn start
    expect(t.c.outcome).toBe('won');
    expect(t.c.turn).toBe(2);
    expect(t.eventsOf('combatEnd')).toHaveLength(1);
    expect(t.legal()).toEqual([]);
  });

  it("High Five's 'Companions act now' finishing blow ends the combat; later effects do not run", () => {
    const t = scenario().compass().note('joy').companions('comp.lantern_moth').hand('friendship.high_five').enemy('shade.echo', { hp: 16 }).lastTarget(0).build();
    t.play('friendship.high_five', 0); // (5 + 2) x2 = 14, Moth 3 x2 = 6
    expect(t.c.outcome).toBe('won');
    expect(t.c.gone[0]!.outcome).toBe('resolve');
    expect(t.c.piles.play ?? []).toEqual([]);
    expect(t.c.piles.discard).toContain(t.uid('friendship.high_five'));
  });

  it('4.18: the finishing Afterglow and Pressed Flower apply before the win; Warm Locket runs after', () => {
    const t = scenario().player({ hp: 40 }).keepsakes('ks.pressed_flower', 'ks.warm_locket').hand('joy.bright_spark').draw('courage.stand_firm')
      .enemy('shade.mope', { hp: 5 }).build();
    t.play('joy.bright_spark', 0);
    expect(t.c.outcome).toBe('won');
    expect(t.c.player.hp).toBe(40 + 4 + 3 + 8);
    const mends = t.eventsOf('mend').map((e) => e.amount);
    expect(mends).toEqual([4, 3, 8]);
    expect(t.eventsOf('draw')).toHaveLength(0); // Bright Spark's Draw 1 never ran
  });

  it('Heart 0 ends the combat immediately (lost), unless Paper Crane', () => {
    const t = scenario().player({ hp: 5 }).draw(...five).enemy('shade.grumble', { intent: 'snap' }).build();
    t.endTurn();
    expect(t.c.outcome).toBe('lost');
    expect(t.c.lossCause).toBe('heart');
    const u = scenario().player({ hp: 5 }).keepsakes('ks.paper_crane').draw(...five).enemy('shade.grumble', { intent: 'snap' }).build();
    u.endTurn();
    expect(u.c.outcome).toBe(null);
    expect(u.c.player.hp).toBe(25);
    expect(u.c.paperCraneUsed).toBe(true);
    expect(u.result).toBeDefined();
  });
});

describe('R-9 Afterglows', () => {
  it('Belonging and Clarity boost your next turn', () => {
    const t = scenario().hand('friendship.reach_out', 'calm.lullaby').energy(2).draw(...five, ...five)
      .enemy('shade.echo', { hp: 5 }).enemy('shade.fret', { hp: 5 }).enemy('shade.grumble', { intent: 'huff' }).build();
    t.play('friendship.reach_out', 0);
    t.play('calm.lullaby', 0);
    expect(t.status('next_draw')).toBe(2);
    expect(t.status('next_spirit')).toBe(1);
    t.endTurn();
    expect(t.c.piles.hand).toHaveLength(7);
    expect(t.c.energy).toBe(4);
    expect(t.status('next_draw')).toBe(0);
  });

  it('Caution gives 6 Guard ignoring Trembling', () => {
    const t = scenario().statuses({ trembling: 3 }).hand('courage.brave_strike').enemy('shade.skitter', { hp: 5 }).enemy('shade.grumble').build();
    t.play('courage.brave_strike', 0);
    expect(t.c.player.guard).toBe(6);
  });

  it('Push It Down gains 2 Spirit only when it Suppresses', () => {
    const t = scenario().hand('neutral.push_it_down', 'neutral.push_it_down').energy(3).enemy('shade.grumble', { hp: 5 }).enemy('shade.mope', { hp: 40 }).build();
    t.play(t.uid('neutral.push_it_down', 0), 0);
    expect(t.c.energy).toBe(4);
    t.play('neutral.push_it_down', 0);
    expect(t.c.energy).toBe(3);
  });
});
