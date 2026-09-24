// Adversarial review of the combat engine against DESIGN.md v1.1 and the types.ts contract.
// Every test here encodes a behaviour the spec states and FAILS on the engine as reviewed; it should pass
// once the engine is fixed. Open questions (ambiguous spec) are listed in the review report, not tested.
import { describe, expect, it } from 'vitest';
import { scenario } from '../../../helpers/scenario';

const five = ['courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm'];

describe('R-8b / 5.3 step 8 / 15.4: the finishing card is still a card played', () => {
  // R-8b skips the rest of the effect list and the later phases, not the fact that the card was played.
  // Harmonies are already counted at 5.3 step 4, so the finishing card shows up there but not in the play
  // counts; run stats (15.4: Lights used, most-played card) then undercount by one card per won combat.
  it('R-8b: the card that wins the combat counts in CombatStats (cardsPlayed, playsByCard, playsByLight)', () => {
    const t = scenario().compass().note('joy').hand('love.kind_word').enemy('shade.grumble', { hp: 5 }).build();
    t.play('love.kind_word', 0);
    expect(t.c.outcome).toBe('won');
    const s = t.result().stats;
    expect(s.harmonies).toBe(1);
    expect(s.cardsPlayed).toBe(1);
    expect(s.playsByCard['love.kind_word']).toBe(1);
    expect(s.playsByLight).toEqual({ love: 1, joy: 1 });
  });

  it('R-8b: over a combat, every card played is counted, including the last one', () => {
    const t = scenario().hand('love.kind_word', 'love.kind_word').enemy('shade.grumble', { hp: 13 }).build();
    t.play(t.uid('love.kind_word', 0), 0);
    t.play('love.kind_word', 0);
    expect(t.c.outcome).toBe('won');
    expect(t.result().stats.cardsPlayed).toBe(2);
    expect(t.result().stats.playsByCard['love.kind_word']).toBe(2);
  });
});

describe('5.7 step 2b / Effect spawn: summons go directly to the right of the summoner', () => {
  // DESIGN 5.7 2b: "Summons are inserted directly to the right of the summoner".
  // types.ts Effect 'spawn': "Summon a Shade directly to the right of the acting Shade."
  // The engine inserts after the summoner's earlier summons instead.
  it('5.7-2b: a new Doubt is inserted at summoner index + 1, ahead of an earlier Doubt', () => {
    const t = scenario()
      .draw(...five)
      .enemy('shade.skitter', { hp: 30, intent: 'hide' })
      .enemy('shade.doubt', { summonedBy: 0 })
      .enemy('shade.mope', { intent: 'curl_up' })
      .build();
    const [skitter, oldDoubt, mope] = t.c.enemies.map((e) => e.uid);
    t.endTurn();
    const spawned = t.eventsOf('spawn')[0]!.enemy;
    expect(t.c.enemies.map((e) => e.uid)).toEqual([skitter, spawned, oldDoubt, mope]);
  });
});
