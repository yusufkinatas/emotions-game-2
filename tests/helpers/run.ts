// Minimal run states for combat tests (the run engine is not needed to test combat).

import { resolveRules } from '../../src/engine/rules';
import type { CardInstance, ContentPack, EngineCtx, GameState, KeepsakeId, RulesConfig, RunState } from '../../src/engine/types';
import { LIGHTS } from '../../src/engine/emotions';

export function ctxFor(pack: ContentPack, rules?: Partial<RulesConfig>): EngineCtx {
  return { pack, rules: resolveRules(pack.rules, rules) };
}

export interface RunOpts {
  deck?: CardInstance[];
  keepsakes?: KeepsakeId[];
  heart?: number;
  maxHeart?: number;
  insightsMade?: string[];
  paperCraneUsed?: boolean;
}

export function makeRun(o: RunOpts = {}): RunState {
  const zeroLights = Object.fromEntries(LIGHTS.map((l) => [l, 0])) as RunState['stats']['playsByLight'];
  return {
    heart: o.heart ?? 70,
    maxHeart: o.maxHeart ?? 70,
    glimmers: 50,
    deck: o.deck ?? [],
    keepsakes: (o.keepsakes ?? []).map((id) => ({ id, counter: 0 })),
    act: 1,
    floor: 0,
    tutorial: false,
    map: { act: 1, nodes: [], current: null, visited: [] },
    combatsWon: 0,
    usedEvents: [],
    shopRemovals: 0,
    paperCraneUsed: o.paperCraneUsed ?? false,
    insightsMade: o.insightsMade ?? [],
    lastPaid: 0,
    stats: {
      floors: 0,
      resolved: 0,
      deepResolved: 0,
      suppressed: 0,
      insights: 0,
      harmonies: 0,
      tends: 0,
      combats: 0,
      cardsPlayed: 0,
      playsByLight: zeroLights,
      playsByCard: {},
      dmgByRelation: { opposite: 0, neutral: 0, dissonant: 0, felt: 0, muffled: 0, veiled: 0 },
      heartLost: 0,
    },
  };
}

/** A GameState on the map with a deck built from card ids (uids 1..n). */
export function makeState(ids: (string | { id: string; upgraded?: boolean; weight?: 1 | 2 | 3; peakWeight?: 1 | 2 | 3 })[], o: RunOpts & { seed?: number } = {}): GameState {
  const deck: CardInstance[] = ids.map((x, i) => {
    const spec = typeof x === 'string' ? { id: x } : x;
    const inst: CardInstance = { uid: i + 1, defId: spec.id, upgraded: spec.upgraded ?? false };
    if (spec.weight) inst.weight = spec.weight;
    if (spec.peakWeight ?? spec.weight) inst.peakWeight = spec.peakWeight ?? spec.weight!;
    return inst;
  });
  return {
    v: 1,
    contentHash: 'test',
    seed: o.seed ?? 1,
    nextUid: deck.length + 1,
    phase: { kind: 'map' },
    run: makeRun({ ...o, deck }),
    combat: null,
    eventCombat: null,
  };
}
