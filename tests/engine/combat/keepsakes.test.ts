// Section 9 Keepsakes: every in-combat trigger (with limits) and flag.
import { describe, expect, it } from 'vitest';
import { defaultPack } from '../../../src/content';
import { scenario, startScenario } from '../../helpers/scenario';

const five = ['courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm'];
const lots = [...five, ...five, ...five];

describe('Keepsake triggers', () => {
  it('combatStart in acquisition order, before Shade passives: Woven Bracelet, Brave Pebble, Chipped Teacup', () => {
    const t = startScenario({ deck: lots, encounter: 'enc.skitter', keepsakes: ['ks.woven_bracelet', 'ks.brave_pebble', 'ks.chipped_teacup'], seed: 2 });
    expect(t.c.companions.map((x) => x.defId)).toEqual(['comp.lantern_moth']);
    expect(t.status('nerve')).toBe(1);
    expect(t.status('seething')).toBe(3);
    expect(t.c.energy).toBe(4); // +1 Spirit each turn
    const order = t.log.filter((e) => e.e === 'keepsake' || e.e === 'spawn').map((e) => e.e);
    expect(order.indexOf('keepsake')).toBeLessThan(order.lastIndexOf('spawn'));
  });

  it('Yellow Umbrella blocks Chipped Teacup\'s Seething', () => {
    const t = startScenario({ deck: lots, encounter: 'enc.grumble', keepsakes: ['ks.chipped_teacup', 'ks.yellow_umbrella'], seed: 2 });
    expect(t.status('seething')).toBe(0);
    expect(t.c.umbrellaUsed).toBe(true);
  });

  it('turn 1: Sun Charm draws 2 extra, Morning Tea +1 Spirit, Warm Socks 6 Guard; Spiral Shell +1 Spirit', () => {
    const t = startScenario({ deck: lots, encounter: 'enc.grumble', keepsakes: ['ks.sun_charm', 'ks.morning_tea', 'ks.warm_socks', 'ks.spiral_shell'], seed: 2 });
    expect(t.c.piles.hand).toHaveLength(7);
    expect(t.c.energy).toBe(5);
    expect(t.c.player.guard).toBe(6);
    t.endTurn();
    expect(t.c.piles.hand).toHaveLength(5);
    expect(t.c.energy).toBe(4);
  });

  it('L7: Woven Bracelet summons at turn 1 start, after the Guard reset, so Welcome Mat\'s 3 Guard is kept', () => {
    const t = startScenario({ pack: defaultPack, deck: lots, encounter: 'enc.a1.grumble', keepsakes: ['ks.woven_bracelet', 'ks.welcome_mat'], seed: 2 });
    expect(t.c.turn).toBe(1);
    expect(t.c.companions.map((x) => x.defId)).toEqual(['comp.lantern_moth']);
    expect(t.c.player.guard).toBe(3);
    const turn1 = t.log.findIndex((e) => e.e === 'turn' && e.side === 'player' && e.n === 1);
    const bracelet = t.log.findIndex((e) => e.e === 'keepsake' && e.id === 'ks.woven_bracelet');
    expect(bracelet).toBeGreaterThan(turn1);
    t.endTurn();
    expect(t.c.companions).toHaveLength(1); // once per combat, not every turn
  });

  it('Ember Lantern: whenever a Shade gains Flare, gain 2 Guard (Festering counts per Shade)', () => {
    const t = scenario().keepsakes('ks.ember_lantern').hand('love.kind_word').enemy('shade.mope', { hp: 40 }).build();
    t.play('love.kind_word', 0);
    expect(t.c.player.guard).toBe(2);
    const u = scenario().keepsakes('ks.ember_lantern').turn(12).draw(...lots).enemy('shade.mope', { intent: 'curl_up' }).enemy('shade.mope', { intent: 'curl_up' }).build();
    u.endTurn();
    expect(u.eventsOf('keepsake').filter((e) => e.id === 'ks.ember_lantern')).toHaveLength(2);
  });

  it('Pressed Flower: whenever you Resolve a Shade, Mend 3', () => {
    const t = scenario().player({ hp: 50 }).keepsakes('ks.pressed_flower').hand('love.kind_word').enemy('shade.grumble', { hp: 5 }).enemy('shade.mope').build();
    t.play('love.kind_word', 0);
    expect(t.c.player.hp).toBe(53);
  });

  it('turnEnd Keepsake hits are automatic (Little Bell hits your last target, never DISSONANT)', () => {
    const t = scenario().keepsakes('ks.bell').statuses({ nerve: 5 }).draw(...lots).enemy('shade.mope', { hp: 30, intent: 'curl_up' }).build();
    t.endTurn();
    const hit = t.eventsOf('hit')[0]!;
    expect(hit.b.fromCard).toBe(false);
    expect(hit.b.damage).toBe(2);
  });

  it('Paper Crane: once per run; committed through the CombatResult', () => {
    const t = scenario().player({ hp: 4 }).keepsakes('ks.paper_crane').draw('love.kind_word', ...lots).enemy('shade.grumble', { hp: 10, intent: 'snap' }).build();
    t.endTurn();
    expect(t.c.player.hp).toBe(25);
    expect(t.c.paperCraneUsed).toBe(true);
    t.play('love.kind_word', 0);
    expect(t.c.outcome).toBe('won');
    const r = t.result();
    expect(r.paperCraneUsed).toBe(true);
    expect(r.keepsakeCounters).toEqual({ 'ks.paper_crane': 1 });
    const done = scenario().player({ hp: 4 }).keepsakes('ks.paper_crane').paperCraneAlreadyUsed().draw(...lots).enemy('shade.grumble', { hp: 30, intent: 'snap' }).build();
    done.endTurn();
    expect(done.c.outcome).toBe('lost');
    expect(done.result().keepsakeCounters).toEqual({});
  });

  it('Friendship Bracelet with an empty Note: Companion hits count as Friendship', () => {
    const t = scenario().keepsakes('ks.friendship_bracelet').companions('comp.lantern_moth').draw(...lots).enemy('shade.echo', { hp: 30, intent: 'call_out' }).build();
    t.endTurn();
    expect(t.eventsOf('hit')[0]!.b.lights).toEqual(['friendship']);
  });

  it('Keepsake hooks limited to once per turn reset at your turn start', () => {
    const t = scenario().compass().keepsakes('ks.tuning_fork').note('love').hand('joy.bright_spark').draw(...lots, 'love.kind_word', 'joy.bright_spark')
      .enemy('shade.grumble', { hp: 60, intent: 'huff' }).build();
    t.play('joy.bright_spark', 0);
    expect(Object.keys(t.c.keepsakeFired)).toEqual(['ks.tuning_fork:harmonized']);
    t.endTurn();
    expect(t.c.keepsakeFired).toEqual({});
  });
});
