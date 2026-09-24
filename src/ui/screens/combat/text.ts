// Display text for the combat screen, built only from engine views and content data.
// Nothing here computes a rule: it names, formats and joins what the engine already decided.

import type {
  AfflictionId,
  CardDef,
  ContentPack,
  Effect,
  EnemyDef,
  EnemyState,
  HitBreakdown,
  IntentView,
  Light,
  Relation,
  Shade,
  StatusBag,
} from '../../../engine/types';
import type { IntentItem, StatusChipProps } from '../../kit/widgets';
import { LIGHT_NAME, SHADE_NAME } from '../../kit/names';
import { FLAG_CHIPS } from '../../../content/index';
import { MEM_TURNS_LEFT } from '../../../engine/index';


export const lightNames = (lights: readonly Light[]): string => lights.map((l) => LIGHT_NAME[l]).join(' and ');

export function cardName(def: CardDef | undefined, upgraded: boolean): string {
  return (def?.name ?? 'Card') + (upgraded ? '+' : '');
}

/** Footer kind word for a card face. */
export function kindLabel(def: CardDef): string {
  if (def.insightOf) return 'Insight';
  switch (def.kind) {
    case 'ease':
      return 'Ease';
    case 'skill':
      return 'Skill';
    case 'mood':
      return 'Mood';
    default:
      return 'Buried';
  }
}

/** The relation word the Play Line and callouts use ("OPPOSITE x2", "DISSONANT x1/2"). */
export function relationLabel(b: Pick<HitBreakdown, 'relation' | 'typePct'>): string {
  switch (b.relation) {
    case 'opposite':
      return 'OPPOSITE x2';
    case 'dissonant':
      return b.typePct >= 100 ? 'DISSONANT x1' : 'DISSONANT x1/2';
    case 'felt':
      return 'FELT x2';
    case 'muffled':
      return 'MUFFLED x1/2';
    case 'veiled':
      return 'VEILED';
    default:
      return 'x1';
  }
}

export const isUpRelation = (r: Relation): boolean => r === 'opposite' || r === 'felt';
export const isDownRelation = (r: Relation): boolean => r === 'dissonant' || r === 'muffled' || r === 'veiled';

/** Status tooltip from its StatusDef template. */
export function statusTip(pack: ContentPack, id: string, n: number): string {
  const def = pack.statuses[id];
  return def ? def.text.replaceAll('{n}', String(n)) : `${id} ${n}`;
}

/** Gauges whose tooltip reads "{n}/6" show their cap too ("Pressure 4/6"). */
function statusValue(pack: ContentPack, id: string, n: number): string | number | undefined {
  const def = pack.statuses[id];
  if (!def || def.polarity === 'flag') return undefined;
  if (def.polarity === 'gauge' && def.max !== undefined && def.text.includes('{n}/')) return `${n}/${def.max}`;
  return n;
}

const byStacks = (bag: StatusBag): [string, number][] =>
  Object.entries(bag).filter((e): e is [string, number] => typeof e[1] === 'number' && e[1] > 0);

/** Player chips: afflictions first (drop icons), then buffs and other statuses. */
export function playerChips(pack: ContentPack, bag: StatusBag): StatusChipProps[] {
  const afflictions: StatusChipProps[] = [];
  const rest: StatusChipProps[] = [];
  for (const [id, n] of byStacks(bag)) {
    const def = pack.statuses[id];
    if (!def) continue;
    const title = statusTip(pack, id, n);
    if (def.affliction) afflictions.push({ kind: 'affliction', affliction: def.affliction, label: def.name, value: n, title });
    else rest.push({ kind: def.polarity === 'debuff' ? 'debuff' : 'buff', label: def.name, value: n, title });
  }
  return [...afflictions, ...rest];
}

/** Nameplate row 4: Flare, gauges, The Mask's turns, passives and flags (Wavering sits at the feet). */
export function shadeChips(pack: ContentPack, e: EnemyState, def: EnemyDef): StatusChipProps[] {
  const chips: StatusChipProps[] = [];
  const order = (id: string): number => (id === 'flare' ? 0 : pack.statuses[id]?.polarity === 'gauge' ? 1 : 2);
  // A passive named like one of the Shade's gauges ("Pressure") is shown as that gauge, even at 0.
  const gaugeOf = (name: string) =>
    Object.values(pack.statuses).find((sd) => sd.owner === 'enemy' && sd.polarity === 'gauge' && sd.name === name);
  const bag: StatusBag = { ...e.statuses };
  for (const p of def.passives ?? []) {
    const g = gaugeOf(p.name);
    if (g && bag[g.id] === undefined) bag[g.id] = g.min ?? 0;
  }
  const entries = Object.entries(bag)
    .filter((x): x is [string, number] => typeof x[1] === 'number' && (x[1] > 0 || pack.statuses[x[0]]?.polarity === 'gauge'))
    .filter(([id]) => id !== 'wavering')
    .sort((a, b) => order(a[0]) - order(b[0]));
  for (const [id, n] of entries) {
    const sd = pack.statuses[id];
    if (!sd) continue;
    const kind = sd.polarity === 'gauge' ? 'gauge' : sd.polarity === 'flag' ? 'flag' : sd.polarity === 'debuff' ? 'debuff' : 'buff';
    const value = statusValue(pack, id, n);
    chips.push({ kind, label: sd.name, ...(value !== undefined ? { value } : {}), title: statusTip(pack, id, n) });
  }
  if (def.maxTurnsPerPlayerTurn !== undefined) {
    const left = e.memory[MEM_TURNS_LEFT] ?? def.maxTurnsPerPlayerTurn;
    chips.push({
      kind: 'gauge',
      label: 'Turns left',
      value: left,
      title: `Turns left ${left}: your hits can turn its face ${left} more time${left === 1 ? '' : 's'} this turn.`,
    });
  }
  const seen = new Set<string>();
  for (const p of def.passives ?? []) {
    if (seen.has(p.name) || gaugeOf(p.name)) continue;
    seen.add(p.name);
    const text = def.passives?.find((x) => x.name === p.name && x.text)?.text;
    chips.push({ kind: 'flag', label: p.name, ...(text ? { title: `${p.name}: ${text}` } : {}) });
  }
  if (def.shy) chips.push({ kind: 'flag', label: FLAG_CHIPS.shy.name, title: FLAG_CHIPS.shy.text });
  if (e.fleeting) chips.push({ kind: 'flag', label: FLAG_CHIPS.fleeting.name, title: FLAG_CHIPS.fleeting.text });
  return chips;
}

/** Intent pill items from the engine's IntentView. */
export function intentItems(iv: IntentView): IntentItem[] {
  const items: IntentItem[] = [];
  for (const k of iv.kinds) {
    if (k === 'strike' && iv.strikes) items.push({ kind: 'strike', value: iv.strikes.perStrike, count: iv.strikes.count });
    else if (k === 'guard') items.push(iv.guard !== null ? { kind: 'guard', value: iv.guard } : { kind: 'guard' });
    else if (k === 'afflict') {
      for (const a of iv.afflicts) items.push({ kind: 'afflict', affliction: a.id as AfflictionId | 'numb', stacks: a.stacks });
    } else if (k !== 'strike') items.push({ kind: k });
  }
  return items;
}

export function intentTitle(iv: IntentView): string {
  return iv.projectedReason ? `${iv.text} ${iv.projectedReason}` : iv.text;
}

/** Total strike damage an intent shows (per strike x count). */
export const intentStrikeTotal = (iv: IntentView | null | undefined): number =>
  iv?.strikes ? iv.strikes.perStrike * iv.strikes.count : 0;

/** A short phrase for the primary number of a content effect ("Ease 8", "+5 Guard", "draw 1"). */
function effectPhrase(pack: ContentPack, e: Effect): string | null {
  const num = (a: unknown): number | null => (typeof a === 'number' ? a : null);
  switch (e.op) {
    case 'hit': {
      const n = num(e.amount);
      return n !== null ? `Ease ${n}${e.to === 'all' ? ' to all' : ''}` : 'Ease';
    }
    case 'guard': {
      const n = num(e.amount);
      return n !== null ? `+${n} Guard` : 'Guard';
    }
    case 'mend': {
      const n = num(e.amount);
      return n !== null ? `Mend ${n}` : 'Mend';
    }
    case 'draw': {
      const n = num(e.n);
      return n !== null ? `draw ${n}` : 'draw';
    }
    case 'energy': {
      const n = num(e.n);
      return n !== null ? `+${n} Spirit` : 'Spirit';
    }
    case 'status': {
      const n = num(e.stacks);
      const name = pack.statuses[e.id]?.name ?? e.id;
      return n !== null ? `${n > 0 ? '+' : ''}${n} ${name}` : name;
    }
    case 'summon':
      return `${pack.companions[e.companion]?.name ?? 'a Companion'} joins you`;
    case 'if':
      return effectPhrase(pack, e.then[0] as Effect);
    default:
      return null;
  }
}

/** One line describing a Promise's content effects: "+5 Guard, draw 1". */
export function promiseText(pack: ContentPack, effects: readonly Effect[]): string {
  const bits = effects.map((e) => effectPhrase(pack, e)).filter((x): x is string => !!x);
  return bits.length ? bits.join(', ') : 'Something good';
}

/** True if a card's effects (any depth) summon a Companion. */
export function cardSummons(def: CardDef | undefined): boolean {
  if (!def) return false;
  const walk = (list: readonly Effect[] | undefined): boolean =>
    !!list?.some((e) => e.op === 'summon' || (e.op === 'if' && (walk(e.then) || walk(e.else))) || (e.op === 'promise' && walk(e.effects)));
  return walk(def.effects) || walk(def.upgrade?.effects);
}

export const shadeName = (s: Shade): string => SHADE_NAME[s];

/** Deterministic pick from a list (barks), varied by uid. */
export function pickLine(lines: readonly string[], uid: number): string | null {
  if (!lines.length) return null;
  return lines[Math.abs(uid * 31 + 7) % lines.length] ?? null;
}

/** Numbers in a text, in order, for contextual trend triangles. */
export const numbersIn = (text: string): number[] => (text.match(/\d+/g) ?? []).map(Number);
