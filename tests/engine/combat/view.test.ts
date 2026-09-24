// 16.2 UI data: IntentView text and numbers, HandHints, card text slots, Preview lines and banners.
import { describe, expect, it } from 'vitest';
import { describeCard } from '../../../src/engine/combat/index';
import { miniPack } from '../../fixtures/miniPack';
import { testPack } from '../../fixtures/testPack';
import { ctxFor } from '../../helpers/run';
import { scenario } from '../../helpers/scenario';

const five = ['courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm'];
const ctx = ctxFor(testPack);

describe('IntentView', () => {
  it('numbers include Flare and Hush; text explains them', () => {
    const t = scenario().draw(...five).enemy('shade.grumble', { intent: 'snap', statuses: { flare: 1 } }).enemy('shade.mope', { intent: 'drizzle', statuses: { hush: 1 } }).build();
    const [a, b] = t.intents();
    expect(a).toMatchObject({ moveId: 'snap', name: 'Snap', kinds: ['strike'], strikes: { perStrike: 8, count: 1 }, guard: null, afflict: null, afflicts: [] });
    expect(a!.text).toBe('Strikes for 8 (7 + 1 Flare).');
    expect(b!.strikes).toEqual({ perStrike: 1, count: 3 });
    expect(b!.text).toBe('Strikes 3 times for 1 each (2 - 1 Hush).');
  });

  it('guard and afflict parts; overriddenBy names the gauge', () => {
    const t = scenario().draw(...five).enemy('shade.kettle', { statuses: { pressure: 6 }, intent: 'boil_over' }).enemy('shade.mope', { intent: 'curl_up' }).build();
    const [k, m] = t.intents();
    expect(k).toMatchObject({ overriddenBy: 'pressure', afflict: { id: 'seething', stacks: 3 }, afflicts: [{ id: 'seething', stacks: 3 }] });
    expect(k!.text).toContain('Pressure is full');
    expect(m).toMatchObject({ guard: 10, text: 'Gains 10 Guard.' });
  });

  it('afflicts lists every affliction in move order; afflict is the first; the text names them all', () => {
    const t = scenario(miniPack).draw(...five).enemy('shade.numbness', { intent: 'nothing_much' }).build();
    const [n] = t.intents();
    expect(n!.afflicts).toEqual([{ id: 'heavy', stacks: 1 }, { id: 'hollow', stacks: 1 }]);
    expect(n!.afflict).toEqual({ id: 'heavy', stacks: 1 });
    expect(n!.text).toBe('Strikes for 8. Gives you 1 Heavy and 1 Hollow.');
    const u = scenario().draw(...five).enemy('shade.longing', { intent: 'remember' }).enemy('shade.grumble', { intent: 'snap' }).build();
    const [l, g] = u.intents();
    expect(l).toMatchObject({ guard: 10, afflict: { id: 'heavy', stacks: 1 }, afflicts: [{ id: 'heavy', stacks: 1 }, { id: 'isolated', stacks: 1 }] });
    expect(l!.text).toBe('Gains 10 Guard. Gives you 1 Heavy and 1 Isolated.');
    expect(g).toMatchObject({ afflict: null, afflicts: [] });
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

  it('relations list only the Shades the card could reach (Shy, Reaches Shy, ALL, Veiled)', () => {
    const t = scenario().hand('love.kind_word', 'neutral.name_it', 'joy.confetti', 'courage.stand_firm')
      .enemy('shade.wallflower').enemy('shade.grumble').build();
    const [wall, grumble] = [t.enemy(0).uid, t.enemy(1).uid];
    const reach = t.hints().map((h) => h.relations.map((r) => r.enemy));
    expect(reach).toEqual([
      [grumble], // enemy card: Wallflower is Shy while Grumble stands
      [wall, grumble], // Reaches Shy
      [wall, grumble], // ALL hits reach Shy Shades
      [wall, grumble], // self card: informative, every Shade that isn't Veiled
    ]);
    const u = scenario().removed({ id: 'buried.fear', weight: 2 }).hand('love.kind_word', 'joy.confetti', 'courage.stand_firm')
      .enemy('shade.surfaced_fear', { hp: 20, surfacedFromCard: 1 }).enemy('shade.numbness', { hp: 150, statuses: { veiled: 1 } }).build();
    const surfaced = u.enemy(0).uid;
    expect(u.hints().map((h) => h.relations.map((r) => r.enemy))).toEqual([[surfaced], [surfaced], [surfaced]]);
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

  it('intentAfter: a gauge reaching its override (Kettle Pressure 6: boil_over), through the M2 projection', () => {
    const t = scenario().hand('courage.brave_strike').enemy('shade.kettle', { hp: 90, intent: 'rattle', statuses: { pressure: 5 } }).build();
    expect(t.intents()[0]!.moveId).toBe('rattle');
    const k = t.preview('courage.brave_strike', 0)!.targets[0]!;
    expect(k.gauges.pressure).toEqual([5, 6]);
    expect(k.intentAfter).toMatchObject({ moveId: 'boil_over', overriddenBy: 'pressure', strikes: { perStrike: 24, count: 1 }, projected: false });
    t.play('courage.brave_strike', 0);
    expect(t.intents()[0]).toEqual(k.intentAfter);
    // From festerTurn the pill after the play already includes Festering's Flare.
    const u = scenario().turn(12).hand('courage.brave_strike').enemy('shade.kettle', { hp: 90, intent: 'rattle', statuses: { pressure: 5 } }).build();
    const f = u.preview('courage.brave_strike', 0)!.targets[0]!;
    expect(f.intentAfter).toMatchObject({ moveId: 'boil_over', strikes: { perStrike: 25, count: 1 }, projected: true, projectedReason: 'The Shades fester: +1 Flare.' });
  });

  it('intentAfter: The Mask turned by the play, then by the Lantern Moth at end of turn (not the current intent)', () => {
    const t = scenario().companions('comp.lantern_moth').hand('joy.giggle').enemy('shade.mask', { hp: 150, faceIndex: 1 }).build();
    expect(t.intents()[0]).toMatchObject({ moveId: 'weep', projected: false });
    const m = t.preview('joy.giggle', 0)!.targets[0]!;
    expect(m.faceAfter).toBe('loneliness'); // the play turns it: its current intent becomes turn_away
    expect(m.intentAfter).toMatchObject({ moveId: 'startle', projected: true, projectedReason: 'Lantern Moth will turn it to Fear.' });
    t.play('joy.giggle', 0);
    expect(t.enemy(0).intent!.moveId).toBe('turn_away');
    expect(t.intents()[0]).toEqual(m.intentAfter);
    const u = scenario().hand('joy.giggle').enemy('shade.mask', { hp: 150, faceIndex: 1 }).build();
    expect(u.preview('joy.giggle', 0)!.targets[0]!.intentAfter).toMatchObject({ moveId: 'turn_away', projected: false });
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
