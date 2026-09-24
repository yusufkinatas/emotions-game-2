// Haven (DESIGN 14): Rest, Kindle or Reflect, with availability.

import type { EngineCtx, GameState, HavenOptionView } from '../types';
import { isBuried } from './cards';
import { LEAD_BOX_NO_TEND, openDeckSelect, selectOptions } from './deckSelect';
import { cardDef, hasFlag } from './state';

export const restAmount = (d: GameState, ctx: EngineCtx): number =>
  Math.floor((d.run.maxHeart * ctx.rules.havenRestPct) / 100);

export function havenOptions(d: GameState, ctx: EngineCtx): HavenOptionView[] {
  const noRest = hasFlag(d.run, ctx, 'noRest');
  const leadBox = hasFlag(d.run, ctx, 'leadBox');
  const hasBuried = d.run.deck.some((c) => isBuried(cardDef(ctx, c.defId)));
  const upgradable = selectOptions(d, ctx, 'upgrade').length > 0;
  return [
    {
      id: 'rest',
      available: !noRest,
      reason: noRest ? "Your Spiral Shell won't let you rest here." : null,
      heartAfter: Math.min(d.run.maxHeart, d.run.heart + restAmount(d, ctx)),
    },
    { id: 'kindle', available: upgradable, reason: upgradable ? null : 'Every card is already upgraded.', heartAfter: null },
    {
      id: 'reflect',
      available: hasBuried && !leadBox,
      reason: leadBox ? LEAD_BOX_NO_TEND : hasBuried ? null : 'Nothing is Buried right now.',
      heartAfter: null,
    },
  ];
}

export const havenAvailable = (d: GameState, ctx: EngineCtx, id: HavenOptionView['id']): boolean =>
  havenOptions(d, ctx).find((o) => o.id === id)?.available ?? false;

export function rest(d: GameState, ctx: EngineCtx): void {
  d.run.heart = Math.min(d.run.maxHeart, d.run.heart + restAmount(d, ctx));
}

/** Kindle / Reflect open a skippable choice; skipping returns to the Haven. */
export function openHavenSelect(d: GameState, ctx: EngineCtx, which: 'kindle' | 'reflect'): void {
  const purpose = which === 'kindle' ? 'upgrade' : 'tend';
  openDeckSelect(d, purpose, selectOptions(d, ctx, purpose), d.phase, true, { kind: 'haven' });
}
