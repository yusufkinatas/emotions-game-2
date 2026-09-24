// Section 7: every Shade mechanic, expressed with fixture Shades (pure DSL data).
import { describe, expect, it } from 'vitest';
import { scenario, startScenario } from '../../helpers/scenario';

const five = ['courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm'];
const lots = [...five, ...five, ...five, ...five];

describe('Act 1 Shades', () => {
  it('Grumble: cycle snap -> stomp -> huff', () => {
    const t = scenario().draw(...lots).enemy('shade.grumble').build();
    const moves: string[] = [];
    for (let i = 0; i < 4; i++) {
      t.endTurn();
      moves.push(t.eventsOf('enemyMove')[0]!.moveId);
    }
    expect(moves).toEqual(['snap', 'stomp', 'huff', 'snap']);
    expect(t.enemy(0).statuses.flare).toBe(1);
  });

  it('Grumble Short Fuse: a card without Love hit it this turn -> Flare +1 at the end of your turn (once)', () => {
    const t = scenario().hand('courage.brave_strike', 'courage.brave_strike', 'love.kind_word').draw(...lots).enemy('shade.grumble', { hp: 60, intent: 'huff' }).build();
    t.play(t.uid('courage.brave_strike', 0), 0);
    t.play('courage.brave_strike', 0);
    t.endTurn();
    expect(t.enemy(0).statuses.flare).toBe(2); // Short Fuse 1 + huff 1
    const u = scenario().hand('love.kind_word').draw(...lots).enemy('shade.grumble', { hp: 60, intent: 'snap' }).build();
    u.play('love.kind_word', 0);
    u.endTurn();
    expect(u.enemy(0).statuses.flare ?? 0).toBe(0);
  });

  it('Mope Wallow: restores 5 after its action unless a Joy hit landed since its previous action', () => {
    const t = scenario().hand('courage.brave_strike').draw(...lots).enemy('shade.mope', { hp: 40, intent: 'curl_up' }).build();
    t.play('courage.brave_strike', 0);
    t.endTurn();
    expect(t.enemy(0).hp).toBe(39);
    const u = scenario().hand('joy.bright_spark').draw(...lots).enemy('shade.mope', { hp: 40, intent: 'curl_up' }).build();
    u.play('joy.bright_spark', 0);
    u.endTurn();
    expect(u.enemy(0).hp).toBe(32);
    expect(u.enemy(0).memory.soothed ?? 0).toBe(0);
  });

  it('Skitter: combat start summons a Doubt; hide summons up to 2 live Doubts', () => {
    const t = startScenario({ deck: lots, encounter: 'enc.skitter', seed: 5, hps: [28] });
    expect(t.c.enemies.map((e) => e.defId)).toEqual(['shade.skitter', 'shade.doubt']);
    expect(t.enemy(1).fleeting).toBe(true);
    expect(t.enemy(1).summonerUid).toBe(t.enemy(0).uid);
  });

  it('Echo Last One Left: the first time it is the only Shade (combat start or when a Shade leaves), Flare +2 and Guard 10', () => {
    const alone = startScenario({ deck: lots, encounter: 'enc.echo', seed: 5 });
    expect(alone.enemy(0).statuses.flare).toBe(2);
    expect(alone.enemy(0).guard).toBe(10);
    const t = scenario().hand('love.kind_word').enemy('shade.grumble', { hp: 5 }).enemy('shade.echo', { hp: 30 }).build();
    t.play('love.kind_word', 0);
    expect(t.enemy(0).statuses.flare).toBe(2);
    expect(t.enemy(0).guard).toBe(10);
  });

  it('The Looming: summons 2 Doubts at start; Grows in the Dark without a Courage card this turn', () => {
    const t = startScenario({ deck: lots, encounter: 'enc.looming', seed: 5, tier: 'elite' });
    expect(t.c.enemies.map((e) => e.defId)).toEqual(['shade.looming', 'shade.doubt', 'shade.doubt']);
    const u = scenario().hand('courage.stand_firm').draw(...lots).enemy('shade.looming', { hp: 80, intent: 'pounce' }).build();
    u.endTurn();
    expect(u.enemy(0).statuses.flare).toBe(1);
    u.play('courage.stand_firm');
    u.endTurn();
    expect(u.enemy(0).statuses.flare).toBe(1);
  });

  it('The Kettle: Love cards let off 2 Pressure (min 0), others add 1; simmer adds 2', () => {
    const t = scenario().hand('love.kind_word').draw(...lots).enemy('shade.kettle', { hp: 90, statuses: { pressure: 1 }, intent: 'simmer' }).build();
    t.play('love.kind_word', 0);
    expect(t.enemy(0).statuses.pressure ?? 0).toBe(0);
    t.endTurn();
    expect(t.enemy(0).statuses.pressure).toBe(2);
  });
});

describe('Act 2 Shades', () => {
  it('Fret: flurry strikes 1 + Worry times; Worry +1 after its action (max 6); Calm hits remove 2', () => {
    const t = scenario().draw(...lots).enemy('shade.fret', { hp: 40, statuses: { worry: 2 }, intent: 'flurry' }).build();
    expect(t.intents()[0]!.strikes).toEqual({ perStrike: 3, count: 3 });
    t.endTurn();
    expect(t.eventsOf('strike')).toHaveLength(3);
    expect(t.enemy(0).statuses.worry).toBe(3);
    const u = scenario().hand('calm.lullaby').draw(...lots).enemy('shade.fret', { hp: 40, statuses: { worry: 6 }, intent: 'pace' }).build();
    u.play('calm.lullaby', 0);
    expect(u.enemy(0).statuses.worry).toBe(4);
    const cap = scenario().draw(...lots).enemy('shade.fret', { hp: 40, statuses: { worry: 6 }, intent: 'pace' }).build();
    cap.endTurn();
    expect(cap.enemy(0).statuses.worry).toBe(6);
  });

  it('Slump Heavy Silence: Guard 8 after its action if you played 2 or fewer cards last turn', () => {
    const t = scenario().draw(...lots).enemy('shade.slump', { hp: 50, intent: 'sigh_deeply' }).build();
    t.endTurn();
    expect(t.enemy(0).guard).toBe(8);
    const u = scenario().hand('courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm').draw(...lots).enemy('shade.slump', { hp: 50, intent: 'sigh_deeply' }).build();
    for (let i = 0; i < 3; i++) u.play('courage.stand_firm');
    u.endTurn();
    expect(u.enemy(0).guard).toBe(0);
  });

  it('Old Grudge: each non-OPPOSITE card hit adds Tally (max 6); rehash strikes 4 + 3 per Tally then resets', () => {
    const t = scenario().hand('courage.brave_strike', 'courage.brave_strike', 'love.kind_word').draw(...lots).enemy('shade.old_grudge', { hp: 60, intent: 'rehash' }).build();
    t.play(t.uid('courage.brave_strike', 0), 0);
    t.play('courage.brave_strike', 0);
    t.play('love.kind_word', 0);
    expect(t.enemy(0).statuses.tally).toBe(2);
    expect(t.intents()[0]!.strikes!.perStrike).toBe(10);
    t.endTurn();
    expect(t.eventsOf('strike')[0]!.amount).toBe(10);
    expect(t.enemy(0).statuses.tally ?? 0).toBe(0);
  });

  it('Longing Wallow: Joy or Friendship hits stop the restore', () => {
    const t = scenario().hand('friendship.reach_out').draw(...lots).enemy('shade.longing', { hp: 50, intent: 'remember' }).build();
    t.play('friendship.reach_out', 0);
    t.endTurn();
    expect(t.enemy(0).hp).toBe(44); // Friendship vs Sadness: x1 (6), then no Wallow restore
  });

  it('The Spiral: Coil starts 2 and grows after its action (max 6); Hope or Calm cards unwind 1, both 2 (min 1); Deepening', () => {
    const t = startScenario({ deck: lots, encounter: 'enc.spiral', seed: 3, tier: 'boss' });
    expect(t.enemy(0).statuses.coil).toBe(2);
    expect(t.intents()[0]!.strikes).toEqual({ perStrike: 3, count: 2 });
    const u = scenario().hand('blend.wait_it_out', 'calm.lullaby').draw(...lots).enemy('shade.spiral', { hp: 200, statuses: { coil: 6 }, intent: 'whats_the_point' }).build();
    u.play('blend.wait_it_out', 0); // Hope+Calm: -2, and the OPPOSITE hit turns its face: -1
    expect(u.enemy(0).statuses.coil).toBe(3);
    u.play('calm.lullaby', 0); // Calm vs Anxiety: -1, turn -1
    expect(u.enemy(0).statuses.coil).toBe(1);
    const cap = scenario().draw(...lots).enemy('shade.spiral', { hp: 200, statuses: { coil: 6 }, intent: 'around_again' }).build();
    cap.endTurn();
    expect(cap.enemy(0).statuses.coil).toBe(6);
    const floor = scenario().hand('calm.lullaby').draw(...lots).enemy('shade.spiral', { hp: 200, statuses: { coil: 1 } }).build();
    floor.play('calm.lullaby', 0);
    expect(floor.enemy(0).statuses.coil).toBe(1);
    const deep = scenario().hand('love.kind_word').enemy('shade.spiral', { hp: 104 }).build();
    deep.play('love.kind_word', 0);
    expect(deep.enemy(0).statuses.flare).toBe(2);
  });

  it('Wallflower: Shy while another Shade stands; peek, wilt (Scatter 1), prickle', () => {
    const t = scenario().companions('comp.lantern_moth').draw(...lots).enemy('shade.wallflower', { hp: 40, intent: 'wilt' }).enemy('shade.grumble', { intent: 'huff' }).build();
    t.endTurn();
    expect(t.c.companions).toHaveLength(0);
    expect(t.status('isolated')).toBe(2);
  });

  it('Apathy numb rules: grey_out gives 2 Numb', () => {
    const t = scenario().draw(...lots).enemy('shade.apathy', { hp: 90, intent: 'grey_out' }).build();
    t.endTurn();
    expect(t.status('numb')).toBe(2);
  });
});

describe('pattern offsets (5.1 step 2)', () => {
  it('normal Shades start at a rolled offset; elites, bosses and tutorial fights start at 0', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 12; seed++) seen.add(startScenario({ deck: lots, encounter: 'enc.grumble', seed }).enemy(0).pattern.index);
    expect(seen.size).toBeGreaterThan(1);
    for (let seed = 1; seed <= 6; seed++) {
      expect(startScenario({ deck: lots, encounter: 'enc.kettle', seed, tier: 'elite' }).enemy(0).pattern.index).toBe(0);
      expect(startScenario({ deck: lots, encounter: 'enc.t3', seed, tier: 'tutorial' }).c.enemies.map((e) => e.pattern.index)).toEqual([0, 0]);
    }
  });
});
