import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/engine/combat/index', () => import('./fakeCombat'));

import { IllegalActionError, type GameState, type MapNode } from '../../../src/engine/types';
import { fake } from './fakeCombat';
import { count, deepFreeze, engine, freshRun, has, step } from './helpers';

beforeEach(() => fake.reset());

/** Turns the first reachable node into `kind` (with an encounter for combat kinds) and returns its id. */
function force(s: GameState, kind: MapNode['kind'], encounter?: string, hps?: number[]): number {
  const moves = engine.legalActions(s).filter((a) => a.t === 'move');
  const id = (moves[0] as { node: number }).node;
  const node = s.run.map.nodes[id]!;
  node.kind = kind;
  if (encounter) node.encounter = { id: encounter, hps: hps ?? [30] };
  else delete node.encounter;
  return id;
}

const winFight = (s: GameState): GameState => step(s, { t: 'endTurn' });

describe('new run (3.2)', () => {
  it('starts in Charm select with the starter deck, 70 Heart and 50 Glimmers', () => {
    const s = engine.newRun(5);
    expect(s.phase).toEqual({ kind: 'charmSelect', options: ['ks.warm_locket', 'ks.sun_charm', 'ks.woven_bracelet', 'ks.brave_pebble'] });
    expect(s.run.deck).toHaveLength(11);
    expect(new Set(s.run.deck.map((c) => c.uid)).size).toBe(11);
    expect([s.run.heart, s.run.maxHeart, s.run.glimmers, s.run.act, s.run.floor]).toEqual([70, 70, 50, 1, 0]);
    expect(s.run.map.act).toBe(1);
    expect(engine.legalActions(s)).toEqual([0, 1, 2, 3].map((i) => ({ t: 'pickCharm', i })));
    expect(engine.checkInvariants(s)).toEqual([]);
  });

  it('a Charm adds its card and opens the map', () => {
    const s = step(engine.newRun(5), { t: 'pickCharm', i: 1 });
    expect(s.run.keepsakes).toEqual([{ id: 'ks.sun_charm', counter: 0 }]);
    expect(s.run.deck).toHaveLength(12);
    expect(count(s, 'joy.bright_spark')).toBe(3);
    expect(s.phase).toEqual({ kind: 'map' });
    expect(engine.legalActions(s)).toEqual([0, 1, 2].map((node) => ({ t: 'move', node })));
  });

  it('opts.charm skips Charm select', () => {
    const s = freshRun(5);
    expect(s.phase.kind).toBe('map');
    expect(s.run.keepsakes.map((k) => k.id)).toEqual(['ks.warm_locket']);
    expect(s.run.deck).toHaveLength(12);
  });

  it('the tutorial run starts inside the combat of row 1 middle node (enc.t1) with Warm Locket', () => {
    const s = engine.newRun(8, { tutorial: true });
    expect(s.run.tutorial).toBe(true);
    expect(s.phase).toEqual({ kind: 'combat', nodeId: 1 });
    expect(s.combat?.encounter).toBe('enc.t1');
    expect(fake.started[0]).toMatchObject({ encounter: 'enc.t1', nodeId: 1, tier: 'tutorial', hps: [18] });
    expect(s.run.keepsakes.map((k) => k.id)).toEqual(['ks.warm_locket']);
    expect([s.run.floor, s.run.map.current]).toEqual([1, 1]);
    const after = winFight(s);
    expect(after.phase.kind).toBe('reward');
    const map = step(after, { t: 'continue' });
    expect(engine.legalActions(map).map((a) => (a as { node: number }).node)).toEqual(
      [...s.run.map.nodes[1]!.next].sort((a, b) => a - b),
    );
  });
});

describe('fights and rewards (12)', () => {
  it('moving onto a fight starts its pre-rolled encounter; winning pays Glimmers and offers 3 cards', () => {
    const s0 = freshRun(12);
    const node = s0.run.map.nodes[0]!;
    const s1 = step(s0, { t: 'move', node: 0 });
    expect(s1.phase).toEqual({ kind: 'combat', nodeId: 0 });
    expect(fake.started[0]).toEqual({ encounter: node.encounter!.id, hps: node.encounter!.hps, nodeId: 0, nodeSeed: node.seed, tier: 'normal' });
    expect(engine.legalActions(s1)).toEqual([{ t: 'endTurn' }]);
    const r = engine.step(s1, { t: 'endTurn' });
    const s2 = r.state;
    expect(s2.combat).toBeNull();
    expect(s2.phase.kind).toBe('reward');
    if (s2.phase.kind !== 'reward') return;
    const o = s2.phase.offer;
    expect(o.source).toBe('fight');
    expect(o.glimmers).toBe(10);
    expect(s2.run.glimmers).toBe(60);
    expect(o.cards).toHaveLength(4); // the fake Resolves everything: Full Bloom adds a 4th option
    expect(o.fullBloom).toBe(true);
    expect(o.compass).toBe(false);
    expect(new Set(o.cards).size).toBe(o.cards.length);
    expect(s2.run.combatsWon).toBe(1);
    expect(s2.run.stats.combats).toBe(1);
    expect(r.events).toContainEqual({ e: 'combatEnd', outcome: 'won' });
    expect(r.events).toContainEqual({ e: 'phase', kind: 'reward' });
    expect(r.events).toContainEqual({ e: 'run', what: 'glimmers', after: 60 });
    expect(engine.legalActions(s2)).toEqual([...o.cards.map((_, i) => ({ t: 'takeCard', i })), { t: 'skip' }, { t: 'continue' }]);

    const s3 = step(s2, { t: 'takeCard', i: 2 });
    expect(s3.run.deck).toHaveLength(13);
    expect(s3.run.deck[12]!.defId).toBe(o.cards[2]);
    expect(engine.legalActions(s3)).toEqual([{ t: 'continue' }]);
    const s4 = step(s3, { t: 'continue' });
    expect(s4.phase).toEqual({ kind: 'map' });
    expect(engine.legalActions(s4).map((a) => (a as { node: number }).node)).toEqual([...s4.run.map.nodes[0]!.next].sort());
  });

  it('the 2nd combat win grants The Compass and slot 3 becomes an Act 1 Blend', () => {
    fake.result = () => ({ allResolved: false });
    let s = freshRun(3);
    s = winFight(step(s, { t: 'move', node: 0 }));
    s = step(s, { t: 'continue' });
    const next = (engine.legalActions(s)[0] as { node: number }).node;
    s = winFight(step(s, { t: 'move', node: next }));
    expect(s.phase.kind).toBe('reward');
    if (s.phase.kind !== 'reward') return;
    expect(s.phase.offer.compass).toBe(true);
    expect(s.run.keepsakes.map((k) => k.id)).toContain('ks.compass');
    expect(s.phase.offer.cards).toHaveLength(3);
    expect(['blend.sunbeam', 'blend.tag_youre_it', 'blend.shoulder_to_shoulder']).toContain(s.phase.offer.cards[2]);
  });

  it('elite: a pool Keepsake to take and a Blend in slot 3', () => {
    fake.result = () => ({ allResolved: false });
    const s0 = freshRun(4);
    const id = force(s0, 'elite', 'enc.a1.kettle', [92]);
    const s1 = step(s0, { t: 'move', node: id });
    expect(fake.started[0]!.tier).toBe('elite');
    const s2 = winFight(s1);
    if (s2.phase.kind !== 'reward') throw new Error('expected reward');
    const o = s2.phase.offer;
    expect(o.source).toBe('elite');
    expect(o.glimmers).toBe(25);
    expect(o.keepsakes).toHaveLength(1);
    expect(o.keepsakeChoice).toBe(false);
    expect(engine.pack.cards[o.cards[2]!]!.rarity).toBe('blend');
    expect(engine.legalActions(s2)[0]).toEqual({ t: 'takeKeepsake', i: 0 });
    const s3 = step(s2, { t: 'takeKeepsake', i: 0 });
    expect(s3.run.keepsakes.map((k) => k.id)).toContain(o.keepsakes[0]);
    expect(has(engine.legalActions(s3), { t: 'takeKeepsake', i: 0 })).toBe(false);
  });

  it('a lost combat is a defeat with its cause; nothing is legal afterwards', () => {
    fake.outcome = 'lost';
    const s = winFight(step(freshRun(2), { t: 'move', node: 1 }));
    expect(s.phase).toEqual({ kind: 'defeat', cause: 'heart' });
    expect(s.run.heart).toBe(0);
    expect(engine.legalActions(s)).toEqual([]);
    fake.lossCause = 'turnLimit';
    expect(winFight(step(freshRun(2), { t: 'move', node: 1 })).phase).toEqual({ kind: 'defeat', cause: 'turnLimit' });
  });

  it('a chest gives one pool Keepsake', () => {
    const s0 = freshRun(6);
    const id = force(s0, 'chest');
    const s1 = step(s0, { t: 'move', node: id });
    if (s1.phase.kind !== 'reward') throw new Error('expected reward');
    expect(s1.phase.offer.source).toBe('chest');
    expect(s1.phase.offer.keepsakes).toHaveLength(1);
    expect(['common', 'uncommon', 'rare']).toContain(engine.pack.keepsakes[s1.phase.offer.keepsakes[0]!]!.rarity);
    expect(engine.legalActions(s1)).toEqual([{ t: 'takeKeepsake', i: 0 }, { t: 'continue' }]);
  });
});

describe('act transitions (15.1) and endings (15.3)', () => {
  function bossWin(seed: number, act: 1 | 2, setup?: (s: GameState) => void): GameState {
    const s0 = freshRun(seed);
    if (act === 2) {
      s0.run.act = 2;
      s0.run.map.act = 2;
    }
    setup?.(s0);
    const enc = act === 1 ? 'enc.a1.mask' : 'enc.a2.spiral';
    const id = force(s0, 'boss', enc, [act === 1 ? 150 : 200]);
    const s1 = step(s0, { t: 'move', node: id });
    expect(fake.started.at(-1)!.tier).toBe('boss');
    return winFight(s1);
  }

  it('Act 1 boss: 3 rare cards, choose 1 of 3 boss Keepsakes, Mend to full, the wheel closes, Act 2', () => {
    fake.result = (s) => ({ heartAfter: s.run.heart - 30 });
    const s1 = bossWin(21, 1);
    if (s1.phase.kind !== 'reward') throw new Error('expected reward');
    const o = s1.phase.offer;
    expect(o.source).toBe('boss');
    expect(o.then).toBe('wheelCloses');
    expect(o.glimmers).toBe(60);
    expect(o.cards).toHaveLength(3);
    for (const id of o.cards) expect(engine.pack.cards[id]!.rarity).toBe('rare');
    // Full Bloom (12.2) is a card-reward rule of normal and elite fights: the fake Resolved everything here.
    expect(o.fullBloom).toBe(false);
    expect(o.keepsakes).toHaveLength(3);
    expect(o.keepsakeChoice).toBe(true);
    for (const id of o.keepsakes) expect(engine.pack.keepsakes[id]!.rarity).toBe('boss');
    expect(s1.run.heart).toBe(40);
    const legal = engine.legalActions(s1);
    expect(legal.slice(0, 3)).toEqual([0, 1, 2].map((i) => ({ t: 'takeKeepsake', i })));
    const pick = o.keepsakes.findIndex((id) => id !== 'ks.spiral_shell');
    const s2 = step(s1, { t: 'takeKeepsake', i: pick });
    expect(s2.run.keepsakes.map((k) => k.id)).toContain(o.keepsakes[pick]);
    expect(s2.run.keepsakes.filter((k) => o.keepsakes.includes(k.id))).toHaveLength(1);
    const s3 = step(s2, { t: 'continue' });
    expect(s3.run.heart).toBe(70);
    if (s3.phase.kind !== 'wheelCloses') throw new Error('expected wheelCloses');
    const opts = s3.phase.options;
    expect(opts).toHaveLength(3);
    expect(engine.pack.cards[opts[0]!]).toMatchObject({ lights: ['hope'], rarity: 'common' });
    expect(engine.pack.cards[opts[1]!]).toMatchObject({ lights: ['calm'], rarity: 'common' });
    expect(engine.pack.cards[opts[2]!]!.rarity).toBe('uncommon');
    expect(engine.legalActions(s3)).toEqual([0, 1, 2].map((i) => ({ t: 'takeCard', i })).concat([{ t: 'skip' } as never]));
    const s4 = step(s3, { t: 'takeCard', i: 0 });
    expect(s4.run.act).toBe(2);
    expect(s4.run.map.act).toBe(2);
    expect(s4.run.map.current).toBeNull();
    expect(s4.phase).toEqual({ kind: 'map' });
    expect(s4.run.deck.at(-1)!.defId).toBe(opts[0]);
  });

  it('Spiral Shell: between acts, Mend only 50% of missing Heart (even when taken at that boss)', () => {
    fake.result = (s) => ({ heartAfter: s.run.heart - 31 });
    const s1 = bossWin(22, 1, (s) => {
      // Make sure the Shell is on offer: own every other boss Keepsake but two.
      s.run.keepsakes.push({ id: 'ks.lead_box', counter: 0 }, { id: 'ks.mirror_shard', counter: 0 }, { id: 'ks.skeleton_key', counter: 0 });
    });
    if (s1.phase.kind !== 'reward') throw new Error('expected reward');
    const i = s1.phase.offer.keepsakes.indexOf('ks.spiral_shell');
    expect(i).toBeGreaterThanOrEqual(0);
    const s2 = step(step(s1, { t: 'takeKeepsake', i }), { t: 'continue' });
    expect(s2.run.heart).toBe(39 + Math.floor(31 / 2));
  });

  it('Act 2 boss leads to The Deep: Sanctuary with 3 Blends, Haven, then The Numbness', () => {
    const s1 = bossWin(23, 2);
    if (s1.phase.kind !== 'reward') throw new Error('expected reward');
    expect(s1.phase.offer.then).toBe('deep');
    // 15.1: "The Deep" title card, then straight into the Sanctuary (no map step with a single node).
    let s = step(s1, { t: 'continue' });
    expect(s.run.act).toBe(3);
    expect(s.run.map.nodes.map((n) => n.kind)).toEqual(['sanctuary', 'haven', 'boss']);
    expect(s.run.map.current).toBe(0);
    expect(s.run.map.visited).toEqual([0]);
    if (s.phase.kind !== 'shop') throw new Error('expected shop');
    expect(s.phase.stock.items.filter((i) => engine.pack.cards[i.id]?.rarity === 'blend')).toHaveLength(3);
    s = step(step(s, { t: 'leave' }), { t: 'move', node: 1 });
    expect(s.phase.kind).toBe('haven');
    s = step(s, { t: 'rest' });
    s = step(s, { t: 'move', node: 2 });
    expect(fake.started.at(-1)).toMatchObject({ encounter: 'enc.deep.numbness', tier: 'final', hps: [180] });
    return s;
  });

  for (const [outcome, ending] of [
    ['resolve', 'resolved'],
    ['deepResolve', 'resolved'],
    ['suppress', 'suppressed'],
  ] as const) {
    it(`The Numbness ${outcome} ends the run '${ending}' after the outcome strip`, () => {
      fake.result = (s) => ({
        glimmers: 0,
        gone: [
          { uid: 1, defId: 'shade.surfaced_anger', outcome: 'resolve', face: 'anger' },
          { uid: 10_000, defId: 'shade.numbness', outcome, face: null },
        ],
        allResolved: outcome !== 'suppress',
        heartAfter: s.run.heart,
      });
      const s0 = freshRun(24);
      s0.run.act = 3;
      s0.run.map = { act: 3, nodes: [{ id: 0, row: 1, col: 0, next: [], kind: 'boss', seed: 7, encounter: { id: 'enc.deep.numbness', hps: [180] } }], current: null, visited: [] };
      const s1 = winFight(step(s0, { t: 'move', node: 0 }));
      if (s1.phase.kind !== 'reward') throw new Error('expected reward');
      expect(s1.phase.offer.cards).toEqual([]);
      expect(s1.phase.offer.then).toBe('victory');
      expect(engine.legalActions(s1)).toEqual([{ t: 'continue' }]);
      const s2 = step(s1, { t: 'continue' });
      expect(s2.phase).toEqual({ kind: 'victory', ending });
      expect(engine.legalActions(s2)).toEqual([]);
    });
  }
});

describe('Memory combat (RunEffect combat, minor-11)', () => {
  function atWell(seed: number): GameState {
    const s0 = freshRun(seed);
    const id = force(s0, 'memory');
    const s1 = step(s0, { t: 'move', node: id });
    if (s1.phase.kind !== 'event') throw new Error('expected event');
    s1.phase.eventId = 'mem.wishing_well';
    return s1;
  }

  it('Resolving the Echo: a win, normal-fight Glimmers, no card reward, a random uncommon Keepsake', () => {
    const s1 = step(atWell(30), { t: 'option', i: 2 });
    expect(s1.phase.kind).toBe('combat');
    expect(s1.eventCombat).not.toBeNull();
    expect(fake.started[0]).toMatchObject({ encounter: 'enc.mem.echo', tier: 'event' });
    const s2 = winFight(s1);
    expect(s2.eventCombat).toBeNull();
    if (s2.phase.kind !== 'reward') throw new Error('expected reward');
    expect(s2.phase.offer).toMatchObject({ source: 'event', cards: [], glimmers: 10, then: 'map' });
    expect(s2.run.combatsWon).toBe(1);
    const gained = s2.run.keepsakes.filter((k) => k.id !== 'ks.warm_locket');
    expect(gained).toHaveLength(1);
    expect(engine.pack.keepsakes[gained[0]!.id]!.rarity).toBe('uncommon');
    expect(step(s2, { t: 'continue' }).phase).toEqual({ kind: 'map' });
  });

  it('Suppressing it gives 30 Glimmers instead', () => {
    fake.result = () => ({ allResolved: false, gone: [{ uid: 1, defId: 'shade.echo', outcome: 'suppress', face: 'loneliness' }] });
    const s2 = winFight(step(atWell(31), { t: 'option', i: 2 }));
    expect(s2.run.glimmers).toBe(50 + 10 + 30);
    expect(s2.run.keepsakes).toHaveLength(1);
  });
});

describe('reducer contract (20.1, 20.6)', () => {
  it('never mutates its input (run phases and a combat finish)', () => {
    let s = deepFreeze(freshRun(40));
    for (let n = 0; n < 12; n++) {
      const legal = engine.legalActions(s);
      if (legal.length === 0) break;
      s = deepFreeze(engine.step(s, legal[0]!).state);
    }
    expect(s.run.floor).toBeGreaterThan(1);
  });

  it('illegal actions throw IllegalActionError', () => {
    const s = freshRun(41);
    expect(() => engine.step(s, { t: 'move', node: 30 })).toThrow(IllegalActionError);
    expect(() => engine.step(s, { t: 'rest' })).toThrow(IllegalActionError);
    expect(() => engine.step(s, { t: 'endTurn' })).toThrow(IllegalActionError);
  });

  it('same seed and actions give the same hash; a different seed does not', () => {
    const play = (seed: number): string[] => {
      let s = freshRun(seed);
      const hashes = [engine.hash(s)];
      for (let n = 0; n < 25; n++) {
        const legal = engine.legalActions(s);
        if (legal.length === 0) break;
        s = engine.step(s, legal[n % legal.length]!).state;
        hashes.push(engine.hash(s));
      }
      return hashes;
    };
    expect(play(77)).toEqual(play(77));
    expect(play(78)[0]).not.toBe(play(77)[0]);
  });

  it('views are empty or null outside combat', () => {
    const s = freshRun(42);
    expect(engine.preview(s, { t: 'endTurn' })).toBeNull();
    expect(engine.intents(s)).toEqual([]);
    expect(engine.handHints(s)).toEqual([]);
    expect(engine.cardText(s, s.run.deck[0]!.uid)).toBe('love.kind_word');
    expect(engine.describeCard('joy.giggle', true)).toBe('joy.giggle+');
  });

  it('debug.startCombat jumps into an encounter from any phase; the result returns to the map', () => {
    const s = engine.debug.startCombat(freshRun(43), 'enc.a1.kettle');
    expect(s.phase).toEqual({ kind: 'combat', nodeId: null });
    expect(fake.started[0]).toMatchObject({ encounter: 'enc.a1.kettle', tier: 'elite', nodeId: null });
    const r = winFight(s);
    expect(r.phase.kind).toBe('reward');
    expect(step(r, { t: 'continue' }).phase).toEqual({ kind: 'map' });
  });

  it('debug.setHand pulls cards into the hand and creates missing ones', () => {
    const s = engine.debug.startCombat(freshRun(44), 'enc.a1.grumble');
    const t = engine.debug.setHand(s, ['love.kind_word', 'calm.serenity']);
    const hand = t.combat!.piles.hand.map((u) => t.combat!.cards[u]!.defId);
    expect(hand).toEqual(['love.kind_word', 'calm.serenity']);
    expect(engine.checkInvariants(t)).toEqual([]);
    expect(s.combat!.piles.hand).toEqual([]);
  });
});
