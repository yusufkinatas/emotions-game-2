// Combat lab (DESIGN 21.2): fixed decks x every encounter x seeds, isolating combat skill from the run policy.
// Decks: mono-Love, Love+Joy, Love+Courage (non-adjacent), rainbow, neutral-only control. Measures Heart lost,
// turns and wins for aware and blind play with The Compass owned.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CardInstance, Engine, GameState } from '../src/engine/index';
import { makeBot, type BotName } from './bots/index';
import { RunRecorder } from './recorder';
import { mean } from './stats';

export const LAB_DECKS: Record<string, string[]> = {
  'mono-Love': [
    ...Array<string>(5).fill('love.kind_word'),
    'love.soft_spot',
    'love.soft_spot',
    'love.unguarded',
    'love.forgive',
    'love.warm_embrace',
    'love.warm_embrace',
    'love.warm_embrace',
  ],
  'Love+Joy': [
    'love.kind_word',
    'love.kind_word',
    'love.kind_word',
    'love.soft_spot',
    'love.warm_embrace',
    'love.warm_embrace',
    'joy.bright_spark',
    'joy.bright_spark',
    'joy.bright_spark',
    'joy.skip_along',
    'joy.skip_along',
    'blend.sunbeam',
  ],
  'Love+Courage': [
    'love.kind_word',
    'love.kind_word',
    'love.kind_word',
    'love.soft_spot',
    'love.warm_embrace',
    'love.warm_embrace',
    'courage.brave_strike',
    'courage.brave_strike',
    'courage.brave_strike',
    'courage.chin_up',
    'courage.stand_firm',
    'courage.stand_firm',
  ],
  rainbow: [
    'love.kind_word',
    'love.kind_word',
    'joy.bright_spark',
    'joy.bright_spark',
    'friendship.reach_out',
    'friendship.reach_out',
    'courage.brave_strike',
    'courage.brave_strike',
    'hope.wish_on_a_star',
    'calm.lullaby',
    'courage.stand_firm',
    'courage.stand_firm',
  ],
  'neutral-only': [
    ...Array<string>(6).fill('neutral.push_it_down'),
    ...Array<string>(4).fill('neutral.name_it'),
    'neutral.pause',
    'neutral.pause',
  ],
};

export interface LabRow {
  deck: string;
  bot: BotName;
  encounter: string;
  fights: number;
  wins: number;
  heartLost: number;
  turns: number;
}

export interface LabResult {
  seeds: number;
  rows: LabRow[];
}

function labState(engine: Engine, seed: number, deck: string[]): GameState {
  const s = engine.newRun(seed, { charm: 'ks.warm_locket' });
  const cards: CardInstance[] = deck.map((defId, i) => ({ uid: i + 1, defId, upgraded: false }));
  return {
    ...s,
    nextUid: cards.length + 1,
    run: { ...s.run, deck: cards, keepsakes: [{ id: 'ks.compass', counter: 0 }] },
  };
}

/** One fight to its end with a bot. */
export function labFight(engine: Engine, seed: number, deck: string[], encounter: string, botName: BotName): { won: boolean; heartLost: number; turns: number } {
  const before = labState(engine, seed, deck);
  let s = engine.debug.startCombat(before, encounter);
  const rec = new RunRecorder(engine);
  rec.onStep(before, s, []);
  const bot = makeBot(engine, botName, seed);
  for (let n = 0; n < 5000 && s.phase.kind === 'combat' && s.combat && !s.combat.outcome; n++) {
    const legal = engine.legalActions(s);
    if (legal.length === 0) break;
    const r = engine.step(s, bot.decide(s, legal));
    rec.onStep(s, r.state, r.events);
    s = r.state;
  }
  const c = rec.combats[0]!;
  return { won: s.phase.kind !== 'defeat' && c.won, heartLost: c.heartLost, turns: c.turns };
}

export function runLab(engine: Engine, opts: { seeds?: number; bots?: BotName[]; decks?: string[] } = {}): LabResult {
  const seeds = opts.seeds ?? 20;
  const bots = opts.bots ?? (['aware', 'blind'] as BotName[]);
  const decks = opts.decks ?? Object.keys(LAB_DECKS);
  const encounters = Object.keys(engine.pack.encounters).filter((id) => !engine.pack.pools.tutorial.includes(id));
  const rows: LabRow[] = [];
  for (const deck of decks) {
    for (const bot of bots) {
      for (const encounter of encounters) {
        const row: LabRow = { deck, bot, encounter, fights: 0, wins: 0, heartLost: 0, turns: 0 };
        for (let seed = 1; seed <= seeds; seed++) {
          const f = labFight(engine, seed, LAB_DECKS[deck]!, encounter, bot);
          row.fights += 1;
          if (f.won) row.wins += 1;
          row.heartLost += f.heartLost;
          row.turns += f.turns;
        }
        rows.push(row);
      }
    }
  }
  return { seeds, rows };
}

export function renderLab(res: LabResult): string {
  const decks = [...new Set(res.rows.map((r) => r.deck))];
  const bots = [...new Set(res.rows.map((r) => r.bot))];
  const encs = [...new Set(res.rows.map((r) => r.encounter))];
  const cell = (deck: string, bot: string, enc: string) => {
    const r = res.rows.find((x) => x.deck === deck && x.bot === bot && x.encounter === enc);
    return r ? `${(r.heartLost / r.fights).toFixed(1)} / ${(r.turns / r.fights).toFixed(1)}t${r.wins < r.fights ? ` / ${Math.round((100 * r.wins) / r.fights)}%` : ''}` : '-';
  };
  const lines = [
    '# Combat lab',
    '',
    `Fixed 12-card decks with The Compass, Heart 70, ${res.seeds} seeds per cell. Cells: mean Heart lost / mean turns (/ win % when below 100%).`,
    '',
  ];
  for (const bot of bots) {
    lines.push(`## ${bot}`, '', `| Encounter | ${decks.join(' | ')} |`, `| --- | ${decks.map(() => '---').join(' | ')} |`);
    for (const enc of encs) lines.push(`| ${enc} | ${decks.map((d) => cell(d, bot, enc)).join(' | ')} |`);
    const avg = decks.map((d) => mean(res.rows.filter((r) => r.deck === d && r.bot === bot).map((r) => r.heartLost / r.fights)).toFixed(1));
    lines.push(`| **mean Heart lost** | ${avg.join(' | ')} |`, '');
  }
  return lines.join('\n');
}

export function writeLab(dir: string, res: LabResult): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'lab.md'), renderLab(res));
  writeFileSync(join(dir, 'lab.json'), JSON.stringify(res, null, 1));
}
