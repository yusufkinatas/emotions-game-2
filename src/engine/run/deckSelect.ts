// Deck selection (remove / upgrade / transform / duplicate / tend): which cards qualify, and opening the phase.

import type { CardFilter, DeckSelectOrigin, DeckSelectPurpose, EngineCtx, GameState, Phase, Uid } from '../types';
import { isBuried, isInsight, isUpgradable, matchesFilter } from './cards';
import { cardAct, cardDef, hasFlag } from './state';

/** Why a Tend (Haven Reflect, an event option) is unavailable with Lead Box. */
export const LEAD_BOX_NO_TEND = "The Lead Box won't let you Tend.";

/** Deck uids that may be picked for `purpose` (deck order). Lead Box forbids every Tend. */
export function selectOptions(d: GameState, ctx: EngineCtx, purpose: DeckSelectPurpose, filter?: CardFilter): Uid[] {
  const act = cardAct(d.run);
  const leadBox = hasFlag(d.run, ctx, 'leadBox');
  return d.run.deck
    .filter((c) => {
      const def = cardDef(ctx, c.defId);
      if (!matchesFilter(c, def, filter, act)) return false;
      switch (purpose) {
        case 'remove':
          return true;
        case 'upgrade':
          return isUpgradable(c, def);
        case 'transform':
          return def.lights.length === 1 && !isBuried(def);
        case 'duplicate':
          // B3 invariant: never a second copy of an Insight.
          return !isBuried(def) && !isInsight(def);
        case 'tend':
          return isBuried(def) && !leadBox;
      }
    })
    .map((c) => c.uid);
}

export function openDeckSelect(
  d: GameState,
  purpose: DeckSelectPurpose,
  options: Uid[],
  then: Phase,
  skippable: boolean,
  origin: DeckSelectOrigin,
): void {
  d.phase = { kind: 'deckSelect', purpose, options, then, skippable, origin };
}
