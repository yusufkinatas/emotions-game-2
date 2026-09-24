// One headless run: playRun(engine, seed, bot) -> RunRecord (DESIGN 21). Normal runs, random Charm (the Charm
// pick is seeded by the run seed, so seeds stay paired across bots). --strict checks invariants every step.

import type { Action, Engine, GameState } from '../src/engine/index';
import { makeBot, type BotName } from './bots/index';
import { deckRecord, recorderFields, RunRecorder } from './recorder';
import type { RunOpts, RunRecord, Tier } from './types';

export const DEFAULT_ACTION_CAP = 25_000;
const MAX_VIOLATIONS = 20;

const errorText = (err: unknown): string => {
  if (err instanceof Error) return `${err.name}: ${err.message}\n${(err.stack ?? '').split('\n').slice(1, 6).join('\n')}`;
  return String(err);
};

export function playRun(engine: Engine, seed: number, botName: BotName, opts: RunOpts = {}): RunRecord {
  const t0 = performance.now();
  const cap = opts.actionCap ?? DEFAULT_ACTION_CAP;
  const bot = makeBot(engine, botName, seed, { probe: opts.probe });
  const rec = new RunRecorder(engine);
  const replay: Action[] = [];
  const violations: string[] = [];
  const decisions = { combat: 0, run: 0 };
  let error: string | null = null;
  let softlock = false;
  let s: GameState = engine.newRun(seed);

  for (;;) {
    let legal: Action[];
    try {
      legal = engine.legalActions(s);
    } catch (err) {
      error = `legalActions threw at action ${replay.length}: ${errorText(err)}`;
      break;
    }
    if (legal.length === 0) {
      if (s.phase.kind !== 'victory' && s.phase.kind !== 'defeat') softlock = true;
      break;
    }
    if (replay.length >= cap) {
      softlock = true;
      break;
    }
    let a: Action;
    try {
      a = bot.decide(s, legal);
    } catch (err) {
      error = `bot ${botName} threw at action ${replay.length} in ${s.phase.kind}: ${errorText(err)}`;
      break;
    }
    if (s.phase.kind === 'combat') decisions.combat += 1;
    else decisions.run += 1;
    replay.push(a);
    let next: GameState;
    try {
      const r = engine.step(s, a);
      rec.onStep(s, r.state, r.events);
      next = r.state;
    } catch (err) {
      error = `step threw at action ${replay.length - 1} (${JSON.stringify(a)}) in ${s.phase.kind}: ${errorText(err)}`;
      break;
    }
    s = next;
    if (opts.strict && violations.length < MAX_VIOLATIONS) {
      for (const v of engine.checkInvariants(s)) {
        if (violations.length < MAX_VIOLATIONS) violations.push(`action ${replay.length - 1} ${JSON.stringify(a)}: ${v}`);
      }
    }
  }

  const win = s.phase.kind === 'victory';
  const last = rec.combats[rec.combats.length - 1] ?? null;
  const charm = s.run.keepsakes.find((k) => engine.pack.keepsakes[k.id]?.rarity === 'charm')?.id ?? null;
  const tiers = new Set<Tier>(rec.combats.map((c) => c.tier));
  const final = rec.combats.find((c) => c.tier === 'final') ?? null;
  const keepReplay = error !== null || violations.length > 0 || softlock;
  return {
    seed,
    bot: botName,
    charm,
    win,
    ending: s.phase.kind === 'victory' ? s.phase.ending : null,
    defeat:
      s.phase.kind === 'defeat'
        ? { cause: s.phase.cause, encounter: last?.encounter ?? null, tier: last?.tier ?? null, act: s.run.act }
        : !win
          ? { cause: error ? 'error' : 'softlock', encounter: rec.openCombat?.encounter ?? null, tier: rec.openCombat?.tier ?? null, act: s.run.act }
          : null,
    floors: s.run.floor,
    actReached: s.run.act,
    ...recorderFields(rec),
    tends: s.run.stats.tends,
    insights: s.run.stats.insights,
    reachedNumbness: tiers.has('final'),
    numbnessWon: final?.won ?? false,
    decisions,
    actions: replay.length,
    deck: deckRecord(engine, s),
    probe: bot.probe,
    violations,
    error,
    softlock,
    replay: keepReplay ? replay : null,
    ms: performance.now() - t0,
  };
}
