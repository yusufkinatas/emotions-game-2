// Every encounter in the default pack plays to an end through the public Engine API.
// 1. The starter deck with a simple bot (first legal play, else end the turn).
// 2. Random decks of the whole card pool, random Keepsakes and a random bot, which also reads every hand card's
//    contextual text, every intent and every preview, so a slot that fails to resolve or a banned word that only
//    appears in context (DESIGN 2) is caught with real content.
// Each step must leave a healthy state (DESIGN 22) and every combat must end within the turn limit (4.17).

import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine/index';
import type { Action, CardInstance, GameState, KeepsakeInstance } from '../../src/engine/index';
import { rngFrom, type Rng } from '../../src/engine/rng';
import { BANNED_WORDS, defaultPack } from '../../src/content';

const engine = createEngine(defaultPack);
const MAX_TURNS = 40;
/** Safety cap on actions inside one turn, so a play loop fails the test instead of hanging it. */
const MAX_ACTIONS_PER_TURN = 200;
const STARTER_SEEDS = [1, 7, 42];
const VARIED_SEEDS = [1, 2, 3, 4, 5];

const encounters = Object.keys(defaultPack.encounters).sort();
const banned = new RegExp(`\\b(${BANNED_WORDS.map((w) => w.replace(/ /g, '\\s+')).join('|')})`, 'i');
/** Leftovers of an unfilled slot or a missing number. */
const unfilled = /\b(undefined|NaN|null)\b|[{}]/;

type Bot = (s: GameState, legal: Action[]) => Action | undefined;

/** First legal play; else endTurn; else the first legal action (a pending choice offers only 'choose'). */
const simpleBot: Bot = (_s, legal) =>
  legal.find((a) => a.t === 'play') ?? legal.find((a) => a.t === 'endTurn') ?? legal[0];

/** A random play most of the time, else ends the turn; a pending choice gets a random pick. */
const randomBot =
  (rng: Rng): Bot =>
  (_s, legal) => {
    const plays = legal.filter((a) => a.t === 'play');
    const end = legal.find((a) => a.t === 'endTurn');
    if (plays.length && (!end || rng.float() < 0.85)) return rng.pick(plays);
    return end ?? (legal.length ? rng.pick(legal) : undefined);
  };

/** Contextual text problems in the current combat: card text per target, intents, the preview of `a`. */
function textProblems(s: GameState, a: Action): string[] {
  const out: string[] = [];
  const c = s.combat!;
  const check = (where: string, text: string) => {
    if (!text) out.push(`${where}: empty`);
    else if (unfilled.test(text)) out.push(`${where}: unfilled "${text}"`);
    else if (banned.test(text)) out.push(`${where}: banned word in "${text}"`);
  };
  for (const uid of c.piles.hand) {
    const card = c.cards[uid]!;
    for (const target of [undefined, ...c.enemies.map((e) => e.uid)]) {
      check(`${card.defId}${card.upgraded ? '+' : ''} vs ${target ?? 'none'}`, engine.cardText(s, uid, target));
    }
  }
  for (const iv of engine.intents(s)) {
    check(`intent ${iv.moveId} name`, iv.name);
    check(`intent ${iv.moveId} text`, iv.text);
    if (iv.projectedReason) check(`intent ${iv.moveId} reason`, iv.projectedReason);
  }
  engine.handHints(s);
  if (a.t === 'play' || a.t === 'endTurn') engine.preview(s, a);
  return out;
}

interface Outcome {
  turns: number;
  phase: GameState['phase']['kind'];
  text: string[];
}

function playOut(start: GameState, label: string, bot: Bot, readText: boolean): Outcome {
  let s = start;
  let turns = 0;
  let actionsThisTurn = 0;
  const text = new Set<string>();
  while (s.phase.kind === 'combat' && turns < MAX_TURNS) {
    const a = bot(s, engine.legalActions(s));
    if (!a) throw new Error(`${label}: no legal action in combat on turn ${turns + 1}`);
    if (readText) for (const p of textProblems(s, a)) text.add(p);
    s = engine.step(s, a).state;
    const broken = engine.checkInvariants(s);
    if (broken.length) throw new Error(`${label} after ${JSON.stringify(a)}: ${broken.join('; ')}`);
    if (a.t === 'endTurn') {
      turns += 1;
      actionsThisTurn = 0;
    } else if (++actionsThisTurn > MAX_ACTIONS_PER_TURN) {
      throw new Error(`${label}: more than ${MAX_ACTIONS_PER_TURN} actions on turn ${turns + 1}`);
    }
  }
  return { turns, phase: s.phase.kind, text: [...text] };
}

function expectEnded(out: Outcome, label: string): void {
  expect(out.phase, `${label} still in combat after ${out.turns} turns`).not.toBe('combat');
  expect(['reward', 'defeat']).toContain(out.phase);
  expect(out.turns).toBeLessThanOrEqual(MAX_TURNS);
}

const starterCombat = (encounter: string, seed: number): GameState =>
  engine.debug.startCombat(engine.newRun(seed, { charm: 'ks.warm_locket' }), encounter);

const allCards = Object.values(defaultPack.cards);
const outwardIds = allCards.filter((c) => c.kind !== 'buried').map((c) => c.id);
const buriedIds = allCards.filter((c) => c.kind === 'buried').map((c) => c.id);
const keepsakeIds = Object.keys(defaultPack.keepsakes);

/** 18 cards from the whole pool (every other one upgraded), 2 Buried cards and 3 to 7 extra Keepsakes. */
function variedCombat(encounter: string, seed: number, rng: Rng): GameState {
  const s = engine.newRun(seed, { charm: 'ks.warm_locket' });
  let uid = s.nextUid;
  const deck: CardInstance[] = rng
    .shuffle(outwardIds)
    .slice(0, 18)
    .map((defId, i) => ({ uid: uid++, defId, upgraded: i % 2 === 0 }));
  for (const defId of rng.shuffle(buriedIds).slice(0, 2)) {
    const weight = rng.int(1, 3) as 1 | 2 | 3;
    deck.push({ uid: uid++, defId, upgraded: false, weight, peakWeight: weight });
  }
  // An Insight in the deck must be recorded as made (B3).
  const insightsMade = deck.map((c) => c.defId).filter((id) => defaultPack.cards[id]!.insightOf !== undefined);
  const held = new Set(s.run.keepsakes.map((k) => k.id));
  const extra: KeepsakeInstance[] = rng
    .shuffle(keepsakeIds.filter((id) => !held.has(id)))
    .slice(0, rng.int(3, 7))
    .map((id) => ({ id, counter: 0 }));
  const run = { ...s.run, deck, insightsMade, keepsakes: [...s.run.keepsakes, ...extra] };
  return engine.debug.startCombat({ ...s, nextUid: uid, run }, encounter);
}

describe('every encounter plays to an end with the starter deck', () => {
  it('the pack has encounters to play', () => {
    expect(encounters.length).toBeGreaterThan(0);
  });

  for (const id of encounters) {
    it(id, () => {
      for (const seed of STARTER_SEEDS) {
        const label = `${id} seed ${seed}`;
        expectEnded(playOut(starterCombat(id, seed), label, simpleBot, false), label);
      }
    });
  }
});

describe('every encounter plays to an end with random decks, Keepsakes and plays', () => {
  for (const id of encounters) {
    it(id, () => {
      for (const seed of VARIED_SEEDS) {
        const label = `${id} varied seed ${seed}`;
        const rng = rngFrom(seed, 'playable', id);
        const out = playOut(variedCombat(id, seed, rng), label, randomBot(rng), true);
        expectEnded(out, label);
        expect(out.text, label).toEqual([]);
      }
    });
  }
});
