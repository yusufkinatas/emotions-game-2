// The reducer (DESIGN 20.1, 20.6): legal actions and step for every phase. Combat is delegated to combat/index.

import { combatLegalActions, stepCombat } from './combat/index';
import { chooseCard, skipSelect } from './run/choose';
import { cloneJson } from './run/clone';
import { chooseOption } from './run/events';
import { openHavenSelect, rest } from './run/haven';
import { grantKeepsake } from './run/keepsakes';
import { runLegalActions } from './run/legal';
import { addCard } from './run/deck';
import { continueFromReward, enterAct2, enterNode, finishCombat, toMap } from './run/progression';
import { buy, openService } from './run/shop';
import type { StepScratch } from './run/state';
import { canonicalJson } from './serialize';
import { IllegalActionError } from './types';
import type { Action, EngineCtx, GameEvent, GameState, StepResult } from './types';

export function legalActions(s: GameState, ctx: EngineCtx): Action[] {
  if (s.phase.kind === 'combat') return s.combat && !s.combat.outcome ? combatLegalActions(s, ctx) : [];
  return runLegalActions(s, ctx);
}

export const sameAction = (a: Action, b: Action): boolean => canonicalJson(a) === canonicalJson(b);

/** One run-phase action on a cloned draft. Returns the next state (a new object when a combat starts). */
function runStep(d: GameState, sc: StepScratch, a: Action): GameState {
  const ctx = sc.ctx;
  const ph = d.phase;
  switch (a.t) {
    case 'pickCharm':
      if (ph.kind === 'charmSelect') grantKeepsake(d, ctx, ph.options[a.i]!);
      toMap(d);
      return d;
    case 'move':
      return enterNode(d, sc, a.node);
    case 'takeKeepsake':
      if (ph.kind === 'reward') {
        const o = ph.offer;
        for (const id of o.keepsakeChoice ? [o.keepsakes[a.i]!] : o.keepsakes) grantKeepsake(d, ctx, id);
        o.taken.keepsake = true;
      }
      return d;
    case 'takeCard':
      if (ph.kind === 'reward') {
        addCard(d, ctx, ph.offer.cards[a.i]!, false);
        ph.offer.taken.card = true;
      } else if (ph.kind === 'wheelCloses') {
        addCard(d, ctx, ph.options[a.i]!, false);
        enterAct2(d, ctx);
      }
      return d;
    case 'skip':
      if (ph.kind === 'reward') ph.offer.taken.card = true;
      else if (ph.kind === 'wheelCloses') enterAct2(d, ctx);
      else if (ph.kind === 'deckSelect') skipSelect(d);
      return d;
    case 'continue':
      if (ph.kind === 'reward') return continueFromReward(d, sc);
      toMap(d);
      return d;
    case 'buy':
      buy(d, ctx, a.slot);
      return d;
    case 'service':
      openService(d, ctx, a.id);
      return d;
    case 'leave':
      toMap(d);
      return d;
    case 'rest':
      rest(d, ctx);
      toMap(d);
      return d;
    case 'kindle':
    case 'reflect':
      openHavenSelect(d, ctx, a.t);
      return d;
    case 'option':
      return chooseOption(d, sc, a.i);
    case 'choose':
      return chooseCard(d, sc, a.uid);
    case 'play':
    case 'endTurn':
    case 'confirm':
      throw new IllegalActionError(`${a.t} is a combat action`, a);
  }
}

/** A combat that has ended (after a play, or already at its start) is finished at once. */
function settle(s: GameState, sc: StepScratch): GameState {
  let cur = s;
  for (let n = 0; n < 8 && cur.combat?.outcome; n++) cur = finishCombat(cur, sc);
  return cur;
}

const deckSig = (s: GameState): string =>
  s.run.deck.map((c) => `${c.uid}:${c.defId}:${c.upgraded ? 1 : 0}:${c.weight ?? 0}`).join(',');

/** Run-level events from the difference between two states (phase and run counters). */
function runEvents(before: GameState, after: GameState, events: GameEvent[]): void {
  const b = before.run;
  const a = after.run;
  // Combat steps share the run object until the combat ends: nothing to diff.
  if (a !== b) runDiff(before, after, events);
  if (after.phase.kind !== before.phase.kind) {
    const last = [...events].reverse().find((e) => e.e === 'phase');
    if (!last || last.e !== 'phase' || last.kind !== after.phase.kind) events.push({ e: 'phase', kind: after.phase.kind });
  }
}

function runDiff(before: GameState, after: GameState, events: GameEvent[]): void {
  const b = before.run;
  const a = after.run;
  if (a.act !== b.act) events.push({ e: 'run', what: 'act', after: a.act });
  if (a.maxHeart !== b.maxHeart) events.push({ e: 'run', what: 'maxHeart', after: a.maxHeart });
  if (a.heart !== b.heart) events.push({ e: 'run', what: 'heart', after: a.heart });
  if (a.glimmers !== b.glimmers) events.push({ e: 'run', what: 'glimmers', after: a.glimmers });
  if (deckSig(before) !== deckSig(after)) events.push({ e: 'run', what: 'deck', after: a.deck.length });
  for (const k of a.keepsakes) {
    if (!b.keepsakes.some((x) => x.id === k.id)) events.push({ e: 'run', what: 'keepsake', after: k.id });
  }
}

export function stepGame(s: GameState, ctx: EngineCtx, a: Action): StepResult {
  const sc: StepScratch = { ctx, events: [], revealed: false };
  let next: GameState;
  if (s.phase.kind === 'combat') {
    if (!s.combat) throw new IllegalActionError('No combat in progress', a);
    const r = stepCombat(s, ctx, a);
    sc.events.push(...r.events);
    sc.revealed = r.revealedHiddenInfo;
    next = r.state;
  } else {
    if (!runLegalActions(s, ctx).some((x) => sameAction(x, a))) {
      throw new IllegalActionError(`Illegal action ${canonicalJson(a)} in phase ${s.phase.kind}`, a);
    }
    next = runStep(cloneJson(s), sc, a);
    // Run-phase actions can't be undone (DESIGN 16.2 Undo covers card plays only).
    sc.revealed = true;
  }
  next = settle(next, sc);
  runEvents(s, next, sc.events);
  return { state: next, events: sc.events, revealedHiddenInfo: sc.revealed };
}

/** For callers that build a state outside step (newRun's tutorial start, debug.startCombat). */
export function settleState(s: GameState, ctx: EngineCtx): GameState {
  return settle(s, { ctx, events: [], revealed: false });
}
