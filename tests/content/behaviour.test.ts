// The default pack played through the public Engine API: each Shade passive, override and the turn-1 Keepsakes
// behave as their DESIGN 7 and 9 rule text says (R-2b: "a card with <Light>" = effective Lights).

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index';
import type { Action, CombatState, EnemyState, GameState } from '../../src/engine/index';
import { defaultPack } from '../../src/content';

const engine = createEngine(defaultPack);

function fight(encounter: string, o: { charm?: string; keepsakes?: string[] } = {}): GameState {
  const s = engine.newRun(11, { charm: o.charm ?? 'ks.warm_locket' });
  const extra = (o.keepsakes ?? []).map((id) => ({ id, counter: 0 }));
  return engine.debug.startCombat({ ...s, run: { ...s.run, keepsakes: [...s.run.keepsakes, ...extra] } }, encounter);
}

const combat = (s: GameState): CombatState => {
  if (!s.combat) throw new Error(`no combat (phase ${s.phase.kind})`);
  return s.combat;
};
const shade = (s: GameState, i = 0): EnemyState => combat(s).enemies[i]!;

/** Edits a copy of the combat state (test setup only). */
function edit(s: GameState, fn: (c: CombatState) => void): GameState {
  const c = structuredClone(combat(s));
  fn(c);
  return { ...s, combat: c };
}

/** Plays `id` (put into hand first) with Spirit to spare. target: Shade index, or null for untargeted cards. */
function play(s: GameState, id: string, target: number | null = 0): GameState {
  s = engine.debug.setHand(s, [id]);
  s = edit(s, (c) => {
    c.energy = 10;
  });
  const c = combat(s);
  const uid = c.piles.hand.find((u) => c.cards[u]!.defId === id)!;
  const a: Action = target === null ? { t: 'play', card: uid } : { t: 'play', card: uid, target: shade(s, target).uid };
  return engine.step(s, a).state;
}

const endTurn = (s: GameState): GameState => engine.step(s, { t: 'endTurn' }).state;
const st = (e: EnemyState, id: string): number => e.statuses[id] ?? 0;
/** Puts a cycle Shade at a pattern position (its next action uses that move). */
const atIndex = (s: GameState, i: number, index: number) =>
  edit(s, (c) => {
    c.enemies[i]!.pattern.index = index;
  });

describe('Act 1 passives', () => {
  it('Mope Wallow: +5 after its action unless a Joy hit landed since its previous action', () => {
    let s = edit(fight('enc.a1.mope'), (c) => {
      c.enemies[0]!.hp = 30;
    });
    s = endTurn(s);
    expect(shade(s).hp).toBe(35);
    s = play(s, 'joy.bright_spark');
    const afterHit = shade(s).hp;
    s = endTurn(s);
    expect(shade(s).hp).toBe(afterHit);
    s = endTurn(s);
    expect(shade(s).hp).toBe(afterHit + 5);
  });

  it('Grumble Short Fuse: a card hit without Love this turn gives 1 Flare at the end of your turn (once)', () => {
    let s = atIndex(fight('enc.a1.grumble'), 0, 0);
    s = play(s, 'courage.brave_strike');
    s = play(s, 'courage.brave_strike');
    s = endTurn(s);
    expect(st(shade(s), 'flare')).toBe(1);
    s = play(s, 'love.kind_word'); // OPPOSITE: removes that Flare, and a Love card does not provoke it
    s = endTurn(s);
    expect(st(shade(s), 'flare')).toBe(0);
  });

  it('Skitter brings 1 Doubt and The Looming 2; Doubts Fade when their summoner leaves', () => {
    expect(combat(fight('enc.a1.skitter')).enemies.map((e) => e.defId)).toEqual(['shade.skitter', 'shade.doubt']);
    let s = fight('enc.a1.looming');
    expect(combat(s).enemies.map((e) => e.defId)).toEqual(['shade.looming', 'shade.doubt', 'shade.doubt']);
    s = edit(fight('enc.a1.two_skitters'), (c) => {
      c.enemies[0]!.hp = 1;
    });
    s = play(s, 'courage.brave_strike', 0);
    expect(combat(s).enemies.map((e) => e.defId)).toEqual(['shade.skitter', 'shade.doubt']);
  });

  it('The Looming Grows in the Dark unless a card with Courage was played this turn', () => {
    let s = fight('enc.a1.looming');
    s = endTurn(s);
    expect(st(shade(s), 'flare')).toBe(1);
    s = play(s, 'courage.stand_firm', null);
    s = endTurn(s);
    expect(st(shade(s), 'flare')).toBe(1);
  });

  it('Echo Last One Left: alone at combat start, or once another Shade leaves: Flare +2 and Guard 10', () => {
    const alone = shade(fight('enc.a1.echo'));
    expect([st(alone, 'flare'), alone.guard]).toEqual([2, 10]);
    let s = fight('enc.a1.grumble_echo');
    expect(st(shade(s, 1), 'flare')).toBe(0);
    s = edit(s, (c) => {
      c.enemies[0]!.hp = 1;
    });
    s = play(s, 'love.kind_word', 0);
    expect([st(shade(s), 'flare'), shade(s).guard]).toEqual([2, 10]);
  });

  it('The Kettle boils over at Pressure 6, lifts when a Love card lowers it, and resets to 0 after boiling', () => {
    let s = fight('enc.a1.kettle');
    for (let i = 0; i < 6; i++) s = play(s, 'courage.brave_strike');
    expect([st(shade(s), 'pressure'), shade(s).intent?.moveId]).toEqual([6, 'boil_over']);
    const cycleMove = (() => {
      const t = play(s, 'love.kind_word');
      expect(st(shade(t), 'pressure')).toBe(4);
      expect(shade(t).intent?.moveId).not.toBe('boil_over');
      return shade(t).intent?.moveId;
    })();
    s = endTurn(s);
    expect(st(shade(s), 'pressure')).toBe(0);
    expect(shade(s).intent?.moveId).toBe(cycleMove);
  });

  it('The Mask: OPPOSITE hits turn it at most twice per turn, it turns after acting, Cracked at 75', () => {
    let s = fight('enc.a1.mask');
    s = play(s, 'love.kind_word');
    s = play(s, 'joy.bright_spark');
    s = play(s, 'friendship.reach_out');
    expect(shade(s).faces[shade(s).faceIndex]).toBe('loneliness');
    expect(shade(s).intent?.moveId).toBe('turn_away');
    s = edit(s, (c) => {
      c.enemies[0]!.hp = 80;
    });
    s = play(s, 'friendship.reach_out');
    expect(st(shade(s), 'flare')).toBe(3);
    s = endTurn(s);
    expect(shade(s).faces[shade(s).faceIndex]).toBe('fear');
  });
});

describe('Act 2 passives', () => {
  it('Fret Worry: +1 after each action (+2 more on Fidget), Flurry strikes 1 + Worry times, Calm hits remove 2', () => {
    let s = atIndex(fight('enc.a2.fret'), 0, 1); // fidget first
    s = endTurn(s);
    expect(st(shade(s), 'worry')).toBe(3);
    expect(engine.intents(s)[0]).toMatchObject({ moveId: 'pace' });
    s = endTurn(s);
    expect(engine.intents(s)[0]).toMatchObject({ moveId: 'flurry', strikes: { perStrike: 3, count: 5 } });
    s = play(s, 'calm.lullaby');
    expect(st(shade(s), 'worry')).toBe(2);
  });

  it('Slump Heavy Silence: Guard 8 after its action if you played 2 or fewer cards', () => {
    let s = atIndex(fight('enc.a2.slump'), 0, 0);
    s = endTurn(s);
    expect(shade(s).guard).toBe(8);
    s = play(s, 'neutral.pause', null);
    s = play(s, 'neutral.pause', null);
    s = play(s, 'neutral.pause', null);
    s = atIndex(s, 0, 2); // collapse: no Guard of its own
    s = endTurn(s);
    expect(shade(s).guard).toBe(0);
  });

  it('Old Grudge keeps score of non-OPPOSITE card hits and Rehash strikes 4 + 3 per Tally, then resets', () => {
    let s = atIndex(fight('enc.a2.old_grudge'), 0, 1); // rehash next
    s = play(s, 'courage.brave_strike'); // neutral vs Anger
    s = play(s, 'love.kind_word'); // OPPOSITE: no Tally, turns to Sadness
    s = play(s, 'love.kind_word'); // DISSONANT vs Sadness
    expect(st(shade(s), 'tally')).toBe(2);
    expect(engine.intents(s)[0]).toMatchObject({ moveId: 'rehash' });
    expect(engine.intents(s)[0]!.strikes!.perStrike).toBe(4 + 3 * 2 + st(shade(s), 'flare'));
    s = endTurn(s);
    expect(st(shade(s), 'tally')).toBe(0);
  });

  it('Longing Wallow is soothed by Joy or Friendship hits', () => {
    let s = edit(fight('enc.a2.longing'), (c) => {
      c.enemies[0]!.hp = 40;
    });
    s = endTurn(s);
    expect(shade(s).hp).toBe(45);
    s = play(s, 'friendship.reach_out');
    const hp = shade(s).hp;
    s = endTurn(s);
    expect(shade(s).hp).toBe(hp);
  });

  it('Wallflower is Shy while another Shade stands and is Cornered (Flare +3) when left alone', () => {
    let s = fight('enc.a2.wallflower_grumble');
    const wall = shade(s, 1).uid;
    const targets = engine.legalActions(s).flatMap((a) => (a.t === 'play' && a.target !== undefined ? [a.target] : []));
    expect(targets).not.toContain(wall);
    s = edit(s, (c) => {
      c.enemies[0]!.hp = 1;
    });
    s = play(s, 'love.kind_word', 0);
    expect(st(shade(s), 'flare')).toBe(3);
  });

  it('Dread counts down to The Thing, resets to 3 after it, and a Courage or Hope card pushes it once per turn', () => {
    let s = fight('enc.a2.dread');
    expect(st(shade(s), 'countdown')).toBe(3);
    s = endTurn(s);
    s = endTurn(s);
    expect(st(shade(s), 'countdown')).toBe(1);
    s = endTurn(s);
    expect(shade(s).intent?.moveId).toBe('the_thing');
    const pushed = play(s, 'courage.brave_strike');
    expect(st(shade(pushed), 'countdown')).toBe(1);
    expect(shade(pushed).intent?.moveId).not.toBe('the_thing');
    const twice = play(edit(pushed, (c) => void (c.enemies[0]!.faceIndex = 0)), 'courage.brave_strike');
    expect(st(shade(twice), 'countdown')).toBe(1);
    s = endTurn(s);
    expect(st(shade(s), 'countdown')).toBe(3);
  });

  it('The Knot: Tension +1 per card without Calm or Love, -1 per Love or Calm card hit, Snap at 6 then 0', () => {
    let s = fight('enc.a2.knot');
    s = play(s, 'courage.brave_strike');
    s = play(s, 'neutral.pause', null);
    expect(st(shade(s), 'tension')).toBe(2);
    s = play(s, 'love.kind_word');
    expect(st(shade(s), 'tension')).toBe(1);
    for (let i = 0; i < 5; i++) s = play(s, 'courage.stand_firm', null);
    expect(shade(s).intent?.moveId).toBe('snap');
    s = endTurn(s);
    expect(st(shade(s), 'tension')).toBe(0);
  });

  it('The Spiral: Coil starts 2, +1 after acting, unwinds 2 for Hope+Calm and 1 per face turn, Deepening at 100', () => {
    let s = atIndex(fight('enc.a2.spiral'), 0, 0);
    expect(st(shade(s), 'coil')).toBe(2);
    s = endTurn(s);
    expect(st(shade(s), 'coil')).toBe(3);
    s = play(s, 'blend.wait_it_out'); // Hope hits Despair: OPPOSITE, turns (-1), and the card has both (-2)
    expect(st(shade(s), 'coil')).toBe(1);
    s = edit(s, (c) => {
      c.enemies[0]!.hp = 101;
    });
    s = play(s, 'courage.brave_strike');
    expect(st(shade(s), 'flare')).toBe(2);
  });
});

describe('numb rules and The Deep', () => {
  it('Apathy and The Numbness: one Light MUFFLED, two Lights FELT', () => {
    let s = fight('enc.a2.apathy');
    const hp = shade(s).hp;
    s = play(s, 'love.kind_word');
    expect(shade(s).hp).toBe(hp - 3);
    s = play(s, 'blend.sunbeam');
    expect(shade(s).hp).toBe(hp - 3 - 14);
  });

  it('The Numbness thaws into Phase 2 at half Intensity (90 of 180) and its intent becomes Flatline', () => {
    let s = edit(fight('enc.deep.numbness'), (c) => {
      c.enemies[0]!.hp = 95;
    });
    s = play(s, 'blend.sunbeam');
    expect(shade(s).intent?.moveId).toBe('flatline');
  });
});

describe('intents with several afflictions', () => {
  /** Puts Shade 0 on `moveId` of its cycle (the first phase for The Numbness), current intent included. */
  const onMove = (s: GameState, moveId: string, cycle: string[]) =>
    edit(s, (c) => {
      const e = c.enemies[0]!;
      e.pattern.index = cycle.indexOf(moveId);
      e.intent = { moveId };
    });

  it('Dread Shadow, Longing Remember and The Numbness Nothing Much list every affliction in move order', () => {
    const cases: [string, string, string[], { id: string; stacks: number }[], string][] = [
      ['enc.a2.dread', 'shadow', ['creak', 'shadow'], [{ id: 'trembling', stacks: 2 }, { id: 'hollow', stacks: 1 }], 'Gives you 2 Trembling and 1 Hollow.'],
      ['enc.a2.longing', 'remember', ['reach_back', 'remember', 'ache'], [{ id: 'heavy', stacks: 1 }, { id: 'isolated', stacks: 1 }], 'Gives you 1 Heavy and 1 Isolated.'],
      ['enc.deep.numbness', 'nothing_much', ['static', 'fog', 'nothing_much'], [{ id: 'heavy', stacks: 1 }, { id: 'hollow', stacks: 1 }], 'Gives you 1 Heavy and 1 Hollow.'],
    ];
    for (const [encounter, moveId, cycle, afflicts, sentence] of cases) {
      const s = onMove(fight(encounter), moveId, cycle);
      const [iv] = engine.intents(s);
      expect(iv, encounter).toMatchObject({ moveId, afflicts, afflict: afflicts[0] });
      expect(iv!.text, encounter).toContain(sentence);
    }
  });
});

describe('turn-1 Keepsakes and Charms', () => {
  it('Sun Charm draws 7 on turn 1 only; Morning Tea gives 4 Spirit on turn 1 only; Warm Socks 6 Guard', () => {
    let s = fight('enc.a1.grumble', { charm: 'ks.sun_charm' });
    expect(combat(s).piles.hand).toHaveLength(7);
    s = endTurn(s);
    expect(combat(s).piles.hand).toHaveLength(5);
    s = fight('enc.a1.grumble', { keepsakes: ['ks.morning_tea'] });
    expect(combat(s).energy).toBe(4);
    s = endTurn(s);
    expect(combat(s).energy).toBe(3);
    expect(combat(fight('enc.a1.grumble', { keepsakes: ['ks.warm_socks'] })).player.guard).toBe(6);
  });

  it('Chipped Teacup gives 3 Seething and +1 Spirit; Yellow Umbrella blocks that Seething', () => {
    const cup = combat(fight('enc.a1.grumble', { keepsakes: ['ks.chipped_teacup'] }));
    expect([cup.player.statuses.seething, cup.energy]).toEqual([3, 4]);
    const both = combat(fight('enc.a1.grumble', { keepsakes: ['ks.yellow_umbrella', 'ks.chipped_teacup'] }));
    expect(both.player.statuses.seething ?? 0).toBe(0);
  });

  it('Brave Pebble gives 1 Nerve; Woven Bracelet summons a Lantern Moth', () => {
    expect(combat(fight('enc.a1.grumble', { charm: 'ks.brave_pebble' })).player.statuses.nerve).toBe(1);
    expect(combat(fight('enc.a1.grumble', { charm: 'ks.woven_bracelet' })).companions.map((c) => c.defId)).toEqual([
      'comp.lantern_moth',
    ]);
  });
});

describe('cards whose DSL encodes a rule', () => {
  it('Spark counts cards played earlier this turn; Grand Finale hits once per earlier card', () => {
    let s = fight('enc.a1.grumble');
    s = play(s, 'courage.brave_strike');
    s = play(s, 'courage.brave_strike');
    const u = engine.debug.setHand(s, ['joy.giggle']);
    const giggle = combat(u).piles.hand.find((x) => combat(u).cards[x]!.defId === 'joy.giggle')!;
    expect(engine.cardText(u, giggle)).toBe('Ease 5. Spark +1.');
    const hp = shade(s).hp;
    s = play(s, 'joy.grand_finale', null);
    expect(shade(s).hp).toBe(hp - 8);
  });

  it('Wish on a Star: a Harmonized play makes the 12 Promise, carrying both Lights', () => {
    let s = fight('enc.a2.slump', { keepsakes: ['ks.compass'] });
    s = play(s, 'courage.brave_strike');
    s = play(s, 'hope.wish_on_a_star');
    expect(combat(s).promises).toMatchObject([{ effects: [{ op: 'hit', amount: 12 }], lights: ['hope', 'courage'] }]);
  });

  it('Growing Light grows 3 per earlier play this combat', () => {
    let s = edit(fight('enc.a1.grumble'), (c) => {
      c.enemies[0]!.hp = 99;
      c.enemies[0]!.maxHp = 99;
    });
    s = play(s, 'hope.growing_light');
    expect(shade(s).hp).toBe(93);
    s = play(s, 'hope.growing_light');
    expect(shade(s).hp).toBe(84);
  });

  it('Bold Leap reads the intent before its hit; Push It Down pays 2 Spirit on a Suppress', () => {
    let s = atIndex(fight('enc.a1.grumble'), 0, 0);
    s = play(s, 'courage.bold_leap');
    expect(combat(s).player.guard).toBe(8);
    s = edit(fight('enc.a1.two_grumbles'), (c) => {
      c.enemies[0]!.hp = 5;
    });
    s = play(s, 'neutral.push_it_down');
    expect(combat(s).energy).toBe(11);
  });

  it('Forgive counts Flare before the hit and then clears it', () => {
    let s = edit(fight('enc.a1.grumble'), (c) => {
      c.enemies[0]!.statuses.flare = 2;
      c.enemies[0]!.hp = 60;
      c.enemies[0]!.maxHp = 60;
    });
    s = play(s, 'love.forgive');
    expect(shade(s).hp).toBe(60 - (8 + 2 * 4) * 2);
    expect(st(shade(s), 'flare')).toBe(0);
  });

  it('Daybreak costs 1 less per Promise made; Count to Ten 1 less per turn Lingered; Serenity never keeps Buried', () => {
    let s = fight('enc.a2.fret');
    s = play(s, 'hope.plant_a_seed', null);
    s = play(s, 'hope.silver_lining', null);
    s = engine.debug.setHand(s, ['hope.daybreak']);
    expect(engine.handHints(s).map((h) => h.cost)).toEqual([1]);
    s = engine.debug.setHand(fight('enc.a1.grumble'), ['calm.count_to_ten']); // no Restless here
    s = endTurn(s);
    const ctt = engine.handHints(s).find((h) => combat(s).cards[h.uid]!.defId === 'calm.count_to_ten');
    expect(ctt?.cost).toBe(1);
    s = play(fight('enc.a2.fret'), 'calm.serenity', null);
    s = engine.debug.setHand(s, ['love.kind_word', 'buried.anger']);
    s = endTurn(s);
    const held = combat(s).piles.hand.map((u) => combat(s).cards[u]!.defId);
    expect(held).toContain('love.kind_word');
    expect(held).not.toContain('buried.anger');
  });
});
