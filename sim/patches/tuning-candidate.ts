// Tuning experiment (not content): the card and Charm number changes suggested in docs/balance-report.md,
// applied to an in-memory copy of the pack. Run with
//   npx vite-node sim/parallel.ts -- --bots all --runs 500 --patch sim/patches/tuning-candidate.ts --scale <stage-1 scale>
// Stage-1 enemy scaling is passed separately with --scale so each stage can be measured on its own.

import type { CardDef, ContentPack, Effect, KeepsakeDef } from '../../src/engine/index';

/** Replace the numeric amount of the first `hit` effect (and of the upgrade's). */
function setHit(def: CardDef, base: number, upgraded: number): CardDef {
  const swap = (effects: readonly Effect[], n: number): Effect[] => {
    let done = false;
    return effects.map((e) => {
      if (!done && e.op === 'hit' && typeof e.amount === 'number') {
        done = true;
        return { ...e, amount: n };
      }
      return e;
    });
  };
  const upgrade = def.upgrade?.effects ? { ...def.upgrade, effects: swap(def.upgrade.effects, upgraded) } : def.upgrade;
  return { ...def, effects: swap(def.effects, base), upgrade };
}

/** Replace the amount of a Keepsake hook's first effect (Mend 8 -> 5, Nerve 1 -> 2, next_draw 2 -> 3). */
function setHookAmount(def: KeepsakeDef, trigger: 'combatWon' | 'combatStart', n: number): KeepsakeDef {
  const hook = def.on?.[trigger];
  if (!hook) return def;
  const [first, ...rest] = hook.effects;
  if (!first) return def;
  const changed: Effect =
    first.op === 'mend' ? { ...first, amount: n } : first.op === 'status' ? { ...first, stacks: n } : first;
  return { ...def, on: { ...def.on, [trigger]: { ...hook, effects: [changed, ...rest] } } };
}

export function patch(pack: ContentPack): ContentPack {
  const cards = { ...pack.cards };
  const keepsakes = { ...pack.keepsakes };
  // Neutral Push It Down out-damages every typed starter (lab: the neutral-only control beats mono and pair decks).
  if (cards['neutral.push_it_down']) cards['neutral.push_it_down'] = setHit(cards['neutral.push_it_down'], 7, 10);
  // Charm spread: Warm Locket is far ahead of Brave Pebble.
  if (keepsakes['ks.warm_locket']) keepsakes['ks.warm_locket'] = setHookAmount(keepsakes['ks.warm_locket'], 'combatWon', 5);
  if (keepsakes['ks.brave_pebble']) keepsakes['ks.brave_pebble'] = setHookAmount(keepsakes['ks.brave_pebble'], 'combatStart', 2);
  // With the two above, Sun Charm becomes the weakest: draw 3 extra on turn 1 instead of 2.
  if (keepsakes['ks.sun_charm']) keepsakes['ks.sun_charm'] = setHookAmount(keepsakes['ks.sun_charm'], 'combatStart', 3);
  return { ...pack, cards, keepsakes };
}
