import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/engine/combat/index', () => import('./fakeCombat'));

import { assertInvariants, checkInvariants } from '../../../src/engine/invariants';
import { ctx, engine, freshRun, giveBuried, giveCard } from './helpers';

describe('invariants (22, B3)', () => {
  it('fresh states are healthy', () => {
    expect(engine.checkInvariants(engine.newRun(1))).toEqual([]);
    expect(engine.checkInvariants(engine.newRun(1, { tutorial: true }))).toEqual([]);
  });

  it('B3: at most one of each Insight, and only Insights recorded in insightsMade', () => {
    const s = freshRun(2);
    giveCard(s, 'insight.passion');
    expect(checkInvariants(s, ctx)).toContain('insight.passion in deck but not in insightsMade');
    s.run.insightsMade.push('insight.passion');
    expect(checkInvariants(s, ctx)).toEqual([]);
    giveCard(s, 'insight.passion');
    expect(checkInvariants(s, ctx)).toContain('2 copies of insight.passion (B3: at most one)');
  });

  it('Heart, Weight, uids, combat presence and legal actions', () => {
    const s = freshRun(3);
    s.run.heart = 80;
    const b = giveBuried(s, 'anger', 2);
    b.peakWeight = 1;
    s.run.deck.push({ ...s.run.deck[0]! });
    const v = checkInvariants(s, ctx, []);
    expect(v).toContain('heart 80 outside 0..70');
    expect(v).toContain('buried.anger peakWeight 1 < Weight 2');
    expect(v).toContain(`duplicate deck uid ${s.run.deck[0]!.uid}`);
    expect(v).toContain('no legal actions in phase map');
    s.phase = { kind: 'combat', nodeId: 0 };
    expect(checkInvariants(s, ctx)).toContain('combat is null in phase combat');
    expect(() => assertInvariants(s, ctx)).toThrow(/Invariant violations/);
  });

  it('combat piles must partition the combat cards', () => {
    const s = engine.debug.startCombat(freshRun(4), 'enc.a1.grumble');
    expect(engine.checkInvariants(s)).toEqual([]);
    const c = s.combat!;
    c.piles.hand.push(c.piles.draw[0]!);
    expect(checkInvariants(s, ctx).some((m) => m.includes('is in both'))).toBe(true);
    c.enemies[0]!.statuses['flare'] = -1;
    expect(checkInvariants(s, ctx).some((m) => m.includes('-1 flare'))).toBe(true);
  });

  it('R-8: no Shade stays on the field at 0 Intensity while the combat goes on', () => {
    const s = engine.debug.startCombat(freshRun(5), 'enc.a1.grumble');
    const e = s.combat!.enemies[0]!;
    e.hp = 0;
    expect(checkInvariants(s, ctx)).toContain(`${e.defId}#${e.uid} is on the field at 0 Intensity`);
    e.hp = 1;
    expect(checkInvariants(s, ctx)).toEqual([]);
  });
});
