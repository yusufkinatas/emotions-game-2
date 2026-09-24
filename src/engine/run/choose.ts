// deckSelect 'choose' and 'skip': apply the purpose to the picked card, then follow the selection's origin.

import { rngFrom } from '../rng';
import type { GameState, Uid } from '../types';
import { duplicateCard, findCard, mirrorTransform, removeCard, tendCard, upgradeCard } from './deck';
import { runRunEffects } from './events';
import { settleService } from './shop';
import type { StepScratch } from './state';

export function chooseCard(d: GameState, sc: StepScratch, uid: Uid): GameState {
  if (d.phase.kind !== 'deckSelect') return d;
  const ph = d.phase;
  const card = findCard(d, uid);
  if (!card) return d;
  const ctx = sc.ctx;
  d.run.lastSelected = card.defId;
  switch (ph.purpose) {
    case 'remove':
      removeCard(d, uid);
      break;
    case 'upgrade':
      upgradeCard(d, uid);
      break;
    case 'duplicate':
      duplicateCard(d, ctx, uid);
      break;
    case 'tend':
      tendCard(d, ctx, uid);
      break;
    case 'transform': {
      const origin = ph.origin;
      const rng =
        origin?.kind === 'effects' ? rngFrom(origin.seed, 'transform') : rngFrom(d.seed, 'transform', uid, d.run.floor);
      mirrorTransform(d, ctx, uid, rng);
      sc.revealed = true;
      break;
    }
  }
  const origin = ph.origin;
  if (origin?.kind === 'haven') {
    d.phase = { kind: 'map' };
    return d;
  }
  if (origin?.kind === 'shop' && ph.then.kind === 'shop') settleService(d, ph.then.stock, origin.service, origin.price);
  d.phase = ph.then;
  if (origin?.kind === 'effects') return runRunEffects(d, sc, origin.continuation, origin.seed);
  return d;
}

export function skipSelect(d: GameState): void {
  if (d.phase.kind === 'deckSelect') d.phase = d.phase.then;
}
