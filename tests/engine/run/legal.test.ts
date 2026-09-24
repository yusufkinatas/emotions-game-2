import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/engine/combat/index', () => import('./fakeCombat'));

import type { GameState, RewardOffer } from '../../../src/engine/types';
import { engine, freshRun, giveBuried } from './helpers';

const offer = (over: Partial<RewardOffer>): RewardOffer => ({
  source: 'fight',
  glimmers: 10,
  compass: false,
  keepsakes: [],
  keepsakeChoice: false,
  cards: ['joy.giggle', 'love.soft_spot', 'neutral.pause'],
  taken: { keepsake: true, card: false },
  outcomes: [],
  fullBloom: false,
  then: 'map',
  ...over,
});

const withPhase = (phase: GameState['phase'], prep?: (s: GameState) => void): GameState => {
  const s = freshRun(1);
  prep?.(s);
  s.phase = phase;
  return s;
};

describe('legalActions: canonical order for every non-combat phase (20.6)', () => {
  it('charmSelect and map', () => {
    expect(engine.legalActions(engine.newRun(1))).toEqual([0, 1, 2, 3].map((i) => ({ t: 'pickCharm', i })));
    const s = freshRun(1);
    expect(engine.legalActions(s)).toEqual([
      { t: 'move', node: 0 },
      { t: 'move', node: 1 },
      { t: 'move', node: 2 },
    ]);
    s.run.map.current = 1;
    expect(engine.legalActions(s)).toEqual([...s.run.map.nodes[1]!.next].sort((a, b) => a - b).map((node) => ({ t: 'move', node })));
  });

  it('reward: keepsakes, cards, skip, continue', () => {
    expect(engine.legalActions(withPhase({ kind: 'reward', offer: offer({}) }))).toEqual([
      { t: 'takeCard', i: 0 },
      { t: 'takeCard', i: 1 },
      { t: 'takeCard', i: 2 },
      { t: 'skip' },
      { t: 'continue' },
    ]);
    const boss = offer({ keepsakes: ['ks.lead_box', 'ks.mirror_shard', 'ks.skeleton_key'], keepsakeChoice: true, taken: { keepsake: false, card: false } });
    expect(engine.legalActions(withPhase({ kind: 'reward', offer: boss })).slice(0, 3)).toEqual([0, 1, 2].map((i) => ({ t: 'takeKeepsake', i })));
    const elite = offer({ keepsakes: ['ks.journal'], taken: { keepsake: false, card: true } });
    expect(engine.legalActions(withPhase({ kind: 'reward', offer: elite }))).toEqual([{ t: 'takeKeepsake', i: 0 }, { t: 'continue' }]);
    expect(engine.legalActions(withPhase({ kind: 'reward', offer: offer({ taken: { keepsake: true, card: true } }) }))).toEqual([{ t: 'continue' }]);
  });

  it('wheelCloses', () => {
    expect(engine.legalActions(withPhase({ kind: 'wheelCloses', options: ['hope.plant_a_seed', 'calm.still_water'] }))).toEqual([
      { t: 'takeCard', i: 0 },
      { t: 'takeCard', i: 1 },
      { t: 'skip' },
    ]);
  });

  it('shop: affordable unsold slots, services, leave', () => {
    const stock = {
      items: [
        { kind: 'card' as const, id: 'joy.giggle', price: 45, sale: false, sold: false },
        { kind: 'card' as const, id: 'joy.confetti', price: 45, sale: false, sold: true },
        { kind: 'keepsake' as const, id: 'ks.journal', price: 170, sale: false, sold: false },
      ],
      removeUsed: false,
      talkUsed: false,
      removePrice: 60,
      talkPrice: 35,
      line: 'Found it on a Tuesday.',
    };
    expect(engine.legalActions(withPhase({ kind: 'shop', stock }))).toEqual([{ t: 'buy', slot: 0 }, { t: 'leave' }]);
    const rich = withPhase({ kind: 'shop', stock }, (s) => {
      s.run.glimmers = 300;
      giveBuried(s, 'fear', 1);
    });
    expect(engine.legalActions(rich)).toEqual([
      { t: 'buy', slot: 0 },
      { t: 'buy', slot: 2 },
      { t: 'service', id: 'remove' },
      { t: 'service', id: 'talk' },
      { t: 'leave' },
    ]);
  });

  it('deckSelect: options in deck order, skip only when skippable', () => {
    const s = freshRun(1);
    const uids = s.run.deck.slice(0, 2).map((c) => c.uid);
    const base = { kind: 'deckSelect' as const, purpose: 'remove' as const, options: uids, then: { kind: 'map' as const } };
    expect(engine.legalActions(withPhase({ ...base, skippable: true }))).toEqual([...uids.map((uid) => ({ t: 'choose', uid })), { t: 'skip' }]);
    expect(engine.legalActions(withPhase({ ...base, skippable: false }))).toEqual(uids.map((uid) => ({ t: 'choose', uid })));
  });

  it('event before and after a choice; victory and defeat are terminal', () => {
    expect(engine.legalActions(withPhase({ kind: 'event', eventId: 'mem.campfire', chosen: null }))).toEqual([0, 1, 2].map((i) => ({ t: 'option', i })));
    expect(engine.legalActions(withPhase({ kind: 'event', eventId: 'mem.campfire', chosen: 1 }))).toEqual([{ t: 'continue' }]);
    expect(engine.legalActions(withPhase({ kind: 'victory', ending: 'resolved' }))).toEqual([]);
    expect(engine.legalActions(withPhase({ kind: 'defeat', cause: 'heart' }))).toEqual([]);
  });

  it('every legal action steps without throwing', () => {
    const phases: GameState[] = [
      engine.newRun(2),
      freshRun(2),
      withPhase({ kind: 'reward', offer: offer({ keepsakes: ['ks.journal'], taken: { keepsake: false, card: false } }) }),
      withPhase({ kind: 'wheelCloses', options: ['hope.plant_a_seed'] }),
      withPhase({ kind: 'haven' }, (s) => giveBuried(s, 'anger', 2)),
      withPhase({ kind: 'event', eventId: 'mem.tea_slowly', chosen: null }),
    ];
    for (const s of phases) for (const a of engine.legalActions(s)) expect(() => engine.step(s, a)).not.toThrow();
  });
});
