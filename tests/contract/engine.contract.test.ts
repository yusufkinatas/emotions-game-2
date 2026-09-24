// Engine API contract (DESIGN 20.6, 22): runs against any Engine. States are sampled along real runs played by
// the sim's aware and random bots.
//   - legalActions is non-empty unless the phase is terminal (and empty when it is);
//   - step accepts exactly the legal actions: every legal action steps, and every other action of the phase's
//     shapes throws IllegalActionError;
//   - preview is non-null for every legal play and endTurn in combat (null outside combat);
//   - serialize/deserialize round-trips; hash is deterministic for the same seed and actions.
import { describe, expect, it } from 'vitest';

import { defaultPack } from '../../src/content/index';
import { createEngine, IllegalActionError, type Action, type ContentPack, type Engine, type GameState } from '../../src/engine/index';
import { makeBot, type BotName } from '../../sim/bots/index';
import { fixturePack } from '../engine/run/fixturePack';

const TERMINAL = new Set(['victory', 'defeat']);
const key = (a: Action): string => JSON.stringify(a, Object.keys(a).sort());

/** Walk one run with a bot, returning every `stride`-th state (plus the last) and the action list. */
function walk(engine: Engine, seed: number, bot: BotName, stride: number, cap = 4000): { states: GameState[]; actions: Action[]; last: GameState } {
  const b = makeBot(engine, bot, seed);
  let s = engine.newRun(seed);
  const states: GameState[] = [];
  const actions: Action[] = [];
  for (let i = 0; i < cap; i++) {
    const legal = engine.legalActions(s);
    if (i % stride === 0) states.push(s);
    if (legal.length === 0) break;
    const a = b.decide(s, legal);
    actions.push(a);
    s = engine.step(s, a).state;
  }
  states.push(s);
  return { states, actions, last: s };
}

/** Every action of the shapes the current phase could take (a superset of the legal ones). */
function candidateActions(s: GameState): Action[] {
  const out: Action[] = [];
  const idx = (n: number) => Array.from({ length: n }, (_, i) => i);
  if (s.combat) {
    const c = s.combat;
    const targets = [...c.enemies.map((e) => e.uid), 9999];
    for (const uid of [...c.piles.hand, ...c.piles.draw.slice(0, 2)]) {
      out.push({ t: 'play', card: uid });
      out.push({ t: 'play', card: uid, inward: true });
      for (const t of targets) out.push({ t: 'play', card: uid, target: t });
    }
    for (const uid of [...c.piles.hand, ...(c.pending?.options ?? [])]) out.push({ t: 'choose', uid });
    out.push({ t: 'endTurn' }, { t: 'confirm' }, { t: 'continue' }, { t: 'leave' });
    return out;
  }
  for (const i of idx(6)) out.push({ t: 'pickCharm', i }, { t: 'takeCard', i }, { t: 'takeKeepsake', i }, { t: 'option', i });
  for (const n of s.run.map.nodes.slice(0, 40)) out.push({ t: 'move', node: n.id });
  for (const slot of idx(12)) out.push({ t: 'buy', slot });
  for (const c of s.run.deck) out.push({ t: 'choose', uid: c.uid });
  out.push(
    { t: 'skip' },
    { t: 'continue' },
    { t: 'leave' },
    { t: 'rest' },
    { t: 'kindle' },
    { t: 'reflect' },
    { t: 'service', id: 'remove' },
    { t: 'service', id: 'talk' },
    { t: 'endTurn' },
    { t: 'confirm' },
  );
  return out;
}

function contractSuite(name: string, pack: ContentPack, seeds: number[]): void {
  const engine = createEngine(pack);
  describe(`Engine API contract: ${name}`, () => {
    const runs = seeds.flatMap((seed) => [walk(engine, seed, 'aware', 5), walk(engine, seed, 'random', 9, 1500)]);
    const states = runs.flatMap((r) => r.states);

    it('legalActions is non-empty unless terminal, and empty when terminal', () => {
      for (const s of states) {
        const legal = engine.legalActions(s);
        if (TERMINAL.has(s.phase.kind)) expect(legal, s.phase.kind).toEqual([]);
        else expect(legal.length, `no legal action in ${s.phase.kind}`).toBeGreaterThan(0);
      }
      expect(runs.some((r) => TERMINAL.has(r.last.phase.kind))).toBe(true);
    });

    it('step accepts exactly the legal actions', () => {
      for (const s of states.filter((_, i) => i % 2 === 0)) {
        const legal = new Set(engine.legalActions(s).map(key));
        for (const a of candidateActions(s)) {
          let threw: unknown = null;
          try {
            engine.step(s, a);
          } catch (err) {
            threw = err;
          }
          if (legal.has(key(a))) expect(threw, `legal ${key(a)} in ${s.phase.kind} threw`).toBeNull();
          else expect(threw, `illegal ${key(a)} in ${s.phase.kind} was accepted`).toBeInstanceOf(IllegalActionError);
        }
      }
    });

    it('preview is non-null for legal plays and endTurn in combat, null outside combat', () => {
      let checked = 0;
      for (const s of states) {
        const legal = engine.legalActions(s);
        if (s.phase.kind === 'combat' && s.combat && !s.combat.pending) {
          for (const a of legal) {
            if (a.t !== 'play' && a.t !== 'endTurn') continue;
            expect(engine.preview(s, a), key(a)).not.toBeNull();
            checked += 1;
          }
        } else if (s.phase.kind !== 'combat') {
          for (const a of legal.slice(0, 3)) expect(engine.preview(s, a)).toBeNull();
          expect(engine.preview(s, { t: 'endTurn' })).toBeNull();
        }
      }
      expect(checked).toBeGreaterThan(0);
    });

    it('serialize round-trips every sampled state', () => {
      for (const s of states) {
        const back = engine.deserialize(engine.serialize(s));
        expect(back).toEqual(s);
        expect(engine.hash(back!)).toBe(engine.hash(s));
      }
    });

    it('same seed and same actions give the same hash', () => {
      for (const r of runs.slice(0, 4)) {
        let s = engine.newRun(r.states[0]!.seed);
        for (const a of r.actions) s = engine.step(s, a).state;
        expect(engine.hash(s)).toBe(engine.hash(r.last));
      }
      const again = walk(engine, seeds[0]!, 'aware', 1000);
      expect(engine.hash(again.last)).toBe(engine.hash(runs[0]!.last));
    });
  });
}

contractSuite('defaultPack', defaultPack, [1, 2, 3]);
contractSuite('run fixturePack', fixturePack, [1, 2]);
