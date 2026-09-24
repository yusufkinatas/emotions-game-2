// Card faces built from content definitions for every non-combat screen (rewards, shop, deck views).
// Rules text always comes from the engine (describeCard); the kit only draws it.

import type { CardDef, CardId, CardInstance, Engine, Light, Shade } from '../../engine/index';
import { adjacent, blendOfLights, dissonantShadeOf, LIGHTS, shadeCuredBy } from '../../engine/index';
import type { CardFaceProps } from '../kit/cardFace';
import { cardFaceMarkup } from '../kit/cardFace';
import { BLEND_NAME, LIGHT_NAME, SHADE_NAME } from '../kit/names';
import { toElement } from '../kit/svg';
import { sigil } from '../kit/sigils';

const KIND_WORD: Record<CardDef['kind'], string> = { ease: 'Ease', skill: 'Skill', mood: 'Mood', buried: 'Buried' };

export const isInsightDef = (d: CardDef): boolean => d.insightOf !== undefined;

/** Printed cost of a definition (upgrades may change it); null for Unplayable. */
export function printedCost(def: CardDef, upgraded: boolean): number | null {
  if (def.cost === 'unplayable') return null;
  return upgraded && def.upgrade?.cost !== undefined ? def.upgrade.cost : def.cost;
}

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

// ------------------------------------------------------------------------------------------------
// Card choice row (rewards, the wheel closes): cards at 1.4x with their wheel lines underneath.
// ------------------------------------------------------------------------------------------------

function lineEl(label: string, parts: (Node | string)[], cls = ''): HTMLElement {
  const el = document.createElement('div');
  el.className = `choice-line ${cls}`.trim();
  const b = document.createElement('span');
  b.className = 'choice-line__label';
  b.textContent = label;
  const values = document.createElement('span');
  values.className = 'choice-line__values';
  values.append(...parts);
  el.append(b, values);
  return el;
}

function shadeTag(s: Shade, suffix = ''): HTMLElement {
  const el = document.createElement('span');
  el.className = 'shade-tag';
  el.dataset.face = s;
  el.innerHTML = `${sigil(s)}<span>${SHADE_NAME[s]}${suffix}</span>`;
  return el;
}

function lightTag(l: Light): HTMLElement {
  const el = document.createElement('span');
  el.className = 'light-tag';
  el.dataset.light = l;
  el.innerHTML = `${sigil(l)}<span>${LIGHT_NAME[l]}</span>`;
  return el;
}

/** The lines under a reward card (16.5): Answers, Harmonizes with, DISSONANT vs, Tends. */
export function wheelLinesElement(def: CardDef, deckBuried: readonly Shade[]): HTMLElement {
  const w = wheelLines(def, deckBuried);
  const box = document.createElement('div');
  box.className = 'choice-lines';
  if (def.lights.length === 0) {
    box.append(lineEl('No Light:', [' x1 against every Shade. Never changes the Note.'], 'choice-line--neutral'));
    return box;
  }
  box.append(lineEl('Answers:', w.answers.map((s) => shadeTag(s, ' x2')), 'choice-line--answers'));
  if (w.harmonizes.length) box.append(lineEl('Harmonizes with:', w.harmonizes.map(lightTag), 'choice-line--harmony'));
  if (w.dissonant) box.append(lineEl('DISSONANT vs:', [shadeTag(w.dissonant, ' x1/2')], 'choice-line--dissonant'));
  else box.append(lineEl('Two Lights:', [' never DISSONANT'], 'choice-line--blend'));
  for (const s of w.tends) box.append(lineEl('Tends:', [`Buried ${SHADE_NAME[s]}`], 'choice-line--tends'));
  return box;
}

export interface CardChoiceOptions {
  engine: Engine;
  cards: readonly CardId[];
  deck: readonly CardInstance[];
  /** Index taken already (drawn chosen), or null. `locked` greys every card (taken or skipped). */
  takenIndex: number | null;
  locked: boolean;
  onTake: (i: number) => void;
  onHover?: (def: CardDef | null) => void;
  /** Upgraded offers (none in v1, but the engine may send them). */
  upgraded?: boolean;
}

/** A row of reward cards as buttons, keyed 1-4, each with its wheel lines. */
export function cardChoiceRow(o: CardChoiceOptions): HTMLElement {
  const row = document.createElement('div');
  row.className = 'card-choice';
  row.setAttribute('role', 'list');
  const deckBuried = buriedShades(o.engine, o.deck);
  o.cards.forEach((id, i) => {
    const def = o.engine.pack.cards[id];
    if (!def) return;
    const taken = o.takenIndex === i;
    const cell = document.createElement('div');
    cell.className = `card-choice__cell${taken ? ' is-taken' : ''}${o.locked && !taken ? ' is-passed' : ''}`;
    cell.setAttribute('role', 'listitem');
    cell.style.setProperty('--i', String(i));
    const props = cardProps(o.engine, { defId: id, upgraded: !!o.upgraded });
    const face = cardElement(o.engine, { defId: id, upgraded: !!o.upgraded }, {
      tag: 'button',
      className: 'card-face--large card-choice__card',
      state: taken ? 'selected' : 'idle',
      ariaLabel: `${i + 1}. Take ${props.ariaLabel ?? def.name}`,
    });
    if (o.locked) {
      face.setAttribute('aria-disabled', 'true');
      face.tabIndex = -1;
    } else {
      face.addEventListener('click', () => o.onTake(i));
    }
    face.addEventListener('pointerenter', () => o.onHover?.(def));
    face.addEventListener('pointerleave', () => o.onHover?.(null));
    face.addEventListener('focus', () => o.onHover?.(def));
    face.addEventListener('blur', () => o.onHover?.(null));
    const key = document.createElement('span');
    key.className = 'kbd card-choice__key';
    key.setAttribute('aria-hidden', 'true');
    key.textContent = String(i + 1);
    cell.append(key, face, wheelLinesElement(def, deckBuried));
    if (taken) {
      const tag = document.createElement('span');
      tag.className = 'card-choice__taken caps';
      tag.textContent = 'Added to your deck';
      cell.append(tag);
    }
    row.append(cell);
  });
  return row;
}
