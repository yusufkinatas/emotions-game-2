// Run-side views (DESIGN 16.4, 12.2, 4.16): node detail, deck summary, most common Light, Numbness meter.

import {
  AFFLICTION_OF,
  BLENDS,
  blendOf,
  cureOf,
  dissonantLightOf,
  LIGHTS,
  lightIndex,
  shadeIndex,
} from '../emotions';
import type {
  AfflictionId,
  Blend,
  CardInstance,
  DeckSummary,
  EngineCtx,
  GameState,
  Light,
  MapNode,
  NodeDetail,
  Shade,
  Uid,
} from '../types';
import { isBuried, isInsight } from './cards';
import { capitalize, cardDef } from './state';

const zeroLights = (): Record<Light, number> => {
  const out = {} as Record<Light, number>;
  for (const l of LIGHTS) out[l] = 0;
  return out;
};

/** 12.2 / minor-25: only `ease` cards count, by printed Light (a Blend counts for both). */
export function easeCounts(deck: readonly CardInstance[], ctx: EngineCtx): Record<Light, number> {
  const out = zeroLights();
  for (const c of deck) {
    const d = cardDef(ctx, c.defId);
    if (d.kind !== 'ease') continue;
    for (const l of d.lights) out[l] += 1;
  }
  return out;
}

/** All six Lights, most common first, ties by wheel order. */
export function mostCommonLights(counts: Record<Light, number>): Light[] {
  return [...LIGHTS].sort((a, b) => counts[b] - counts[a] || lightIndex(a) - lightIndex(b));
}

/** Buried cards by Surfacing order: heaviest first, ties by wheel order of the Shade. */
export function buriedBySurfacing(deck: readonly CardInstance[], ctx: EngineCtx): CardInstance[] {
  const shadeOf = (c: CardInstance): Shade => cardDef(ctx, c.defId).buried!.shade;
  return deck
    .filter((c) => {
      const d = cardDef(ctx, c.defId);
      return isBuried(d) && d.buried !== undefined;
    })
    .sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1) || shadeIndex(shadeOf(a)) - shadeIndex(shadeOf(b)));
}

/** The final boss's numb rules (how many Buried cards surface, Intensity per hidden Weight). */
function finalNumbRules(ctx: EngineCtx): { surface: number; hpPerHiddenWeight: number } {
  for (const m of ctx.pack.encounters[ctx.pack.pools.deep]?.members ?? []) {
    const rules = ctx.pack.enemies[m.enemy]?.numbRules;
    if (rules) return rules;
  }
  return { surface: 3, hpPerHiddenWeight: 0 };
}

export function deckSummary(s: GameState, ctx: EngineCtx): DeckSummary {
  const byLight = zeroLights();
  const byBlend = {} as Record<Blend, number>;
  for (const b of BLENDS) byBlend[b] = 0;
  let neutral = 0;
  let buried = 0;
  let insight = 0;
  let buriedWeight = 0;
  for (const c of s.run.deck) {
    const d = cardDef(ctx, c.defId);
    if (isBuried(d)) {
      buried += 1;
      buriedWeight += c.weight ?? 1;
    } else if (isInsight(d)) insight += 1;
    else if (d.lights.length === 0) neutral += 1;
    else if (d.lights.length === 1) byLight[d.lights[0]!] += 1;
    else {
      const b = blendOf(d.lights[0]!, d.lights[1]!);
      if (b) byBlend[b] += 1;
    }
  }
  const easeByLight = easeCounts(s.run.deck, ctx);
  const order = buriedBySurfacing(s.run.deck, ctx);
  const numb = finalNumbRules(ctx);
  const surfacing = order.slice(0, numb.surface);
  const hiddenWeight = order.slice(numb.surface).reduce((a, c) => a + (c.weight ?? 1), 0);
  return {
    total: s.run.deck.length,
    byLight,
    byBlend,
    neutral,
    buried,
    insight,
    easeByLight,
    mostCommon: mostCommonLights(easeByLight),
    buriedWeight,
    numbness:
      order.length === 0
        ? null
        : {
            willSurface: surfacing.map((c): Uid => c.uid),
            hiddenWeight,
            hiddenIntensity: hiddenWeight * numb.hpPerHiddenWeight,
          },
  };
}

const KIND_LABEL: Record<MapNode['kind'], string> = {
  fight: 'Fight',
  elite: 'Elite',
  boss: 'Boss',
  haven: 'Haven',
  sanctuary: 'Sanctuary',
  memory: 'Memory',
  chest: 'Chest',
};

function rewardsOf(node: MapNode, act: number): string[] {
  switch (node.kind) {
    case 'fight':
      return ['card', 'Glimmers'];
    case 'elite':
      return ['card', 'Keepsake', 'Glimmers'];
    case 'boss':
      return act === 3 ? [] : ['rare card', 'boss Keepsake', 'Glimmers'];
    case 'chest':
      return ['Keepsake'];
    case 'haven':
      return ['Rest, Kindle or Reflect'];
    case 'sanctuary':
      return ['cards', 'Keepsakes', 'services'];
    case 'memory':
      return [];
  }
}

const plural = (n: number): string => `${n} card${n === 1 ? '' : 's'}`;

/** 16.4 node detail card, computed from the pre-rolled encounter and the current deck. */
export function nodeDetail(s: GameState, ctx: EngineCtx, nodeId: number): NodeDetail {
  const node = s.run.map.nodes.find((n) => n.id === nodeId);
  if (!node) throw new Error(`Unknown map node ${nodeId}`);
  const label = KIND_LABEL[node.kind];
  const rewards = rewardsOf(node, s.run.act);
  const rewardText = rewards.length > 0 ? ` Rewards: ${rewards.join(', ')}.` : '';

  if (!node.encounter) {
    const text =
      node.kind === 'memory' ? 'Memory: something from before is waiting here.' : `${label}.${rewardText}`;
    return { kind: node.kind, shades: [], names: [], afflictions: [], deckAnswers: [], rewards, text };
  }

  const enc = ctx.pack.encounters[node.encounter.id];
  const members = enc?.members ?? [];
  const defs = members.map((m) => ctx.pack.enemies[m.enemy]);
  const shades = defs.map((d) => [...(d?.faces ?? [])]);
  const names = defs.map((d, i) => d?.name ?? members[i]!.enemy);
  const faces: Shade[] = [];
  for (const fs of shades) for (const f of fs) if (!faces.includes(f)) faces.push(f);
  const afflictions: AfflictionId[] = [];
  for (const f of faces) if (!afflictions.includes(AFFLICTION_OF[f])) afflictions.push(AFFLICTION_OF[f]);

  const deckAnswers = faces.map((shade) => {
    let opposite = 0;
    let dissonant = 0;
    const bad = dissonantLightOf(shade, ctx.rules);
    for (const c of s.run.deck) {
      const d = cardDef(ctx, c.defId);
      if (d.kind !== 'ease') continue;
      if (d.lights.includes(cureOf(shade))) opposite += 1;
      else if (d.lights.length === 1 && d.lights[0] === bad) dissonant += 1;
    }
    return { shade, opposite, dissonant };
  });

  const afflictionName = (a: AfflictionId): string => ctx.pack.statuses[a]?.name ?? capitalize(a);
  const parts: string[] = [];
  parts.push(`${label}: ${faces.length > 0 ? faces.map(capitalize).join(' + ') : names.join(' + ')}.`);
  for (const f of faces) parts.push(`${capitalize(f)} inflicts ${afflictionName(AFFLICTION_OF[f])}.`);
  defs.forEach((d, i) => {
    if (d && d.faces.length === 0) parts.push(`${names[i]} is Muffled: only two Lights at once are FELT.`);
  });
  if (deckAnswers.length > 0) {
    const bits: string[] = [];
    for (const a of deckAnswers) {
      bits.push(`${plural(a.opposite)} OPPOSITE to ${capitalize(a.shade)} (${capitalize(cureOf(a.shade))})`);
    }
    for (const a of deckAnswers) {
      if (a.dissonant > 0) {
        bits.push(`${plural(a.dissonant)} DISSONANT to ${capitalize(a.shade)} (${capitalize(dissonantLightOf(a.shade, ctx.rules))})`);
      }
    }
    parts.push(`Your deck: ${bits.join(', ')}.`);
  }
  return {
    kind: node.kind,
    shades,
    names,
    afflictions,
    deckAnswers,
    rewards,
    text: parts.join(' ') + rewardText,
  };
}
