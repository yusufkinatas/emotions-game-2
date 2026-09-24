// The tutorial's Act 1 teaches Resolving (17.1): its card rewards never offer a card that pays off
// Suppressing (Push It Down). Normal runs still can.
import { describe, expect, it } from 'vitest';
import { defaultPack } from '../../src/content/index';
import { createEngine } from '../../src/engine/index';
import { Rng } from '../../src/engine/rng';
import { resolveRules } from '../../src/engine/rules';
import { rewardsSuppress, rollCardOffer } from '../../src/engine/run/rewards';
import type { EngineCtx } from '../../src/engine/types';

const ctx: EngineCtx = { pack: defaultPack, rules: resolveRules(defaultPack.rules) };
const engine = createEngine(defaultPack);
const spec = { elite: false, compassScreen: false, fullBloom: true, ownsCompass: false };

function offered(tutorial: boolean, n = 3000): Set<string> {
  const s = engine.newRun(7, tutorial ? { tutorial: true } : { tutorial: false, charm: defaultPack.starter.charms[0]! });
  const out = new Set<string>();
  for (let seed = 1; seed <= n; seed++) for (const id of rollCardOffer(s.run, ctx, new Rng(seed), spec)) out.add(id);
  return out;
}

describe('tutorial card rewards (17.1)', () => {
  it('Push It Down is the only Suppress-payoff card in the pack', () => {
    const ids = Object.values(defaultPack.cards).filter(rewardsSuppress).map((d) => d.id);
    expect(ids).toEqual(['neutral.push_it_down']);
  });

  it('a tutorial run never offers a card that rewards Suppressing', () => {
    const ids = [...offered(true)];
    expect(ids.some((id) => rewardsSuppress(defaultPack.cards[id]!))).toBe(false);
    // Other neutral cards are still offered.
    expect(ids.some((id) => defaultPack.cards[id]!.lights.length === 0)).toBe(true);
  });

  it('a normal run can still offer it', () => {
    expect(offered(false).has('neutral.push_it_down')).toBe(true);
  });
});
