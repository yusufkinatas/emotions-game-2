// R-16 The Numbness family: Muffled/Felt, Veiled, Surfacing, B2 growth, Surfaced Resolve/Suppress, phases.
import { describe, expect, it } from 'vitest';
import { scenario, startScenario } from '../../helpers/scenario';

const five = ['courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm'];

describe('R-16 Surfacing and growth', () => {
  const deck = [
    ...five,
    ...five,
    { id: 'buried.anger', weight: 2 as const },
    { id: 'buried.fear', weight: 3 as const },
    { id: 'buried.sadness', weight: 1 as const },
    { id: 'buried.despair', weight: 1 as const },
  ];

  it('The Numbness: your 3 heaviest Buried cards rise (ties by wheel order) to its left; +6 per hidden Weight', () => {
    const t = startScenario({ deck, encounter: 'enc.numbness', tier: 'final' });
    expect(t.c.enemies.map((e) => [e.defId, e.hp])).toEqual([
      ['shade.surfaced_fear', 36],
      ['shade.surfaced_anger', 24],
      ['shade.surfaced_sadness', 12],
      ['shade.numbness', 186],
    ]);
    const boss = t.c.enemies[3]!;
    expect(boss.maxHp).toBe(186);
    expect(boss.statuses.veiled).toBe(1);
    expect(t.c.piles.removed).toHaveLength(3);
    expect(t.eventsOf('surfaced')).toHaveLength(3);
    // the boss can't be targeted and ALL hits skip it
    expect(t.legal().some((a) => a.t === 'play' && a.target === boss.uid)).toBe(false);
  });

  it('Apathy surfaces your 1 heaviest Buried card and has no hidden growth; Lead Box: x1.5 Intensity', () => {
    const t = startScenario({ deck, encounter: 'enc.apathy', tier: 'elite', keepsakes: ['ks.lead_box'], hps: [90] });
    expect(t.c.enemies.map((e) => [e.defId, e.hp])).toEqual([
      ['shade.surfaced_fear', 54],
      ['shade.apathy', 90],
    ]);
  });

  it('Surfaced Shades act in the first enemy phase (snapshot)', () => {
    const t = startScenario({ deck, encounter: 'enc.apathy', tier: 'elite', hps: [90] });
    t.endTurn();
    expect(t.eventsOf('enemyMove').map((e) => t.log.find((x) => x.e === 'surfaced' && x.enemy === e.enemy) ? 'surfaced' : 'boss')).toEqual(['surfaced', 'boss']);
  });

  it('Surfaced Suppress: the card returns unchanged and the boss grows +10 x Weight; the Veil lifts', () => {
    const t = scenario().removed({ id: 'buried.fear', weight: 2 }).hand('joy.confetti')
      .enemy('shade.surfaced_fear', { hp: 4, surfacedFromCard: 1 }).enemy('shade.numbness', { hp: 150, statuses: { veiled: 1 } }).build();
    const p = t.preview('joy.confetti')!;
    const boss = p.targets.find((x) => x.maxHpAfter !== x.hpBefore && x.uid === t.enemy(1).uid)!;
    expect(boss.maxHpAfter).toBe(200);
    t.play('joy.confetti');
    expect(t.c.gone[0]!.outcome).toBe('suppress');
    expect(t.c.mutations).toEqual([{ k: 'returnSurfaced', uid: 1 }]);
    expect(t.c.piles.discard).toContain(1);
    expect(t.enemy(0).defId).toBe('shade.numbness');
    expect(t.enemy(0).maxHp).toBe(200);
    expect(t.enemy(0).hp).toBe(170);
    expect(t.enemy(0).statuses.veiled ?? 0).toBe(0);
  });

  it('Surfaced Resolve: its Buried card becomes its Insight in your hand (upgraded at peak 2); Journal does not trigger', () => {
    const t = scenario().keepsakes('ks.journal').removed({ id: 'buried.fear', weight: 2 }).hand('courage.brave_strike').draw('courage.stand_firm')
      .enemy('shade.surfaced_fear', { hp: 5, surfacedFromCard: 1 }).enemy('shade.numbness', { hp: 150, statuses: { veiled: 1 } }).build();
    t.play('courage.brave_strike', 0);
    expect(t.c.gone[0]!.outcome).toBe('resolve');
    expect(t.c.mutations).toEqual([{ k: 'transform', uid: 1, to: 'insight.instinct', upgraded: true }]);
    expect(t.handIds()).toEqual(['insight.instinct']);
    expect(t.c.glimmers).toBe(0);
    expect(t.c.player.guard).toBe(6); // Caution, and no Journal Guard
  });

  it('Surfaced Resolve with the Insight already made removes its Buried card; Lead Box does not block it', () => {
    const t = scenario().keepsakes('ks.lead_box').insightsMade('insight.instinct').removed({ id: 'buried.fear', weight: 2 }).hand('courage.brave_strike')
      .enemy('shade.surfaced_fear', { hp: 5, surfacedFromCard: 1 }).enemy('shade.numbness', { hp: 150, statuses: { veiled: 1 } }).build();
    t.play('courage.brave_strike', 0);
    expect(t.c.mutations).toEqual([{ k: 'remove', uid: 1 }]);
    expect(t.eventsOf('peace')).toHaveLength(1);
  });

  it('while Veiled, Companions and Promises hit the leftmost Shade that is not Veiled', () => {
    const t = scenario().removed('buried.anger').companions('comp.lantern_moth').draw(...five).enemy('shade.surfaced_anger', { hp: 20, surfacedFromCard: 1 })
      .enemy('shade.numbness', { hp: 150, statuses: { veiled: 1 }, intent: 'fog' }).build();
    t.endTurn();
    expect(t.eventsOf('hit')[0]!.to).toEqual({ side: 'enemy', uid: t.enemy(0).uid });
  });
});

describe('R-16 Muffled and Felt', () => {
  it('one Light is MUFFLED x1/2, two Lights are FELT x2, and neither changes Flare', () => {
    const t = scenario().hand('love.kind_word', 'blend.sunbeam').draw('courage.stand_firm').enemy('shade.numbness', { hp: 150, statuses: { flare: 1 } }).build();
    t.play('love.kind_word', 0);
    expect(t.eventsOf('hit')[0]!.b).toMatchObject({ relation: 'muffled', damage: 3 });
    t.play('blend.sunbeam', 0);
    expect(t.eventsOf('hit')[0]!.b).toMatchObject({ relation: 'felt', damage: 14 });
    expect(t.enemy(0).statuses.flare).toBe(1);
  });

  it('a FELT card finishing hit Resolves (no Afterglow); a non-FELT one Suppresses with no Buried card', () => {
    const a = scenario().hand('blend.sunbeam').draw('courage.stand_firm').enemy('shade.numbness', { hp: 5 }).build();
    a.play('blend.sunbeam', 0);
    expect(a.c.gone[0]!.outcome).toBe('resolve');
    expect(a.eventsOf('resolved')[0]!.afterglows).toEqual([]);
    const b = scenario().hand('love.kind_word').enemy('shade.numbness', { hp: 2 }).build();
    b.play('love.kind_word', 0);
    expect(b.c.gone[0]!.outcome).toBe('suppress');
    expect(b.c.mutations).toEqual([]);
  });

  it('an automatic FELT finishing hit Resolves (Friendship Bracelet with a Blend Note)', () => {
    const t = scenario().keepsakes('ks.friendship_bracelet').note('love', 'joy').companions('comp.lantern_moth').draw(...five)
      .enemy('shade.numbness', { hp: 5 }).build();
    t.endTurn();
    expect(t.eventsOf('hit')[0]!.b.relation).toBe('felt');
    expect(t.c.gone[0]!.outcome).toBe('resolve');
    expect(t.c.outcome).toBe('won');
  });

  it('an automatic MUFFLED finishing hit leaves it Wavering', () => {
    const t = scenario().companions('comp.lantern_moth').draw(...five).enemy('shade.numbness', { hp: 1, intent: 'fog' }).build();
    t.endTurn();
    expect(t.enemy(0).hp).toBe(1);
    expect(t.enemy(0).statuses.wavering).toBe(1);
  });

  it('Thaw: the first time it drops to half, its pattern switches to Phase 2 and the intent re-derives to flatline', () => {
    const t = scenario().hand('blend.sunbeam').draw('courage.stand_firm').enemy('shade.numbness', { hp: 100, maxHp: 186 }).build();
    expect(t.enemy(0).intent!.moveId).toBe('static');
    t.play('blend.sunbeam', 0);
    expect(t.enemy(0).hp).toBe(86);
    expect(t.enemy(0).pattern.phase).toBe(1);
    expect(t.enemy(0).intent!.moveId).toBe('flatline');
  });

  it('B2: growth above the def max never skips Phase 1', () => {
    const t = scenario().draw(...five).enemy('shade.numbness', { hp: 240, maxHp: 240 }).build();
    expect(t.enemy(0).pattern.phase).toBe(0);
    expect(t.enemy(0).intent!.moveId).toBe('static');
  });
});
