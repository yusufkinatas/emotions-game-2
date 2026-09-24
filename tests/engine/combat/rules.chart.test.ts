// R-2 type chart, R-2a multi-Light hits, R-2b effective Lights in passives, R-3 Flare, R-11 automatic hits.
import { describe, expect, it } from 'vitest';
import { scenario } from '../../helpers/scenario';

describe('R-2 type chart in combat', () => {
  it('OPPOSITE hits x2 (Kind Word vs Grumble)', () => {
    const t = scenario().hand('love.kind_word').enemy('shade.grumble', { hp: 40 }).build();
    t.play('love.kind_word', 0);
    expect(t.enemy(0).hp).toBe(28);
    expect(t.eventsOf('hit')[0]!.b.relation).toBe('opposite');
  });

  it('DISSONANT hits x1/2 and give 1 Flare (Kind Word vs Mope)', () => {
    const t = scenario().hand('love.kind_word').enemy('shade.mope', { hp: 40 }).build();
    t.play('love.kind_word', 0);
    expect(t.enemy(0).hp).toBe(37);
    expect(t.enemy(0).statuses.flare).toBe(1);
  });

  it('Lightning Rod: DISSONANT deals x1 and still gives Flare', () => {
    const t = scenario().keepsakes('ks.lightning_rod').hand('love.kind_word').enemy('shade.mope', { hp: 40 }).build();
    t.play('love.kind_word', 0);
    expect(t.enemy(0).hp).toBe(34);
    expect(t.enemy(0).statuses.flare).toBe(1);
  });

  it('a lethal DISSONANT hit gives no Flare (the Shade leaves)', () => {
    const t = scenario().hand('love.kind_word').enemy('shade.mope', { hp: 2 }).enemy('shade.grumble').build();
    t.play('love.kind_word', 0);
    expect(t.c.gone[0]!.outcome).toBe('suppress');
    expect(t.eventsOf('status').filter((e) => e.id === 'flare')).toHaveLength(0);
  });

  it('a non-lethal OPPOSITE hit removes 1 Flare after damage', () => {
    const t = scenario().hand('love.kind_word').enemy('shade.grumble', { hp: 40, statuses: { flare: 2 } }).build();
    t.play('love.kind_word', 0);
    expect(t.enemy(0).statuses.flare).toBe(1);
  });

  it('neutral hits change no Flare', () => {
    const t = scenario().hand('courage.brave_strike').enemy('shade.grumble', { hp: 40, statuses: { flare: 2 } }).build();
    t.play('courage.brave_strike', 0);
    expect(t.enemy(0).hp).toBe(34);
    expect(t.enemy(0).statuses.flare).toBe(2);
  });

  it('R-2a: a two-Light hit uses the best relation and is never DISSONANT (Sunbeam)', () => {
    const t = scenario().hand('blend.sunbeam', 'blend.sunbeam').draw('courage.stand_firm', 'courage.stand_firm')
      .enemy('shade.mope', { hp: 40 }).enemy('shade.echo', { hp: 40 }).build();
    t.play(t.uid('blend.sunbeam', 0), 0);
    expect(t.enemy(0).hp).toBe(26);
    t.play('blend.sunbeam', 1);
    // Love neutral + Joy dissonant vs Loneliness: best relation is neutral.
    expect(t.enemy(1).hp).toBe(33);
    expect(t.enemy(1).statuses.flare ?? 0).toBe(0);
  });

  it('R-11: automatic hits are never DISSONANT and give no Flare (Lantern Moth vs Skitter)', () => {
    const t = scenario().companions('comp.lantern_moth').enemy('shade.skitter', { hp: 30, intent: 'lunge' }).build();
    t.endTurn();
    const hit = t.eventsOf('hit')[0]!;
    expect(hit.b.relation).toBe('neutral');
    expect(hit.b.damage).toBe(3);
    expect(t.enemy(0).statuses.flare ?? 0).toBe(0);
  });

  it('R-11: automatic hits ignore Nerve and Heavy', () => {
    const t = scenario().statuses({ nerve: 3, heavy: 2 }).companions('comp.lantern_moth').enemy('shade.echo', { hp: 30 }).build();
    t.endTurn();
    expect(t.eventsOf('hit')[0]!.b.damage).toBe(6); // Friendship vs Loneliness x2, no Nerve, no Heavy
  });
});

describe('R-2b effective Lights in passives', () => {
  it('a Harmonized Joy card after Love lowers Kettle Pressure', () => {
    const t = scenario().compass().note('love').hand('joy.bright_spark').draw('courage.stand_firm')
      .enemy('shade.kettle', { hp: 90, statuses: { pressure: 3 } }).build();
    t.play('joy.bright_spark', 0);
    expect(t.enemy(0).statuses.pressure).toBe(1);
  });

  it('a card without Love raises Kettle Pressure; at 6 the intent is overridden', () => {
    const t = scenario().hand('courage.brave_strike').enemy('shade.kettle', { hp: 90, statuses: { pressure: 5 } }).build();
    expect(t.enemy(0).intent!.moveId).toBe('rattle');
    t.play('courage.brave_strike', 0);
    expect(t.enemy(0).statuses.pressure).toBe(6);
    expect(t.enemy(0).intent!.moveId).toBe('boil_over');
  });

  it('a Numb-greyed card counts as no Light (Kind Word raises Pressure and hits x1)', () => {
    const t = scenario().statuses({ numb: 1 }).hand('love.kind_word').enemy('shade.kettle', { hp: 90, statuses: { pressure: 3 } }).build();
    t.play('love.kind_word', 0);
    expect(t.enemy(0).hp).toBe(84);
    expect(t.enemy(0).statuses.pressure).toBe(4);
  });

  it('a Numb-greyed finishing hit Suppresses', () => {
    const t = scenario().statuses({ numb: 1 }).hand('love.kind_word').enemy('shade.grumble', { hp: 5 }).build();
    t.play('love.kind_word', 0);
    expect(t.c.gone[0]!.outcome).toBe('suppress');
  });
});
