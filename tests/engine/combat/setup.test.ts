// 5.1 combat start and 5.8 / 12.1 buildCombatResult.
import { describe, expect, it } from 'vitest';
import { buildCombatResult, startCombat } from '../../../src/engine/combat/index';
import { miniPack } from '../../fixtures/miniPack';
import { ctxFor, makeState } from '../../helpers/run';
import { scenario, startScenario } from '../../helpers/scenario';

const five = ['courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm'];

describe('5.1 combat start', () => {
  it('copies the deck (keeping uids), shuffles with the node stream, spawns left to right, rolls intents, starts turn 1', () => {
    const ctx = ctxFor(miniPack);
    const s = makeState(miniPack.starter.deck);
    const a = startCombat(s, ctx, { encounter: 'enc.grumble_mope', nodeId: 3, nodeSeed: 99, tier: 'normal' });
    const b = startCombat(s, ctx, { encounter: 'enc.grumble_mope', nodeId: 3, nodeSeed: 99, tier: 'normal' });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    const c = a.state.combat!;
    expect(a.state.phase).toEqual({ kind: 'combat', nodeId: 3 });
    expect(Object.keys(c.cards).map(Number).sort((x, y) => x - y)).toEqual(s.run.deck.map((d) => d.uid));
    expect(c.turn).toBe(1);
    expect(c.energy).toBe(3);
    expect(c.piles.hand).toHaveLength(5);
    expect(c.piles.draw).toHaveLength(6);
    expect(c.enemies.map((e) => e.defId)).toEqual(['shade.grumble', 'shade.mope']);
    expect(c.enemies[0]!.hp).toBeGreaterThanOrEqual(40);
    expect(c.enemies[0]!.hp).toBeLessThanOrEqual(44);
    expect(c.enemies[1]!.hp).toBeGreaterThanOrEqual(40);
    expect(c.enemies[1]!.hp).toBeLessThanOrEqual(44);
    expect(c.enemies.every((e) => e.intent !== null)).toBe(true);
    expect(a.revealedHiddenInfo).toBe(true);
    expect(a.state.nextUid).toBeGreaterThan(s.nextUid);
    expect(a.events.filter((e) => e.e === 'spawn')).toHaveLength(2);
    expect(s.combat).toBe(null);
    const other = startCombat(s, ctx, { encounter: 'enc.grumble_mope', nodeId: 3, nodeSeed: 100, tier: 'normal' });
    expect(other.state.combat!.piles.draw.join()).not.toBe(c.piles.draw.join());
  });

  it('uses pre-rolled HP when given', () => {
    const t = startScenario({ deck: [...five, ...five], encounter: 'enc.two_grumbles', hps: [27, 29] });
    expect(t.c.enemies.map((e) => [e.hp, e.maxHp])).toEqual([[27, 27], [29, 29]]);
  });

  it('17.1 kind opening hands: in tutorial fights an OPPOSITE card is swapped into the opening 5', () => {
    const deck = [...five, ...five, ...five, 'love.kind_word'];
    for (let seed = 1; seed <= 20; seed++) {
      const t = startScenario({ deck, encounter: 'enc.t1', tier: 'tutorial', seed });
      expect(t.handIds()).toContain('love.kind_word');
    }
    const misses = Array.from({ length: 20 }, (_, i) => startScenario({ deck, encounter: 'enc.grumble', seed: i + 1 }))
      .filter((t) => !t.handIds().includes('love.kind_word'));
    expect(misses.length).toBeGreaterThan(0);
  });

  it('an empty encounter id throws', () => {
    expect(() => startScenario({ deck: five, encounter: 'enc.nope' })).toThrow();
  });
});

describe('buildCombatResult', () => {
  it('Glimmers = tier base + Resolve bonuses by Shade tier; allResolved ignores Fleeting Fades', () => {
    const t = scenario().hand('love.kind_word', 'courage.brave_strike').enemy('shade.grumble', { hp: 5 }).enemy('shade.doubt', { hp: 7 }).build();
    t.play('courage.brave_strike', 1);
    t.play('love.kind_word', 0);
    const r = t.result();
    expect(r).toMatchObject({ outcome: 'won', heartAfter: 70, glimmers: 10 + 8, allResolved: true, paperCraneUsed: false });
    expect(r.gone.map((g) => g.outcome)).toEqual(['fade', 'resolve']);
  });

  it('elite and boss tiers; a Suppress breaks Full Bloom', () => {
    const elite = scenario().tier('elite').hand('love.kind_word').enemy('shade.kettle', { hp: 5 }).build();
    elite.play('love.kind_word', 0);
    expect(elite.result().glimmers).toBe(25 + 20);
    const boss = scenario().tier('boss').hand('courage.brave_strike').enemy('shade.mask', { hp: 5 }).build();
    boss.play('courage.brave_strike', 0);
    expect(boss.result()).toMatchObject({ glimmers: 60, allResolved: false, mutations: [{ k: 'suppress', shade: 'anger' }] });
  });

  it('The Numbness pays nothing; a lost combat pays nothing', () => {
    const t = scenario().tier('final').hand('blend.sunbeam').enemy('shade.numbness', { hp: 5 }).build();
    t.play('blend.sunbeam', 0);
    expect(t.result().glimmers).toBe(0);
    const lost = scenario().player({ hp: 1 }).draw(...five).enemy('shade.grumble', { intent: 'snap' }).build();
    lost.endTurn();
    expect(lost.result()).toMatchObject({ outcome: 'lost', glimmers: 0, heartAfter: 0 });
  });

  it('throws before the combat is over', () => {
    const t = scenario().enemy('shade.grumble').build();
    expect(() => buildCombatResult(t.state, t.ctx)).toThrow();
  });
});
