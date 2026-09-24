// Draft values for card rewards, the wheel-closes pick and the Sanctuary (DESIGN 21.1 run policy):
// static card value + coverage bonuses (+6 cure of an upcoming Shade, +4 Tend of the heaviest Buried card,
// +2 adjacency with the deck's two most common Lights), and the policy bots' draft filters.

import {
  adjacent,
  lightIndex,
  LIGHTS,
  type CardDef,
  type CardId,
  type ContentPack,
  type EncounterId,
  type GameState,
  type Light,
  type Shade,
} from '../../src/engine/index';
import type { Belief } from './belief';
import { cardValue } from './cardValue';

/** Forced draft of a policy bot (21.1): which cards it may add, and a bias between the ones it may. */
export interface DraftPolicy {
  name: string;
  accepts(def: CardDef, s: GameState): boolean;
  bonus?(def: CardDef, s: GameState, pack: ContentPack): number;
  /**
   * Prefer Setting Down off-policy cards at Sanctuaries. Off for the v1 policy bots: they only restrict what
   * they add (pruning the starter's other Lights measured within 1 pp and costs Glimmers).
   */
  pruneOffPolicy: boolean;
}

const within = (lights: readonly Light[], allowed: readonly Light[]): boolean => lights.every((l) => allowed.includes(l));

/**
 * mono-<light>: that Light only (plus colourless neutral cards), and Blends containing it in The Deep's
 * Sanctuary (1.2, M10).
 */
export function monoPolicy(light: Light): DraftPolicy {
  return {
    name: `mono-${light}`,
    accepts: (def, s) =>
      def.lights.length === 0 || (def.lights.length === 1 && def.lights[0] === light) || (s.run.act === 3 && def.lights.includes(light)),
    pruneOffPolicy: false,
  };
}

/**
 * Cards whose Lights all lie inside a set of adjacent Lights (pair-delight = Love+Joy, arc3-love = Love, Joy,
 * Friendship), plus colourless neutral cards.
 */
export function setPolicy(name: string, allowed: readonly Light[]): DraftPolicy {
  return { name, accepts: (def) => def.lights.length === 0 || within(def.lights, allowed), pruneOffPolicy: false };
}

/** rainbow: any Light card, favouring the Lights the deck has least of. */
export const rainbowPolicy: DraftPolicy = {
  name: 'rainbow',
  accepts: (def) => def.lights.length > 0,
  bonus: (def, s, pack) => {
    const counts = easeByLight(s, pack);
    const max = Math.max(1, ...LIGHTS.map((l) => counts[l]));
    let best = 0;
    for (const l of def.lights) best = Math.max(best, 5 * (1 - counts[l] / max));
    return best;
  },
  pruneOffPolicy: false,
};

export function easeByLight(s: GameState, pack: ContentPack): Record<Light, number> {
  const out = { love: 0, joy: 0, friendship: 0, courage: 0, hope: 0, calm: 0 } as Record<Light, number>;
  for (const c of s.run.deck) {
    const d = pack.cards[c.defId];
    if (d?.kind !== 'ease') continue;
    for (const l of d.lights) out[l] += 1;
  }
  return out;
}

/** 12.2 two most common Lights (ease cards only, ties by wheel order). */
export function topLights(s: GameState, pack: ContentPack, n = 2): Light[] {
  const counts = easeByLight(s, pack);
  return [...LIGHTS].sort((a, b) => counts[b] - counts[a] || lightIndex(a) - lightIndex(b)).slice(0, n);
}

/** Mean static value of the deck's playable cards (the skip threshold of 21.1). */
export function deckAverage(s: GameState, pack: ContentPack): number {
  let sum = 0;
  let n = 0;
  for (const c of s.run.deck) {
    const d = pack.cards[c.defId];
    if (!d || d.kind === 'buried') continue;
    sum += cardValue(pack, c.defId, c.upgraded);
    n += 1;
  }
  return n > 0 ? sum / n : 0;
}

function facesOf(pack: ContentPack, enc: EncounterId | undefined): Shade[] {
  const out: Shade[] = [];
  for (const m of (enc ? pack.encounters[enc]?.members : undefined) ?? []) {
    for (const f of pack.enemies[m.enemy]?.faces ?? []) if (!out.includes(f)) out.push(f);
  }
  return out;
}

export interface Upcoming {
  shades: Set<Shade>;
  /** A numb-rules Shade (Apathy, The Numbness) is ahead: two-Light cards are FELT x2. */
  numb: boolean;
}

/** Shades on the remaining map rows of this act; after a boss, the next act's roster. */
export function upcoming(s: GameState, pack: ContentPack): Upcoming {
  const shades = new Set<Shade>();
  let numb = false;
  const add = (enc: EncounterId | undefined) => {
    const faces = facesOf(pack, enc);
    for (const f of faces) shades.add(f);
    for (const m of (enc ? pack.encounters[enc]?.members : undefined) ?? []) {
      if ((pack.enemies[m.enemy]?.faces.length ?? 1) === 0) numb = true;
    }
  };
  const ph = s.phase;
  const nextAct = ph.kind === 'reward' && ph.offer.then === 'wheelCloses' ? 2 : ph.kind === 'reward' && ph.offer.then === 'deep' ? 3 : ph.kind === 'wheelCloses' ? 2 : null;
  if (nextAct === 2) {
    const p = pack.pools.act2;
    for (const e of [...p.early, ...(p.row3 ?? []), ...p.standard, ...p.elite, p.boss]) add(e);
  } else if (nextAct === 3 || s.run.act === 3) {
    add(pack.pools.deep);
    for (const c of s.run.deck) {
      const sh = pack.cards[c.defId]?.buried?.shade;
      if (sh) shades.add(sh);
    }
  } else {
    const map = s.run.map;
    const row = map.current !== null ? (map.nodes[map.current]?.row ?? 0) : 0;
    for (const n of map.nodes) if (n.row > row && n.encounter) add(n.encounter.id);
  }
  return { shades, numb };
}

/** Ease cards in the deck that the belief thinks answer a Shade. */
export function believedAnswers(s: GameState, pack: ContentPack, b: Belief, shade: Shade): number {
  const cure = b.cureOf(shade);
  if (cure === null) return 0;
  let n = 0;
  for (const c of s.run.deck) {
    const d = pack.cards[c.defId];
    if (d?.kind === 'ease' && d.lights.includes(cure)) n += 1;
  }
  return n;
}

function heaviestBuried(s: GameState, pack: ContentPack): Shade | null {
  let best: Shade | null = null;
  let w = 0;
  for (const c of s.run.deck) {
    const sh = pack.cards[c.defId]?.buried?.shade;
    if (sh && (c.weight ?? 1) > w) {
      best = sh;
      w = c.weight ?? 1;
    }
  }
  return best;
}

/** Coverage bonus of 21.1 (flag draftsForCoverage), read through the belief's chart. */
export function coverageBonus(def: CardDef, s: GameState, pack: ContentPack, b: Belief, up: Upcoming): number {
  if (!b.draftsForCoverage || def.lights.length === 0) return 0;
  let bonus = 0;
  if (def.kind === 'ease') {
    let cure = 0;
    for (const sh of up.shades) {
      const l = b.cureOf(sh);
      if (l === null || !def.lights.includes(l)) continue;
      // Need-weighted: full bonus while the deck has few answers to that Shade.
      cure = Math.max(cure, believedAnswers(s, pack, b, sh) < 3 ? 6 : 2);
    }
    bonus += cure;
    if (up.numb && def.lights.length >= 2) bonus += s.run.act >= 3 ? 8 : 4;
  }
  const buried = heaviestBuried(s, pack);
  if (buried) {
    const l = b.cureOf(buried);
    if (l !== null && def.lights.includes(l)) bonus += 4;
  }
  if (b.knowsHarmony) {
    const top = topLights(s, pack);
    if (def.lights.some((l) => top.some((t) => t !== l && adjacent(t, l)))) bonus += 2;
  }
  return bonus;
}

/** Value of adding a card to the deck under a belief and draft policy, or null if the policy refuses it. */
export function offerValue(
  id: CardId,
  s: GameState,
  pack: ContentPack,
  b: Belief,
  policy: DraftPolicy | null,
  up: Upcoming,
  upgraded = false,
): number | null {
  const def = pack.cards[id];
  if (!def) return null;
  if (policy && !policy.accepts(def, s)) return null;
  return cardValue(pack, id, upgraded) + coverageBonus(def, s, pack, b, up) + (policy?.bonus?.(def, s, pack) ?? 0);
}
