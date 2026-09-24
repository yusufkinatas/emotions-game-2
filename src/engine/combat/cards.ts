// Card definition accessors that apply the upgrade block (DESIGN 6.0: "upgrade: only what changes").

import type { CardDef, Countable, Effect, Keyword, MoodDef } from '../types';

export function cardCost(def: CardDef, upgraded: boolean): number | 'unplayable' {
  if (def.cost === 'unplayable') return 'unplayable';
  return upgraded && def.upgrade?.cost !== undefined ? def.upgrade.cost : def.cost;
}

export function cardEffects(def: CardDef, upgraded: boolean): readonly Effect[] {
  return upgraded && def.upgrade?.effects ? def.upgrade.effects : def.effects;
}

export function cardKeywords(def: CardDef, upgraded: boolean): readonly Keyword[] {
  return (upgraded && def.upgrade?.keywords ? def.upgrade.keywords : def.keywords) ?? [];
}

export function hasKeyword(def: CardDef, upgraded: boolean, k: Keyword): boolean {
  return cardKeywords(def, upgraded).includes(k);
}

export function cardMoods(def: CardDef, upgraded: boolean): readonly MoodDef[] {
  return (upgraded && def.upgrade?.mood ? def.upgrade.mood : def.mood) ?? [];
}

export function cardCostMod(def: CardDef, upgraded: boolean): { per: Countable; mult: number } | undefined {
  return upgraded && def.upgrade?.costMod ? def.upgrade.costMod : def.costMod;
}

export function cardTemplate(def: CardDef, upgraded: boolean): string {
  return upgraded && def.upgrade?.text !== undefined ? def.upgrade.text : def.text;
}

export function isBuriedDef(def: CardDef): boolean {
  return def.kind === 'buried' || def.buried !== undefined;
}

export function cardName(def: CardDef, upgraded: boolean): string {
  return upgraded ? `${def.name}+` : def.name;
}
