// 16.2 UI data: IntentView text and numbers, HandHints, card text slots, Preview lines and banners.
import { describe, expect, it } from 'vitest';
import { describeCard } from '../../../src/engine/combat/index';
import { testPack } from '../../fixtures/testPack';
import { ctxFor } from '../../helpers/run';
import { scenario } from '../../helpers/scenario';

const five = ['courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm'];
const ctx = ctxFor(testPack);

describe('IntentView', () => {
  it('numbers include Flare and Hush; text explains them', () => {
    const t = scenario().draw(...five).enemy('shade.grumble', { intent: 'snap', statuses: { flare: 1 } }).enemy('shade.mope', { intent: 'drizzle', statuses: { hush: 1 } }).build();
    const [a, b] = t.intents();
    expect(a).toMatchObject({ moveId: 'snap', name: 'Snap', kinds: ['strike'], strikes: { perStrike: 8, count: 1 }, guard: null, afflict: null });
    expect(a!.text).toBe('Strikes for 8 (7 + 1 Flare).');
    expect(b!.strikes).toEqual({ perStrike: 1, count: 3 });
    expect(b!.text).toBe('Strikes 3 times for 1 each (2 - 1 Hush).');
  });

  it('guard and afflict parts; overriddenBy names the gauge', () => {
    const t = scenario().draw(...five).enemy('shade.kettle', { statuses: { pressure: 6 }, intent: 'boil_over' }).enemy('shade.mope', { intent: 'curl_up' }).build();
    const [k, m] = t.intents();
    expect(k).toMatchObject({ overriddenBy: 'pressure', afflict: { id: 'seething', stacks: 3 } });
    expect(k!.text).toContain('Pressure is full');
    expect(m).toMatchObject({ guard: 10, text: 'Gains 10 Guard.' });
  });

  it('an override that fires as its gauge runs out says so (Dread at Countdown 0)', () => {
    const t = scenario().draw(...five).enemy('shade.dread', { statuses: { countdown: 0 }, intent: 'the_thing' }).build();
    const [d] = t.intents();
    expect(d).toMatchObject({ moveId: 'the_thing', overriddenBy: 'countdown' });
    expect(d!.text).toContain('(Countdown has run out.)');
    expect(d!.text).not.toContain('is full');
  });
});

describe('HandHints', () => {
  it('relations per targetable Shade, Harmony chip, soothes, tends, inward legality', () => {
    const t = scenario().compass().note('love').statuses({ heavy: 1 }).hand('joy.bright_spark', { id: 'buried.sadness', weight: 2 }, 'neutral.name_it')
      .enemy('shade.mope').enemy('shade.echo').build();
    const [spark, buried, name] = t.hints();
    expect(spark).toMatchObject({
      playable: true,
      cost: 1,
      inwardLegal: true,
      harmonizesNow: true,
      blend: 'delight',
      tends: t.uid('buried.sadness'),
      soothes: ['heavy'],
      chips: ['Tends Buried Sadness', 'HARMONY -> Delight'],
    });
    expect(spark!.relations.map((r) => r.relation)).toEqual(['opposite', 'neutral']);
    expect(buried).toMatchObject({ playable: false, chips: [] });
    expect(name!.relations.map((r) => r.relation)).toEqual(['neutral', 'neutral']);
  });

  it('unaffordable cards are not playable', () => {
    const t = scenario().energy(0).hand('love.kind_word').enemy('shade.grumble').build();
    expect(t.hints()[0]!.playable).toBe(false);
  });
});

describe('card text', () => {
  it('describeCard fills slots with base numbers and uses upgrade text', () => {
    expect(describeCard(ctx, 'love.kind_word', false)).toBe('Ease 6.');
    expect(describeCard(ctx, 'love.kind_word', true)).toBe('Ease 9.');
    expect(describeCard(ctx, 'love.unguarded', false)).toBe('Ease 5. If you have no Guard, Ease 11 instead.');
    expect(describeCard(ctx, 'hope.wish_on_a_star', false)).toBe('Ease 4. Promise: Ease 8 to the same Shade. Harmony: the Promise Eases 12 instead.');
    expect(describeCard(ctx, 'friendship.high_five', true)).toBe('Ease 7, +3 per Companion. Harmony: your Companions act now.');
  });

  it('Buried cards get generated text with their Weight', () => {
    expect(describeCard(ctx, 'buried.anger', false, 2)).toBe(
      'Weight 2. Unplayable. End of turn in hand: gain 2 Seething. Play a Love card Inward to Tend.',
    );
    const t = scenario().hand({ id: 'buried.fear', weight: 3 }).enemy('shade.grumble').build();
    expect(t.text('buried.fear')).toBe('Weight 3. Unplayable. End of turn in hand: gain 3 Trembling. Play a Courage card Inward to Tend.');
  });

  it('in combat: card-face numbers include Nerve and Heavy (not Promise hits); Guard includes Trembling', () => {
    const t = scenario().statuses({ nerve: 2, heavy: 1, trembling: 2 }).hand('love.kind_word', 'hope.wish_on_a_star', 'hope.silver_lining').enemy('shade.grumble').build();
    expect(t.text('love.kind_word')).toBe('Ease 6.'); // (6+2) x3/4 = 6
    expect(t.text('hope.wish_on_a_star')).toBe('Ease 4. Promise: Ease 8 to the same Shade. Harmony: the Promise Eases 12 instead.');
    expect(t.text('hope.silver_lining')).toBe('Gain 3 Guard. Promise: gain 3 Guard and draw 1.');
  });

  it('against a target: the final number (type chart, Understood), not reduced by its Guard', () => {
    const t = scenario().compass().note('joy').hand('love.kind_word', 'friendship.high_five').companions('comp.lantern_moth')
      .enemy('shade.grumble', { guard: 5 }).enemy('shade.echo').build();
    expect(t.text('love.kind_word', 0)).toBe('Ease 12.'); // Harmonized Love+Joy: OPPOSITE vs Anger
    expect(t.text('love.kind_word', 1)).toBe('Ease 6.'); // Love neutral, Joy dissonant vs Loneliness: best is neutral
    expect(t.text('friendship.high_five')).toBe('Ease 7, +2 per Companion. Harmony: your Companions act now.');
  });
});

describe('Preview', () => {
  it('SUPPRESS banner lists the cards that could Resolve instead', () => {
    const t = scenario().hand('courage.brave_strike', 'love.kind_word', 'joy.bright_spark').enemy('shade.grumble', { hp: 5 }).enemy('shade.mope').build();
    const p = t.preview('courage.brave_strike', 0)!;
    expect(p.targets[0]!.outcome).toBe('suppress');
    expect(p.resolveWith).toEqual([t.uid('love.kind_word')]);
  });

  it('draws make the preview uncertain and stop there', () => {
    const t = scenario().hand('joy.bright_spark').draw('courage.stand_firm').enemy('shade.mope', { hp: 40 }).build();
    const p = t.preview('joy.bright_spark', 0)!;
    expect(p.uncertain).toBe(true);
    expect(p.targets[0]!.hpAfter).toBe(32);
    expect(p.line).toContain('Then draws.');
  });

  it('endTurn preview: Seething + strikes after Guard, lethal warning, and M2-projected Flare', () => {
    const t = scenario().player({ hp: 10, guard: 3 }).statuses({ seething: 2 }).draw(...five).enemy('shade.grumble', { intent: 'snap', statuses: { flare: 2 } }).build();
    const p = t.previewEndTurn()!;
    expect(p.player.incomingLoss).toBe(2 + 6);
    expect(p.player.lethalToPlayer).toBe(false);
    expect(p.uncertain).toBe(false);
    const u = scenario().player({ hp: 8 }).statuses({ seething: 2 }).draw(...five).enemy('shade.grumble', { intent: 'snap' }).build();
    const q = u.previewEndTurn()!;
    expect(q.player.lethalToPlayer).toBe(true);
    expect(q.line).toContain('Lethal: you will fall.');
  });

  it('play previews estimate the Heart you will lose at end of turn with the new Guard', () => {
    const t = scenario().hand('courage.stand_firm').enemy('shade.grumble', { intent: 'snap' }).build();
    const p = t.preview('courage.stand_firm')!;
    expect(p.player.guardAfter).toBe(5);
    expect(p.player.incomingLoss).toBe(2);
    expect(p.line).toBe('Stand Firm: gain 5 Guard.');
  });

  it('Surfaced SUPPRESS line names the boss growth (16.2: "The Numbness +20 Intensity")', () => {
    const t = scenario().removed({ id: 'buried.fear', weight: 2 }).hand('joy.confetti')
      .enemy('shade.surfaced_fear', { hp: 4, surfacedFromCard: 1 }).enemy('shade.numbness', { hp: 150, statuses: { veiled: 1 } }).build();
    const p = t.preview('joy.confetti')!;
    expect(p.targets.find((x) => x.uid === t.enemy(0).uid)!.outcome).toBe('suppress');
    expect(p.line).toContain('Finishes it: SUPPRESS. The Numbness +20 Intensity.');
  });

  it('Surfaced RESOLVE line names the Insight, or the release when that Insight was already made', () => {
    const t = scenario().removed({ id: 'buried.fear', weight: 2 }).hand('courage.brave_strike')
      .enemy('shade.surfaced_fear', { hp: 5, surfacedFromCard: 1 }).enemy('shade.numbness', { hp: 150, statuses: { veiled: 1 } }).build();
    expect(t.preview('courage.brave_strike', 0)!.line).toContain('Finishes it: RESOLVE, Insight: Instinct joins your hand, Caution:');
    const u = scenario().insightsMade('insight.instinct').removed({ id: 'buried.fear', weight: 2 }).hand('courage.brave_strike')
      .enemy('shade.surfaced_fear', { hp: 5, surfacedFromCard: 1 }).enemy('shade.numbness', { hp: 150, statuses: { veiled: 1 } }).build();
    expect(u.preview('courage.brave_strike', 0)!.line).toContain('Finishes it: RESOLVE, Buried Fear is released, Caution:');
  });

  it('illegal plays have no preview; previews never touch the input state', () => {
    const t = scenario().energy(0).hand('love.kind_word').enemy('shade.grumble').build();
    const before = JSON.stringify(t.state);
    expect(t.preview('love.kind_word', 0)).toBe(null);
    const u = scenario().hand('love.kind_word').enemy('shade.grumble').build();
    const b2 = JSON.stringify(u.state);
    u.preview('love.kind_word', 0);
    u.previewEndTurn();
    u.intents();
    u.hints();
    expect(JSON.stringify(t.state)).toBe(before);
    expect(JSON.stringify(u.state)).toBe(b2);
  });
});
