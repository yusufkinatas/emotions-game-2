// R-4 Harmony and the Note, Isolated, Prism Shard, Tuning Fork, Mirror Shard.
import { describe, expect, it } from 'vitest';
import { scenario } from '../../helpers/scenario';

describe('R-4 Harmony and the Note', () => {
  it('Note Love, play Joy: Harmonized as Delight; the Note becomes Joy', () => {
    const t = scenario().compass().note('love').hand('joy.bright_spark').draw('courage.stand_firm').enemy('shade.grumble').build();
    const p = t.preview('joy.bright_spark', 0)!;
    expect(p.harmonized).toBe(true);
    expect(p.effectiveLights).toEqual(['joy', 'love']);
    t.play('joy.bright_spark', 0);
    expect(t.eventsOf('harmony')[0]).toEqual({ e: 'harmony', blend: 'delight', count: 1 });
    expect(t.c.note).toEqual(['joy']);
    expect(t.c.stats.harmonies).toBe(1);
  });

  it('the Note persists across turns', () => {
    const t = scenario().compass().hand('love.kind_word').draw('joy.bright_spark', 'courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm')
      .enemy('shade.grumble', { hp: 40, intent: 'huff' }).build();
    t.play('love.kind_word', 0);
    t.endTurn();
    expect(t.c.note).toEqual(['love']);
    expect(t.preview('joy.bright_spark', 0)!.harmonized).toBe(true);
  });

  it('without The Compass cards are never Harmonized, but the Note is still tracked', () => {
    const t = scenario().note('love').hand('joy.bright_spark').draw('courage.stand_firm').enemy('shade.grumble').build();
    t.play('joy.bright_spark', 0);
    expect(t.eventsOf('harmony')).toHaveLength(0);
    expect(t.c.note).toEqual(['joy']);
  });

  it('same Light as the Note is not Harmonized; a non-adjacent Light moves the Note', () => {
    const t = scenario().compass().note('love').hand('love.kind_word', 'courage.brave_strike').enemy('shade.grumble', { hp: 40 }).build();
    expect(t.preview('love.kind_word', 0)!.harmonized).toBe(false);
    t.play('courage.brave_strike', 0);
    expect(t.eventsOf('harmony')).toHaveLength(0);
    expect(t.c.note).toEqual(['courage']);
  });

  it('neutral cards and Buried cards never change the Note', () => {
    const t = scenario().compass().note('love').hand('neutral.name_it', 'buried.anger').enemy('shade.grumble', { hp: 40 }).build();
    t.play('neutral.name_it', 0);
    expect(t.c.note).toEqual(['love']);
    expect(t.legal().some((a) => a.t === 'play' && a.card === t.uid('buried.anger'))).toBe(false);
  });

  it('Isolated: no Harmony (the Note still updates); the Friendship card that clears it is not Harmonized', () => {
    const t = scenario().compass().note('joy').statuses({ isolated: 1 }).hand('friendship.reach_out', 'love.kind_word')
      .enemy('shade.grumble', { hp: 40 }).build();
    t.play('friendship.reach_out', 0);
    expect(t.eventsOf('harmony')).toHaveLength(0);
    expect(t.status('isolated')).toBe(0);
    expect(t.c.note).toEqual(['friendship']);
  });

  it('a Blend is Harmonized only by an adjacent Light outside its own pair', () => {
    const a = scenario().compass().note('love', 'joy').hand('blend.sunbeam').draw('courage.stand_firm').enemy('shade.grumble').build();
    expect(a.preview('blend.sunbeam', 0)!.harmonized).toBe(false);
    const b = scenario().compass().note('friendship').hand('blend.sunbeam').draw('courage.stand_firm').enemy('shade.grumble').build();
    const p = b.preview('blend.sunbeam', 0)!;
    expect(p.harmonized).toBe(true);
    expect(p.effectiveLights).toEqual(['love', 'joy']);
    b.play('blend.sunbeam', 0);
    expect(b.c.note).toEqual(['love', 'joy']);
  });

  it('Harmony riders trigger only when Harmonized (High Five: Companions act now)', () => {
    const t = scenario().compass().note('joy').companions('comp.lantern_moth').hand('friendship.high_five', 'friendship.high_five')
      .enemy('shade.mope', { hp: 40 }).build();
    t.play(t.uid('friendship.high_five', 0), 0);
    expect(t.eventsOf('companionAct')).toHaveLength(1);
    t.play('friendship.high_five', 0); // Note is Friendship now: not Harmonized
    expect(t.eventsOf('companionAct')).toHaveLength(0);
  });

  it('Mirror Shard: Lights directly across also Harmonize', () => {
    const t = scenario().compass().keepsakes('ks.mirror_shard').note('love').hand('courage.brave_strike').enemy('shade.grumble', { hp: 40 }).build();
    const p = t.preview('courage.brave_strike', 0)!;
    expect(p.harmonized).toBe(true);
    expect(p.effectiveLights).toEqual(['courage', 'love']);
    expect(p.targets[0]!.hpAfter).toBe(28);
  });

  it('Prism Shard: the first Harmonized card each turn costs 1 less', () => {
    const t = scenario().compass().keepsakes('ks.prism_shard').note('love').hand('joy.bright_spark', 'love.kind_word', 'joy.bright_spark')
      .draw('courage.stand_firm', 'courage.stand_firm').enemy('shade.grumble', { hp: 40 }).energy(3).build();
    t.play(t.uid('joy.bright_spark', 0), 0);
    expect(t.c.energy).toBe(3);
    t.play('love.kind_word', 0);
    expect(t.c.energy).toBe(2);
    t.play('joy.bright_spark', 0); // Harmonized again but Prism is spent this turn
    expect(t.c.energy).toBe(1);
  });

  it('Tuning Fork: the first Harmonized card each turn draws 1', () => {
    const t = scenario().compass().keepsakes('ks.tuning_fork').note('love').hand('joy.bright_spark', 'love.kind_word')
      .draw('courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm').enemy('shade.grumble', { hp: 40 }).build();
    t.play('joy.bright_spark', 0);
    expect(t.eventsOf('keepsake').map((e) => e.id)).toEqual(['ks.tuning_fork']);
    expect(t.eventsOf('draw').reduce((n, e) => n + e.uids.length, 0)).toBe(2);
    t.play('love.kind_word', 0);
    expect(t.eventsOf('keepsake')).toHaveLength(0);
  });
});
