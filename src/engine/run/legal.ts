// Legal actions for every non-combat phase, in canonical order (DESIGN 20.6).

import type { Action, EngineCtx, GameState } from '../types';
import { eventOptions } from './events';
import { havenOptions } from './haven';
import { reachableNodes } from './map';
import { canBuy, canRemoveService, canTalkService } from './shop';

export function runLegalActions(s: GameState, ctx: EngineCtx): Action[] {
  const ph = s.phase;
  switch (ph.kind) {
    case 'charmSelect':
      return ph.options.map((_, i): Action => ({ t: 'pickCharm', i }));
    case 'map':
      return reachableNodes(s.run.map).map((node): Action => ({ t: 'move', node }));
    case 'combat':
      return [];
    case 'reward': {
      const o = ph.offer;
      const out: Action[] = [];
      if (!o.taken.keepsake && o.keepsakes.length > 0) {
        if (o.keepsakeChoice) o.keepsakes.forEach((_, i) => out.push({ t: 'takeKeepsake', i }));
        else out.push({ t: 'takeKeepsake', i: 0 });
      }
      if (!o.taken.card && o.cards.length > 0) {
        o.cards.forEach((_, i) => out.push({ t: 'takeCard', i }));
        out.push({ t: 'skip' });
      }
      out.push({ t: 'continue' });
      return out;
    }
    case 'wheelCloses':
      return [...ph.options.map((_, i): Action => ({ t: 'takeCard', i })), { t: 'skip' }];
    case 'shop': {
      const out: Action[] = [];
      ph.stock.items.forEach((item, slot) => {
        if (canBuy(s, item)) out.push({ t: 'buy', slot });
      });
      if (canRemoveService(s, ph.stock)) out.push({ t: 'service', id: 'remove' });
      if (canTalkService(s, ctx, ph.stock)) out.push({ t: 'service', id: 'talk' });
      out.push({ t: 'leave' });
      return out;
    }
    case 'haven': {
      const out: Action[] = [];
      for (const o of havenOptions(s, ctx)) if (o.available) out.push({ t: o.id });
      // Every option can be unavailable (Spiral Shell, all upgraded, nothing Buried): walking on is then allowed.
      if (out.length === 0) out.push({ t: 'leave' });
      return out;
    }
    case 'event': {
      if (ph.chosen !== null) return [{ t: 'continue' }];
      const out: Action[] = [];
      eventOptions(s, ctx).forEach((o, i) => {
        if (o.enabled) out.push({ t: 'option', i });
      });
      if (out.length === 0) out.push({ t: 'continue' });
      return out;
    }
    case 'deckSelect': {
      const out: Action[] = ph.options.map((uid): Action => ({ t: 'choose', uid }));
      if (ph.skippable || ph.options.length === 0) out.push({ t: 'skip' });
      return out;
    }
    case 'victory':
    case 'defeat':
      return [];
  }
}
