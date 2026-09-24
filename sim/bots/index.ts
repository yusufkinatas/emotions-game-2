// The 15 bots of DESIGN 21.1 (v1.1 cuts): random, confused, blind, greedyType, aware, three ablations and
// seven policy bots. Every bot is deterministic given (seed, bot name).

import { hash32, Rng, type Action, type Engine, type GameState } from '../../src/engine/index';
import { awareBelief, blindBelief, confusedBelief, greedyTypeBelief, type Belief } from './belief';
import { buildCombatView } from './combatView';
import { monoPolicy, rainbowPolicy, setPolicy, type DraftPolicy } from './draft';
import { bestPick, choosePending, type CombatFlags } from './greedy';
import { rewardCardPick, runDecision, type RunPolicyCfg } from './runPolicy';

export const GATE_BOTS = ['random', 'confused', 'blind', 'greedyType', 'aware'] as const;
export const ABLATION_BOTS = ['aware-noResolve', 'aware-noHarmony', 'aware-noInward'] as const;
export const POLICY_BOTS = ['mono-love', 'mono-courage', 'pair-delight', 'arc3-love', 'rainbow', 'buryAll', 'resolveOnly'] as const;
export const ALL_BOTS = [...GATE_BOTS, ...ABLATION_BOTS, ...POLICY_BOTS] as const;
export type BotName = (typeof ALL_BOTS)[number];

export const isBotName = (x: string): x is BotName => (ALL_BOTS as readonly string[]).includes(x);

/** Decision divergence counters (21.3): how often aware's pick differs from greedyType's and blind's. */
export interface ProbeCounts {
  combat: { n: number; diffGreedy: number; diffBlind: number };
  reward: { n: number; diffGreedy: number; diffBlind: number };
}

export const emptyProbe = (): ProbeCounts => ({
  combat: { n: 0, diffGreedy: 0, diffBlind: 0 },
  reward: { n: 0, diffGreedy: 0, diffBlind: 0 },
});

export interface Bot {
  readonly name: BotName;
  decide(s: GameState, legal: Action[]): Action;
  /** Present when the divergence probe runs on this bot's decisions. */
  readonly probe: ProbeCounts | null;
}

interface GreedySpec {
  belief: Belief;
  flags: CombatFlags;
  draft: DraftPolicy | null;
}

function specOf(name: Exclude<BotName, 'random'>): GreedySpec {
  const aware = (draft: DraftPolicy | null = null, flags: CombatFlags = {}): GreedySpec => ({ belief: awareBelief(name), flags, draft });
  switch (name) {
    case 'confused':
      return { belief: confusedBelief(), flags: {}, draft: null };
    case 'blind':
      return { belief: blindBelief(), flags: {}, draft: null };
    case 'greedyType':
      return { belief: greedyTypeBelief(), flags: {}, draft: null };
    case 'aware':
      return aware();
    case 'aware-noResolve':
      return { belief: awareBelief(name, { knowsResolve: false }), flags: {}, draft: null };
    case 'aware-noHarmony':
      return { belief: awareBelief(name, { knowsHarmony: false }), flags: {}, draft: null };
    case 'aware-noInward':
      return { belief: awareBelief(name, { knowsCleanse: false }), flags: { noInward: true }, draft: null };
    case 'mono-love':
      return aware(monoPolicy('love'));
    case 'mono-courage':
      return aware(monoPolicy('courage'));
    case 'pair-delight':
      return aware(setPolicy('pair-delight', ['love', 'joy']));
    case 'arc3-love':
      return aware(setPolicy('arc3-love', ['love', 'joy', 'friendship']));
    case 'rainbow':
      return aware(rainbowPolicy);
    case 'buryAll':
      return { belief: awareBelief(name, { knowsResolve: false }), flags: { alwaysTend: true }, draft: null };
    case 'resolveOnly':
      return aware(null, { resolveOnly: true });
  }
}

function randomBot(seed: number): Bot {
  const rng = new Rng(hash32(seed, 'bot', 'random'));
  return { name: 'random', probe: null, decide: (_s, legal) => rng.pick(legal) };
}

const GREEDY_REF = greedyTypeBelief();
const BLIND_REF = blindBelief();
const refCfg = (belief: Belief): RunPolicyCfg => ({ belief, draft: null, alwaysTend: false });

function greedyBot(engine: Engine, name: Exclude<BotName, 'random'>, probe: ProbeCounts | null): Bot {
  const spec = specOf(name);
  const cfg: RunPolicyCfg = { belief: spec.belief, draft: spec.draft, alwaysTend: spec.flags.alwaysTend === true };
  return {
    name,
    probe,
    decide(s, legal) {
      if (s.phase.kind === 'combat' && s.combat) {
        if (s.combat.pending) return choosePending(buildCombatView(engine, s, legal, { previews: false }), spec.belief);
        const v = buildCombatView(engine, s, legal);
        const pick = bestPick(v, spec.belief, spec.flags);
        if (probe && v.candidates.length > 0) {
          probe.combat.n += 1;
          if (bestPick(v, GREEDY_REF).key !== pick.key) probe.combat.diffGreedy += 1;
          if (bestPick(v, BLIND_REF).key !== pick.key) probe.combat.diffBlind += 1;
        }
        return pick.action;
      }
      const a = runDecision(engine, s, legal, cfg);
      if (probe && s.phase.kind === 'reward' && (a.t === 'takeCard' || a.t === 'skip')) {
        const mine = rewardCardPick(engine, s, cfg);
        probe.reward.n += 1;
        if (rewardCardPick(engine, s, refCfg(GREEDY_REF)) !== mine) probe.reward.diffGreedy += 1;
        if (rewardCardPick(engine, s, refCfg(BLIND_REF)) !== mine) probe.reward.diffBlind += 1;
      }
      return a;
    },
  };
}

export interface MakeBotOpts {
  /** Run the divergence probe (aware only; it reuses aware's previews). */
  probe?: boolean;
}

export function makeBot(engine: Engine, name: BotName, seed: number, opts: MakeBotOpts = {}): Bot {
  if (name === 'random') return randomBot(seed);
  return greedyBot(engine, name, opts.probe && name === 'aware' ? emptyProbe() : null);
}

export type { Belief } from './belief';
