// 5.7 enemy phase (M13 snapshot and override rules), 5.7.1 projected intents (M2), Festering, limits.
import { describe, expect, it } from 'vitest';
import { scenario } from '../../helpers/scenario';

const five = ['courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm', 'courage.stand_firm'];
const lots = [...five, ...five, ...five, ...five];

describe('5.7 order and snapshot', () => {
  it("Shades act left to right; Skitter's hide Doubt is inserted to its right and acts from the next phase", () => {
    const t = scenario().draw(...lots).enemy('shade.skitter', { intent: 'hide' }).enemy('shade.grumble', { intent: 'snap' }).build();
    t.endTurn();
    expect(t.c.enemies.map((e) => e.defId)).toEqual(['shade.skitter', 'shade.doubt', 'shade.grumble']);
    expect(t.eventsOf('enemyMove').map((e) => e.moveId)).toEqual(['hide', 'snap']);
    expect(t.enemy(1).intent!.moveId).toBe('nag');
    t.endTurn();
    expect(t.eventsOf('enemyMove').map((e) => e.moveId)).toEqual(['lunge', 'nag', 'stomp']);
  });

  it('a Shade removes its own Guard when it starts its action', () => {
    const t = scenario().draw(...lots).enemy('shade.grumble', { guard: 9, intent: 'snap' }).build();
    t.endTurn();
    expect(t.enemy(0).guard).toBe(0);
  });

  it('Hush: its next attack move deals X less per strike, then Hush is removed (not by a non-attack move)', () => {
    const t = scenario().draw(...lots).enemy('shade.mope', { intent: 'curl_up', statuses: { hush: 2 } }).build();
    t.endTurn();
    expect(t.enemy(0).statuses.hush).toBe(2);
    t.endTurn(); // sigh: Strike 6 - 2
    expect(t.eventsOf('strike')[0]!.amount).toBe(4);
    expect(t.enemy(0).statuses.hush ?? 0).toBe(0);
  });

  it('Festering: from turn 12 every Shade gains 1 Flare at the start of each enemy phase', () => {
    const t = scenario().turn(12).draw(...lots).enemy('shade.mope', { intent: 'curl_up' }).enemy('shade.grumble', { intent: 'huff' }).build();
    t.endTurn();
    expect(t.eventsOf('festering')).toHaveLength(1);
    expect(t.enemy(0).statuses.flare).toBe(1);
    expect(t.enemy(1).statuses.flare).toBe(2);
  });

  it('turn limit: the combat is lost when turn 40 ends', () => {
    const t = scenario().turn(40).draw(...lots).enemy('shade.mope', { intent: 'curl_up' }).build();
    t.endTurn();
    expect(t.c.outcome).toBe('lost');
    expect(t.c.lossCause).toBe('turnLimit');
  });

  it('max 4 Shades: summons fail silently when full (the move\'s other effects still happen)', () => {
    const t = scenario().draw(...lots).enemy('shade.skitter', { intent: 'hide' }).enemy('shade.grumble').enemy('shade.grumble').enemy('shade.grumble').build();
    t.endTurn();
    expect(t.c.enemies).toHaveLength(4);
    expect(t.eventsOf('guard').some((g) => g.to.side === 'enemy' && g.amount === 8)).toBe(true);
  });

  it("a summoner's cap counts its live summons", () => {
    const t = scenario().draw(...lots).enemy('shade.pest').build();
    for (let i = 0; i < 4; i++) t.endTurn();
    expect(t.c.enemies).toHaveLength(4);
  });
});

describe('overrides (M13)', () => {
  it('Kettle: holds only while Pressure is 6, does not advance the cycle index, lifts back to the cycle move', () => {
    const t = scenario().hand('love.kind_word').draw(...lots).enemy('shade.kettle', { hp: 90, statuses: { pressure: 6 }, intent: 'boil_over', patternIndex: 1 }).build();
    expect(t.intents()[0]!.overriddenBy).toBe('pressure');
    t.play('love.kind_word', 0); // Love lets off 2: override lifts, intent is the cycle move at the current index
    expect(t.enemy(0).statuses.pressure).toBe(4);
    expect(t.enemy(0).intent!.moveId).toBe('whistle');
    const u = scenario().draw(...lots).enemy('shade.kettle', { hp: 90, statuses: { pressure: 6 }, intent: 'boil_over', patternIndex: 1 }).build();
    u.endTurn();
    expect(u.eventsOf('enemyMove')[0]!.moveId).toBe('boil_over');
    expect(u.enemy(0).statuses.pressure ?? 0).toBe(0);
    expect(u.enemy(0).pattern.index).toBe(1);
    expect(u.enemy(0).intent!.moveId).toBe('whistle');
    expect(u.status('seething')).toBe(3);
  });

  it('Dread: while Countdown is 0 the intent is the_thing; after it, Countdown 3; a Courage or Hope hit pushes +1 once per turn', () => {
    const t = scenario().hand('courage.brave_strike', 'courage.brave_strike').draw(...lots).enemy('shade.dread', { hp: 60, statuses: { countdown: 1 } }).build();
    t.play(t.uid('courage.brave_strike', 0), 0);
    t.play('courage.brave_strike', 0);
    expect(t.enemy(0).statuses.countdown).toBe(2);
    const u = scenario().draw(...lots).enemy('shade.dread', { hp: 60, statuses: { countdown: 1 } }).build();
    u.endTurn(); // creak: countdown 0 -> override
    expect(u.enemy(0).intent!.moveId).toBe('the_thing');
    u.endTurn();
    expect(u.eventsOf('enemyMove')[0]!.moveId).toBe('the_thing');
    expect(u.enemy(0).statuses.countdown).toBe(3);
    expect(u.enemy(0).intent!.moveId).toBe('shadow');
  });

  it('The Knot: +1 Tension per card without Calm or Love, -1 per Calm/Love card hit; at 6 it snaps', () => {
    const t = scenario().hand('courage.stand_firm', 'love.kind_word').draw(...lots).enemy('shade.knot', { hp: 110, statuses: { tension: 5 } }).build();
    t.play('courage.stand_firm');
    expect(t.enemy(0).statuses.tension).toBe(6);
    expect(t.enemy(0).intent!.moveId).toBe('snap');
    t.play('love.kind_word', 0);
    expect(t.enemy(0).statuses.tension).toBe(5);
    expect(t.enemy(0).intent!.moveId).toBe('twist');
  });
});

describe('5.7.1 projected intents (M2)', () => {
  it('a Lantern Moth turning The Mask shows startle with the "after end of turn" tag and a cause', () => {
    const t = scenario().companions('comp.lantern_moth').draw(...lots).enemy('shade.mask', { hp: 150, faceIndex: 2 }).build();
    expect(t.enemy(0).intent!.moveId).toBe('turn_away');
    const [view] = t.intents();
    expect(view).toMatchObject({ moveId: 'startle', projected: true, projectedReason: 'Lantern Moth will turn it to Fear.' });
    expect(view!.strikes).toEqual({ perStrike: 8, count: 1 });
  });

  it('Short Fuse adding Flare at end of turn shows the higher number', () => {
    const t = scenario().hand('courage.brave_strike').draw(...lots).enemy('shade.grumble', { hp: 40, intent: 'snap' }).build();
    t.play('courage.brave_strike', 0);
    const [view] = t.intents();
    expect(view!.projected).toBe(true);
    expect(view!.strikes!.perStrike).toBe(8);
    expect(view!.projectedReason).toContain('Short Fuse');
  });

  it('card conditions read the current intent, not the projection (4.18)', () => {
    const t = scenario().companions('comp.lantern_moth').hand('courage.face_the_storm').draw(...lots).enemy('shade.mask', { hp: 150, faceIndex: 2 }).build();
    expect(t.intents()[0]!.moveId).toBe('startle');
    const p = t.preview('courage.face_the_storm', 0)!;
    expect(p.targets[0]!.hits[0]!.base).toBe(7); // turn_away is not an attack
  });

  it('unchanged intents are not flagged', () => {
    const t = scenario().draw(...lots).enemy('shade.mope', { intent: 'sigh' }).build();
    expect(t.intents()[0]).toMatchObject({ moveId: 'sigh', projected: false, projectedReason: null, text: 'Strikes for 6. Gives you 1 Heavy.' });
  });
});
