// Move builder: the intent icons are derived from the effects so they can never disagree with what resolves.

import type { Effect, IntentKind, MoveDef } from '../../engine/types';

function intentOf(e: Effect): IntentKind | null {
  switch (e.op) {
    case 'strike':
      return 'strike';
    case 'guard':
      return 'guard';
    case 'afflict':
      return 'afflict';
    case 'mend':
      return 'mend';
    case 'spawn':
      return 'summon';
    case 'scatter':
      return 'scatter';
    case 'status':
      // Flare or a gauge going up is a buff. Resets (setStatus) and marks are bookkeeping, not intents.
      return typeof e.stacks === 'number' && e.stacks > 0 ? 'buff' : null;
    default:
      return null;
  }
}

export function intentsOf(effects: readonly Effect[]): IntentKind[] {
  const kinds: IntentKind[] = [];
  for (const e of effects) {
    const k = intentOf(e);
    if (k && !kinds.includes(k)) kinds.push(k);
  }
  return kinds;
}

export const move = (name: string, ...effects: Effect[]): MoveDef => ({ name, intent: intentsOf(effects), effects });
