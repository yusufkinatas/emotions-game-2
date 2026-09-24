// Card faces built from content definitions for every non-combat screen (rewards, shop, deck views).
// Rules text always comes from the engine (describeCard); the kit only draws it.

import type { CardDef, CardId, CardInstance, Engine, Light, Shade } from '../../engine/index';
import { adjacent, blendOfLights, dissonantShadeOf, LIGHTS, shadeCuredBy } from '../../engine/index';
import type { CardFaceProps } from '../kit/cardFace';
import { cardFaceMarkup } from '../kit/cardFace';
import { BLEND_NAME, LIGHT_NAME, SHADE_NAME } from '../kit/names';
import { toElement } from '../kit/svg';

const KIND_WORD: Record<CardDef['kind'], string> = { ease: 'Ease', skill: 'Skill', mood: 'Mood', buried: 'Buried' };

export const isInsightDef = (d: CardDef): boolean => d.insightOf !== undefined;

/** Printed cost of a definition (upgrades may change it); null for Unplayable. */
export function printedCost(def: CardDef, upgraded: boolean): number | null {
  if (def.cost === 'unplayable') return null;
  return upgraded && def.upgrade?.cost !== undefined ? def.upgrade.cost : def.cost;
}

/** Can this definition be upgraded at all (has upgrade data and is not already upgraded)? */
export const hasUpgrade = (def: CardDef): boolean => def.upgrade !== undefined;

/** "Love", "Delight (Love and Joy)", "Neutral", "Buried Anger", "Insight". */
export function lightWord(def: CardDef): string {
  if (def.buried) return `Buried ${SHADE_NAME[def.buried.shade]}`;
  if (def.lights.length === 0) return 'Neutral';
  if (def.lights.length === 2) {
    const b = blendOfLights(def.lights);
    return b ? BLEND_NAME[b] : def.lights.map((l) => LIGHT_NAME[l]).join(' and ');
  }
  return LIGHT_NAME[def.lights[0]!];
}

export interface CardView {
  defId: CardId;
  upgraded: boolean;
  weight?: number;
  uid?: number;
}

export const viewOf = (c: CardInstance): CardView => ({
  defId: c.defId,
  upgraded: c.upgraded,
  weight: c.weight,
  uid: c.uid,
});

/** Face props for a card definition (with engine text). `extra` overrides anything. */
export function cardProps(engine: Engine, v: CardView, extra: Partial<CardFaceProps> = {}): CardFaceProps {
  const def = engine.pack.cards[v.defId];
  if (!def) {
    return { name: v.defId, lights: [], cost: null, kindLabel: 'Card', text: '', rarity: 'common', ...extra };
  }
  const text = engine.describeCard(v.defId, v.upgraded, v.weight);
  const insight = isInsightDef(def);
  const cost = printedCost(def, v.upgraded);
  const name = def.name;
  const aria = [
    `${name}${v.upgraded ? ' upgraded' : ''}`,
    lightWord(def),
    cost === null ? 'unplayable' : `cost ${cost}`,
    def.buried && v.weight ? `Weight ${v.weight}` : null,
  ]
    .filter(Boolean)
    .join(', ');
  return {
    name,
    lights: def.lights,
    cost,
    kindLabel: insight ? 'Insight' : KIND_WORD[def.kind],
    text,
    rarity: def.rarity,
    upgraded: v.upgraded,
    ...(def.buried ? { buried: { weight: v.weight ?? 1, shade: def.buried.shade } } : {}),
    ...(insight ? { insight: true } : {}),
    ariaLabel: `${aria}. ${text}`,
    ...extra,
  };
}

export function cardMarkup(engine: Engine, v: CardView, extra: Partial<CardFaceProps> = {}): string {
  return cardFaceMarkup(cardProps(engine, v, extra));
}

/** A card face element; pass tag 'button' in `extra` for a clickable card. Call fitCards after mounting. */
export function cardElement(engine: Engine, v: CardView, extra: Partial<CardFaceProps> = {}): HTMLElement {
  return toElement<HTMLElement>(cardMarkup(engine, v, extra));
}

// ------------------------------------------------------------------------------------------------
// What a card means for the wheel (reward and shop lines, DESIGN 16.5). Derived from printed Lights only.
// ------------------------------------------------------------------------------------------------

export interface WheelLines {
  /** Shades this card answers (OPPOSITE x2). */
  answers: Shade[];
  /** Lights a Note would Harmonize it with. */
  harmonizes: Light[];
  /** The Shade a mono-Light card is DISSONANT against (Blends never are). */
  dissonant: Shade | null;
  /** Buried Shades in the deck this card could Tend Inward. */
  tends: Shade[];
}

export function wheelLines(def: CardDef, deckBuried: readonly Shade[]): WheelLines {
  const lights = def.lights;
  const answers = lights.map(shadeCuredBy);
  const harmonizes = LIGHTS.filter((l) => !lights.includes(l) && lights.some((own) => adjacent(own, l)));
  const dissonant = lights.length === 1 ? dissonantShadeOf(lights[0]!) : null;
  const tends = answers.filter((s) => deckBuried.includes(s));
  return { answers, harmonizes, dissonant, tends };
}

/** Buried Shades currently in the run deck. */
export function buriedShades(engine: Engine, deck: readonly CardInstance[]): Shade[] {
  const out: Shade[] = [];
  for (const c of deck) {
    const s = engine.pack.cards[c.defId]?.buried?.shade;
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}
