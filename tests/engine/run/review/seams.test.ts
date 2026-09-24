// Review: the combat -> run handoff with the REAL combat module (the run suite mocks it with fakeCombat).
// Fights are shortened by lowering Intensity in the state and setting the hand with the debug API.

import { describe, expect, it } from 'vitest';

import { createEngine } from '../../../../src/engine/index';
import type { Action, CardInstance, GameState, Shade } from '../../../../src/engine/types';
import { generateDeepMap } from '../../../../src/engine/run/map';
import { resolveRules } from '../../../../src/engine/rules';
import { BURIED, fixturePack } from '../fixturePack';

const engine = createEngine(fixturePack);

const freshRun = (seed = 1): GameState => engine.newRun(seed, { charm: 'ks.warm_locket' });

function giveBuried(s: GameState, shade: Shade, weight: 1 | 2 | 3, peak: 1 | 2 | 3 = weight): CardInstance {
  const card: CardInstance = { uid: s.nextUid++, defId: BURIED[shade].id, upgraded: false, weight, peakWeight: peak };
  s.run.deck.push(card);
  return card;
}

function step(s: GameState, a: Action): GameState {
  const next = engine.step(s, a).state;
  expect(engine.checkInvariants(next), `after ${JSON.stringify(a)}`).toEqual([]);
  return next;
}

/** Copy of s with the combat enemy of this def set to `hp` Intensity (and no Guard). */
function withHp(s: GameState, defId: string, hp: number): GameState {
  const t = engine.deserialize(engine.serialize(s))!;
  const e = t.combat!.enemies.find((x) => x.defId === defId)!;
  e.hp = hp;
  e.guard = 0;
  return t;
}

const enemyUid = (s: GameState, defId: string): number => s.combat!.enemies.find((e) => e.defId === defId)!.uid;
const handUid = (s: GameState, defId: string): number =>
  s.combat!.piles.hand.find((u) => s.combat!.cards[u]!.defId === defId)!;
const play = (s: GameState, defId: string, targetDef: string): GameState =>
  step(s, { t: 'play', card: handUid(s, defId), target: enemyUid(s, targetDef) });

describe('combat -> run seams (real combat)', () => {
  it('4.10: Suppressing a normal Shade adds Buried <face> at Weight 1 to the run deck when the fight is won', () => {
    let s = engine.debug.startCombat(freshRun(2), 'enc.a1.grumble');
    s = engine.debug.setHand(withHp(s, 'shade.grumble', 3), ['neutral.push_it_down']);
    s = play(s, 'neutral.push_it_down', 'shade.grumble');
    expect(s.phase.kind).toBe('reward');
    const buried = s.run.deck.filter((c) => c.defId === 'buried.anger');
    expect(buried).toEqual([expect.objectContaining({ weight: 1, peakWeight: 1 })]);
    if (s.phase.kind !== 'reward') return;
    expect(s.phase.offer.outcomes.map((g) => g.outcome)).toEqual(['suppress']);
    expect(s.phase.offer.fullBloom).toBe(false);
    expect(s.phase.offer.cards).toHaveLength(3);
  });

  it('4.16 / M3: Resolving a Surfaced Shade turns its Buried card into the Insight in the run deck (insightsMade updated)', () => {
    const s0 = freshRun(3);
    const b = giveBuried(s0, 'anger', 1);
    let s = engine.debug.startCombat(s0, 'enc.a2.apathy');
    expect(s.combat!.enemies.map((e) => e.defId)).toEqual(['shade.surfaced_anger', 'shade.apathy']);
    s = engine.debug.setHand(s, ['love.kind_word', 'love.kind_word']);
    s = play(s, 'love.kind_word', 'shade.surfaced_anger');
    expect(s.combat!.enemies.map((e) => e.defId)).toEqual(['shade.apathy']);
    s = play(withHp(s, 'shade.apathy', 1), 'love.kind_word', 'shade.apathy');
    expect(s.phase.kind).toBe('reward');
    expect(s.run.deck.find((c) => c.uid === b.uid)).toEqual({ uid: b.uid, defId: 'insight.passion', upgraded: false });
    expect(s.run.insightsMade).toEqual(['insight.passion']);
    expect(s.run.deck.some((c) => c.defId === 'buried.anger')).toBe(false);
  });

  it('4.16 / M4: Suppressing a Surfaced Shade returns its card unchanged and never Buries', () => {
    const s0 = freshRun(4);
    const b = giveBuried(s0, 'fear', 2);
    let s = engine.debug.startCombat(s0, 'enc.a2.apathy');
    const apathyHp = s.combat!.enemies.find((e) => e.defId === 'shade.apathy')!.maxHp;
    s = engine.debug.setHand(withHp(s, 'shade.surfaced_fear', 2), ['neutral.push_it_down', 'love.kind_word']);
    s = play(s, 'neutral.push_it_down', 'shade.surfaced_fear');
    // B2: the boss grows by 10 x Weight.
    expect(s.combat!.enemies.find((e) => e.defId === 'shade.apathy')!.maxHp).toBe(apathyHp + 20);
    s = play(withHp(s, 'shade.apathy', 1), 'love.kind_word', 'shade.apathy');
    expect(s.phase.kind).toBe('reward');
    const buried = s.run.deck.filter((c) => engine.pack.cards[c.defId]!.kind === 'buried');
    expect(buried).toEqual([{ ...b }]);
  });

  it('10 / minor-11: the Wishing Well Echo (real fight) pays 10 + 8 on a Resolve, counts as a win, no card reward', () => {
    const s0 = freshRun(5);
    s0.run.map.current = s0.run.map.nodes.find((n) => n.row === 3)!.id;
    s0.phase = { kind: 'event', eventId: 'mem.wishing_well', chosen: null };
    let s = step(s0, { t: 'option', i: 2 });
    expect(s.phase.kind).toBe('combat');
    expect(s.combat!.encounter).toBe('enc.mem.echo');
    s = engine.debug.setHand(withHp(s, 'shade.echo', 2), ['friendship.reach_out']);
    s = play(s, 'friendship.reach_out', 'shade.echo');
    if (s.phase.kind !== 'reward') throw new Error(`expected reward, got ${s.phase.kind}`);
    expect(s.phase.offer).toMatchObject({ source: 'event', cards: [], glimmers: 18, then: 'map' });
    expect(s.run.glimmers).toBe(50 + 18);
    expect(s.run.combatsWon).toBe(1);
    const gained = s.run.keepsakes.filter((k) => k.id !== 'ks.warm_locket');
    expect(gained.map((k) => engine.pack.keepsakes[k.id]!.rarity)).toEqual(['uncommon']);
    expect(s.eventCombat).toBeNull();
  });

  it('3.2 step 3 / 4.4: The Compass from the 2nd real win makes the next fight Harmonize (Love then Joy)', () => {
    let s = freshRun(6);
    for (let win = 1; win <= 2; win++) {
      s = engine.debug.startCombat(s, 'enc.a1.grumble');
      s = engine.debug.setHand(withHp(s, 'shade.grumble', 1), ['love.kind_word']);
      s = play(s, 'love.kind_word', 'shade.grumble');
      if (s.phase.kind !== 'reward') throw new Error('expected reward');
      expect(s.phase.offer.compass).toBe(win === 2);
      s = step(s, { t: 'continue' });
    }
    expect(s.run.keepsakes.map((k) => k.id)).toContain('ks.compass');
    s = engine.debug.startCombat(s, 'enc.a1.grumble');
    s = engine.debug.setHand(s, ['love.kind_word', 'joy.bright_spark']);
    s = play(s, 'love.kind_word', 'shade.grumble');
    const joy = handUid(s, 'joy.bright_spark');
    expect(engine.handHints(s).find((h) => h.uid === joy)).toMatchObject({ harmonizesNow: true, blend: 'delight' });
  });

  it('B3: Resolving a Surfaced Shade whose Insight was already created removes its Buried card from the run deck', () => {
    const s0 = freshRun(7);
    s0.run.insightsMade = ['insight.passion'];
    const b = giveBuried(s0, 'anger', 1);
    let s = engine.debug.startCombat(s0, 'enc.a2.apathy');
    s = engine.debug.setHand(s, ['love.kind_word', 'love.kind_word']);
    s = play(s, 'love.kind_word', 'shade.surfaced_anger');
    s = play(withHp(s, 'shade.apathy', 1), 'love.kind_word', 'shade.apathy');
    expect(s.phase.kind).toBe('reward');
    expect(s.run.deck.some((c) => c.uid === b.uid)).toBe(false);
    expect(s.run.deck.some((c) => c.defId === 'insight.passion')).toBe(false);
    expect(s.run.insightsMade).toEqual(['insight.passion']);
  });

  it('M3: Worn Diary upgrades the Insight of a Surfaced Resolve; Lead Box does not block it', () => {
    for (const ks of ['ks.worn_diary', 'ks.lead_box']) {
      const s0 = freshRun(8);
      s0.run.keepsakes.push({ id: ks, counter: 0 });
      const b = giveBuried(s0, 'anger', 1);
      let s = engine.debug.startCombat(s0, 'enc.a2.apathy');
      s = engine.debug.setHand(withHp(s, 'shade.surfaced_anger', 1), ['love.kind_word', 'love.kind_word']);
      s = play(s, 'love.kind_word', 'shade.surfaced_anger');
      s = play(withHp(s, 'shade.apathy', 1), 'love.kind_word', 'shade.apathy');
      expect(s.phase.kind, ks).toBe('reward');
      expect(s.run.deck.find((c) => c.uid === b.uid), ks).toEqual({ uid: b.uid, defId: 'insight.passion', upgraded: ks === 'ks.worn_diary' });
    }
  });

  it('4.7 / 4.10: an Inward Tend to Weight 0 in combat becomes the (upgraded at peak 2) Insight in the run deck', () => {
    const s0 = freshRun(9);
    const b = giveBuried(s0, 'anger', 1, 2);
    let s = engine.debug.startCombat(s0, 'enc.a1.grumble');
    s = engine.debug.setHand(s, ['love.kind_word', 'buried.anger', 'love.kind_word']);
    expect(s.combat!.piles.hand).toContain(b.uid);
    s = step(s, { t: 'play', card: handUid(s, 'love.kind_word'), inward: true });
    expect(s.combat!.cards[b.uid]!.defId).toBe('insight.passion');
    s = play(withHp(s, 'shade.grumble', 1), 'love.kind_word', 'shade.grumble');
    expect(s.phase.kind).toBe('reward');
    expect(s.run.deck.find((c) => c.uid === b.uid)).toEqual({ uid: b.uid, defId: 'insight.passion', upgraded: true });
    expect(s.run.insightsMade).toEqual(['insight.passion']);
    expect(s.run.stats.insights).toBe(1);
    expect(s.run.stats.tends).toBe(1);
  });

  it('4.10: a Suppress with Buried <face> at Weight 3 costs 3 max Heart when the fight is won', () => {
    const s0 = freshRun(10);
    giveBuried(s0, 'anger', 3);
    let s = engine.debug.startCombat(s0, 'enc.a1.grumble');
    s = engine.debug.setHand(withHp(s, 'shade.grumble', 2), ['neutral.push_it_down']);
    s = play(s, 'neutral.push_it_down', 'shade.grumble');
    expect(s.phase.kind).toBe('reward');
    expect(s.run.maxHeart).toBe(67);
    expect(s.run.heart).toBeLessThanOrEqual(67);
    expect(s.run.deck.filter((c) => c.defId === 'buried.anger')).toEqual([expect.objectContaining({ weight: 3 })]);
  });

  it('5.5 / minor-6: Paper Crane saves once in combat and is committed to the run; the next lethal blow is a defeat', () => {
    const s0 = freshRun(11);
    s0.run.keepsakes.push({ id: 'ks.paper_crane', counter: 0 });
    let s = engine.debug.startCombat(s0, 'enc.a1.grumble');
    const low = engine.deserialize(engine.serialize(s))!;
    low.combat!.player.hp = 1;
    s = step(low, { t: 'endTurn' });
    expect(s.combat!.player.hp).toBeGreaterThan(1);
    expect(s.combat!.paperCraneUsed).toBe(true);
    expect(s.run.paperCraneUsed).toBe(false); // the run is never written mid-combat
    s = engine.debug.setHand(withHp(s, 'shade.grumble', 1), ['love.kind_word']);
    s = play(s, 'love.kind_word', 'shade.grumble');
    expect(s.phase.kind).toBe('reward');
    expect(s.run.paperCraneUsed).toBe(true);
    expect(s.run.keepsakes.find((k) => k.id === 'ks.paper_crane')!.counter).toBe(1);
    s = step(s, { t: 'continue' });
    const again = engine.deserialize(engine.serialize(engine.debug.startCombat(s, 'enc.a1.grumble')))!;
    again.combat!.player.hp = 1;
    expect(step(again, { t: 'endTurn' }).phase).toEqual({ kind: 'defeat', cause: 'heart' });
  });

  for (const [finisher, ending] of [
    ['blend.sunbeam', 'resolved'],
    ['love.kind_word', 'suppressed'],
  ] as const) {
    it(`15.3: The Numbness finished by ${finisher} (${ending === 'resolved' ? 'FELT' : 'MUFFLED'}) ends the run '${ending}'`, () => {
      const s0 = freshRun(12);
      giveBuried(s0, 'anger', 1);
      giveBuried(s0, 'fear', 2);
      s0.run.act = 3;
      s0.run.map = generateDeepMap({ pack: fixturePack, rules: resolveRules(fixturePack.rules) }, s0.seed);
      s0.run.map.current = 1;
      let s = step(s0, { t: 'move', node: 2 });
      expect(s.combat!.tier).toBe('final');
      // Surfacing: both Buried cards rise (heaviest first is not needed here), no hidden Weight.
      expect(s.combat!.enemies.map((e) => e.defId).sort()).toEqual(['shade.numbness', 'shade.surfaced_anger', 'shade.surfaced_fear']);
      s = engine.debug.setHand(withHp(withHp(s, 'shade.surfaced_anger', 1), 'shade.surfaced_fear', 1), [
        'love.kind_word',
        'courage.brave_strike',
        finisher,
      ]);
      s = play(s, 'love.kind_word', 'shade.surfaced_anger');
      s = play(s, 'courage.brave_strike', 'shade.surfaced_fear');
      s = play(withHp(s, 'shade.numbness', 1), finisher, 'shade.numbness');
      if (s.phase.kind !== 'reward') throw new Error(`expected reward, got ${s.phase.kind}`);
      expect(s.phase.offer).toMatchObject({ cards: [], glimmers: 0, then: 'victory' });
      expect(s.run.insightsMade.sort()).toEqual(['insight.instinct', 'insight.passion']);
      expect(step(s, { t: 'continue' }).phase).toEqual({ kind: 'victory', ending });
    });
  }
});
