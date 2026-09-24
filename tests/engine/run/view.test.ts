import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/engine/combat/index', () => import('./fakeCombat'));

import type { GameState } from '../../../src/engine/types';
import { engine, freshRun, giveBuried, giveCard } from './helpers';

function withNode(s: GameState, encounter: string, kind: 'fight' | 'elite' = 'fight'): number {
  const n = s.run.map.nodes[0]!;
  n.kind = kind;
  n.encounter = { id: encounter, hps: [40, 30] };
  return n.id;
}

describe('nodeDetail (16.4)', () => {
  it('lists the Shades, their afflictions and how your ease cards answer them', () => {
    const s = freshRun(1);
    giveCard(s, 'blend.shoulder_to_shoulder');
    const id = withNode(s, 'enc.a1.mope_skitter');
    const d = engine.nodeDetail(s, id);
    expect(d.kind).toBe('fight');
    expect(d.shades).toEqual([['sadness'], ['fear']]);
    expect(d.names).toEqual(['mope', 'skitter']);
    expect(d.afflictions).toEqual(['heavy', 'trembling']);
    // Warm Locket deck: Kind Word x3, Bright Spark x2, Reach Out x2, Brave Strike x2 (+ a Loyalty Blend).
    expect(d.deckAnswers).toEqual([
      { shade: 'sadness', opposite: 2, dissonant: 3 },
      { shade: 'fear', opposite: 3, dissonant: 2 },
    ]);
    expect(d.rewards).toEqual(['card', 'Glimmers']);
    expect(d.text).toBe(
      'Fight: Sadness + Fear. Sadness inflicts Heavy. Fear inflicts Trembling. Your deck: 2 cards OPPOSITE to Sadness (Joy), ' +
        '3 cards OPPOSITE to Fear (Courage), 3 cards DISSONANT to Sadness (Love), 2 cards DISSONANT to Fear (Friendship). ' +
        'Rewards: card, Glimmers.',
    );
  });

  it('compounds list both faces; numb Shades say they are Muffled; Memories stay hidden', () => {
    const s = freshRun(2);
    s.run.act = 2;
    s.run.map.act = 2;
    expect(engine.nodeDetail(s, withNode(s, 'enc.a2.old_grudge')).shades).toEqual([['anger', 'sadness']]);
    const apathy = engine.nodeDetail(s, withNode(s, 'enc.a2.apathy', 'elite'));
    expect(apathy.shades).toEqual([[]]);
    expect(apathy.text).toContain('Muffled');
    expect(apathy.rewards).toEqual(['card', 'Keepsake', 'Glimmers']);
    const mem = s.run.map.nodes[1]!;
    mem.kind = 'memory';
    delete mem.encounter;
    expect(engine.nodeDetail(s, 1)).toMatchObject({ kind: 'memory', shades: [], rewards: [] });
  });
});

describe('deckSummary (12.2, 4.16)', () => {
  it('counts by Light and Blend, most common Light uses ease cards only, Numbness meter', () => {
    const s = freshRun(3);
    giveCard(s, 'blend.sunbeam');
    giveCard(s, 'neutral.pause');
    for (let i = 0; i < 5; i++) giveCard(s, 'courage.find_your_nerve');
    giveBuried(s, 'fear', 1);
    giveBuried(s, 'anger', 2);
    giveBuried(s, 'sadness', 2);
    giveBuried(s, 'despair', 3);
    const d = engine.deckSummary(s);
    expect(d.total).toBe(12 + 1 + 1 + 5 + 4);
    expect(d.byLight).toMatchObject({ love: 3, joy: 2, friendship: 2, courage: 10 });
    expect(d.byBlend.delight).toBe(1);
    expect([d.neutral, d.buried, d.insight, d.buriedWeight]).toEqual([1, 4, 0, 8]);
    expect(d.easeByLight).toMatchObject({ love: 4, joy: 3, friendship: 2, courage: 2 });
    expect(d.mostCommon.slice(0, 3)).toEqual(['love', 'joy', 'friendship']);
    const byUid = (u: number) => s.run.deck.find((c) => c.uid === u)!.defId;
    expect(d.numbness!.willSurface.map(byUid)).toEqual(['buried.despair', 'buried.anger', 'buried.sadness']);
    expect(d.numbness!.hiddenWeight).toBe(1);
    expect(d.numbness!.hiddenIntensity).toBe(6);
    expect(engine.deckSummary(freshRun(3)).numbness).toBeNull();
  });
});
