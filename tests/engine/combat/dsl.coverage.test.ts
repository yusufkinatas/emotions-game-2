// Every DSL construct in types.ts must work from plain data (the content pack uses nothing else).
// This file covers the ones the rule tests don't already exercise.
import { describe, expect, it } from 'vitest';
import { draw, ease, guard, iff, per, status, strike } from '../../../src/engine/dsl';
import type { CardDef, ContentPack, EnemyDef, KeepsakeDef } from '../../../src/engine/types';
import { testPack } from '../../fixtures/testPack';
import { scenario } from '../../helpers/scenario';

const five = ['courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm'];

const card = (d: Partial<CardDef> & Pick<CardDef, 'id' | 'effects'>): CardDef => ({
  name: d.id, lights: [], kind: 'skill', rarity: 'common', cost: 0, target: 'none', text: '', availableFromAct: 1, ...d,
});

const extended = (extra: { cards?: CardDef[]; enemies?: EnemyDef[]; keepsakes?: KeepsakeDef[] }): ContentPack => ({
  ...testPack,
  cards: { ...testPack.cards, ...Object.fromEntries((extra.cards ?? []).map((c) => [c.id, c])) },
  enemies: { ...testPack.enemies, ...Object.fromEntries((extra.enemies ?? []).map((c) => [c.id, c])) },
  keepsakes: { ...testPack.keepsakes, ...Object.fromEntries((extra.keepsakes ?? []).map((c) => [c.id, c])) },
});

describe('DSL coverage', () => {
  it("Countable 'buriedInHand' and Cond 'count'", () => {
    const pack = extended({
      cards: [card({ id: 'x.weigh', effects: [guard(per('buriedInHand', 3)), iff({ c: 'count', of: 'buriedInHand', op: '>=', n: 2 }, [draw(1)])] })],
    });
    const t = scenario(pack).hand('x.weigh', 'buried.anger', 'buried.fear').draw('courage.stand_firm').enemy('shade.grumble').build();
    t.play('x.weigh');
    expect(t.c.player.guard).toBe(6);
    expect(t.handIds()).toContain('courage.stand_firm');
  });

  it("Countable { status, on: 'player' } and Cond status on 'player' / 'target'", () => {
    const pack = extended({
      cards: [
        card({
          id: 'x.brave', target: 'enemy', kind: 'ease',
          effects: [ease(per({ status: 'nerve', on: 'player' }, 2, 1)), iff({ c: 'status', id: 'flare', on: 'target', op: '>', n: 0 }, [status('warmth', 1)])],
        }),
      ],
    });
    const t = scenario(pack).statuses({ nerve: 2 }).hand('x.brave').enemy('shade.grumble', { hp: 40, statuses: { flare: 1 } }).build();
    t.play('x.brave', 0);
    expect(t.eventsOf('hit')[0]!.b.base).toBe(5);
    expect(t.status('warmth')).toBe(1);
  });

  it("Keepsake 'turnStart' fires every turn; a 'combat' limit fires once per combat", () => {
    const pack = extended({
      keepsakes: [
        { id: 'ks.x_every', name: 'Every', rarity: 'common', text: '', on: { turnStart: { effects: [guard(1)] } } },
        { id: 'ks.x_once', name: 'Once', rarity: 'common', text: '', on: { turnStart: { effects: [status('nerve', 1)], limit: 'combat' } } },
      ],
    });
    const t = scenario(pack).keepsakes('ks.x_every', 'ks.x_once').draw(...five, ...five, ...five).enemy('shade.mope', { intent: 'curl_up' }).build();
    t.endTurn();
    expect(t.c.player.guard).toBe(1);
    expect(t.status('nerve')).toBe(1);
    t.endTurn();
    expect(t.c.player.guard).toBe(1);
    expect(t.status('nerve')).toBe(1);
  });

  it("flag 'insightUpgraded' on its own upgrades created Insights", () => {
    const pack = extended({ keepsakes: [{ id: 'ks.x_up', name: 'Up', rarity: 'rare', text: '', flags: ['insightUpgraded'] }] });
    const t = scenario(pack).keepsakes('ks.x_up').hand('love.kind_word', 'buried.anger').enemy('shade.grumble').build();
    t.play('love.kind_word', 'inward');
    expect(t.eventsOf('insight')[0]!.upgraded).toBe(true);
  });

  it('byFace patterns support overrides', () => {
    const pack = extended({
      enemies: [
        {
          ...testPack.enemies['shade.mask']!,
          id: 'shade.x_mask',
          moves: { ...testPack.enemies['shade.mask']!.moves, calm: { name: 'Calm', intent: ['strike'], effects: [strike(1)] } },
          pattern: {
            kind: 'byFace',
            moves: { anger: 'rage', sadness: 'weep', loneliness: 'turn_away', fear: 'startle' },
            overrides: [{ if: { c: 'status', id: 'hush', on: 'self', op: '>=', n: 1 }, move: 'calm' }],
          },
        },
      ],
    });
    const t = scenario(pack).hand('calm.lullaby').enemy('shade.x_mask', { hp: 150 }).build();
    expect(t.enemy(0).intent!.moveId).toBe('rage');
    t.play('calm.lullaby', 0);
    expect(t.enemy(0).intent!.moveId).toBe('calm');
  });

  it("an unknown 'custom' hook throws (v1 ships none)", () => {
    const pack = extended({ cards: [card({ id: 'x.custom', effects: [{ op: 'custom', id: 'nope' }] })] });
    const t = scenario(pack).hand('x.custom').enemy('shade.grumble').build();
    expect(() => t.play('x.custom')).toThrow(/custom hook/);
  });

  it('the trigger cap stops runaway loops', () => {
    const pack = extended({
      enemies: [
        {
          ...testPack.enemies['shade.grumble']!,
          id: 'shade.x_loop',
          passives: [{ name: 'Loop', on: 'shadeLeft', effects: [] }, { name: 'Echo', on: 'faceTurned', effects: [] }],
        },
      ],
      keepsakes: [{ id: 'ks.x_loop', name: 'Loop', rarity: 'common', text: '', on: { shadeGainedFlare: { effects: [status('flare', 1, 'all')] } } }],
    });
    const t = scenario(pack).keepsakes('ks.x_loop').hand('love.kind_word').enemy('shade.x_loop', { hp: 40 }).enemy('shade.mope').build();
    expect(() => t.play('love.kind_word', 1)).toThrow(/RunawayTriggers/);
  });
});
