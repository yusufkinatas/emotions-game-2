// Rewards (DESIGN 12, 9, 3.2 step 3): card offers, Keepsake rewards, boss rewards, "the wheel closes".

import { cureOf, shadeIndex } from '../emotions';
import { rngFrom, type Rng } from '../rng';
import type {
  CardDef,
  CardId,
  CardInstance,
  CombatResult,
  CombatState,
  EngineCtx,
  GameState,
  KeepsakeId,
  Light,
  RewardOffer,
  RunState,
} from '../types';
import {
  availableLights,
  blendCards,
  isBuried,
  lightCards,
  neutralCards,
  pickId,
  rollRarity,
  type OfferRarity,
} from './cards';
import { drawBossKeepsakes, drawPoolKeepsake, EXHAUSTED_GLIMMERS, grantKeepsake } from './keepsakes';
import { cardAct, cardDef, compassId, ownsKeepsake } from './state';
import { easeCounts, mostCommonLights } from './view';

const NORMAL_WEIGHTS: Record<OfferRarity, number> = { common: 60, uncommon: 33, rare: 7 };
const ELITE_WEIGHTS: Record<OfferRarity, number> = { common: 45, uncommon: 40, rare: 15 };
const NEUTRAL_CHANCE = 0.08;
const SLOT_REROLLS = 5;
const BOSS_CHOICES = 3;

/** The heaviest Buried card (ties: wheel order of its Shade), or null. */
export function heaviestBuried(run: RunState, ctx: EngineCtx): CardInstance | null {
  let best: CardInstance | null = null;
  let bestShade = 99;
  for (const c of run.deck) {
    const d = cardDef(ctx, c.defId);
    if (!isBuried(d) || !d.buried) continue;
    const s = shadeIndex(d.buried.shade);
    const w = c.weight ?? 1;
    const bw = best?.weight ?? 0;
    if (!best || w > bw || (w === bw && s < bestShade)) {
      best = c;
      bestShade = s;
    }
  }
  return best;
}

interface SlotRoller {
  rng: Rng;
  ctx: EngineCtx;
  act: 1 | 2;
  weights: Record<OfferRarity, number>;
}

/** One Light card of `light` at a rolled rarity, with fallbacks for thin pools. */
function rollLightCard(r: SlotRoller, light: Light): CardId | null {
  const rarity = rollRarity(r.rng, r.weights);
  return (
    pickId(r.rng, lightCards(r.ctx, r.act, light, rarity)) ??
    pickId(r.rng, lightCards(r.ctx, r.act, light)) ??
    pickId(r.rng, lightCards(r.ctx, r.act))
  );
}

/** A normal slot: 8% neutral (rarity rolled the same way), else a Light card of the chosen Light. */
function rollSlot(r: SlotRoller, chooseLight: () => Light): CardId | null {
  if (r.rng.float() < NEUTRAL_CHANCE) {
    const rarity = rollRarity(r.rng, r.weights);
    const id = pickId(r.rng, neutralCards(r.ctx, r.act, rarity)) ?? pickId(r.rng, neutralCards(r.ctx, r.act));
    if (id) return id;
  }
  return rollLightCard(r, chooseLight());
}

/** Roll a slot, rerolling up to 5 times while its id is already offered; then keep the last roll (minor-10). */
function rollDistinct(offer: readonly CardId[], roll: () => CardId | null): CardId | null {
  let id = roll();
  for (let t = 0; t < SLOT_REROLLS && id !== null && offer.includes(id); t++) id = roll();
  return id;
}

export interface CardOfferSpec {
  elite: boolean;
  /** The Compass is granted on this screen: slot 3 is a random Act 1 Blend. */
  compassScreen: boolean;
  fullBloom: boolean;
  /** Owns The Compass (after any grant on this screen): Full Bloom's 4th option is a Blend. */
  ownsCompass: boolean;
}

/** 12.2 card reward. */
export function rollCardOffer(run: RunState, ctx: EngineCtx, rng: Rng, spec: CardOfferSpec): CardId[] {
  const act = cardAct(run);
  const r: SlotRoller = { rng, ctx, act, weights: spec.elite ? ELITE_WEIGHTS : NORMAL_WEIGHTS };
  const lights = availableLights(ctx, act);
  if (lights.length === 0) return [];
  const counts = easeCounts(run.deck, ctx);
  const top2 = mostCommonLights(counts).filter((l) => lights.includes(l)).slice(0, 2);
  const buried = heaviestBuried(run, ctx);
  const buriedCure = buried ? cureOf(cardDef(ctx, buried.defId).buried!.shade) : null;
  const anyLight = (): Light => rng.pick(lights);
  const blendOr = (pool: CardDef[], fallback: () => CardId | null) => (): CardId | null =>
    pool.length > 0 ? rng.pick(pool).id : fallback();

  const offer: CardId[] = [];
  const push = (id: CardId | null): void => {
    if (id !== null) offer.push(id);
  };
  push(rollDistinct(offer, () => rollSlot(r, () => rng.pick(top2.length > 0 ? top2 : lights))));
  push(rollDistinct(offer, () => rollSlot(r, anyLight)));
  const slot3Normal = (): CardId | null =>
    rollSlot(r, () => (buriedCure && lights.includes(buriedCure) ? buriedCure : anyLight()));
  if (spec.compassScreen) {
    const act1Blends = blendCards(ctx, 1);
    push(rollDistinct(offer, blendOr(act1Blends, slot3Normal)));
  } else if (spec.elite) {
    push(rollDistinct(offer, blendOr(blendCards(ctx, act), slot3Normal)));
  } else {
    push(rollDistinct(offer, slot3Normal));
  }
  if (spec.fullBloom) {
    const lightOption = (): CardId | null => rollLightCard(r, anyLight());
    push(rollDistinct(offer, spec.ownsCompass ? blendOr(blendCards(ctx, act), lightOption) : lightOption));
  }
  return offer;
}

/** 12.4: 3 distinct rare Light cards of the available Lights. */
export function rollBossCards(run: RunState, ctx: EngineCtx, rng: Rng): CardId[] {
  return rng
    .shuffle(lightCards(ctx, cardAct(run), undefined, 'rare'))
    .slice(0, BOSS_CHOICES)
    .map((d) => d.id);
}

/** 12.5: a random Hope common, a random Calm common, a random Hope-or-Calm uncommon. */
export function rollWheelCloses(ctx: EngineCtx, runSeed: number): CardId[] {
  const rng = rngFrom(runSeed, 'wheel');
  const out: CardId[] = [];
  const pick = (defs: CardDef[]): void => {
    const fresh = defs.filter((d) => !out.includes(d.id));
    if (fresh.length > 0) out.push(rng.pick(fresh).id);
  };
  pick(lightCards(ctx, 2, 'hope', 'common'));
  pick(lightCards(ctx, 2, 'calm', 'common'));
  pick([...lightCards(ctx, 2, 'hope', 'uncommon'), ...lightCards(ctx, 2, 'calm', 'uncommon')]);
  return out;
}

const sourceOf = (tier: CombatState['tier']): RewardOffer['source'] => {
  switch (tier) {
    case 'elite':
      return 'elite';
    case 'boss':
    case 'final':
      return 'boss';
    case 'event':
      return 'event';
    default:
      return 'fight';
  }
};

/** Grants The Compass after the configured number of combat wins (once per run). */
function maybeGrantCompass(d: GameState, ctx: EngineCtx): boolean {
  const id = compassId(ctx);
  if (!id || ownsKeepsake(d.run, id) || d.run.combatsWon < ctx.rules.compassAfterWins) return false;
  return grantKeepsake(d, ctx, id);
}

/** Reward screen after a won combat. Glimmers are already in the run (auto-added). */
export function combatReward(
  d: GameState,
  ctx: EngineCtx,
  result: CombatResult,
  combat: CombatState,
  rewardSeed: number,
): RewardOffer {
  const rng = rngFrom(rewardSeed, 'reward');
  const source = sourceOf(combat.tier);
  const compass = maybeGrantCompass(d, ctx);
  const cid = compassId(ctx);
  let glimmers = result.glimmers;
  let cards: CardId[] = [];
  let keepsakes: KeepsakeId[] = [];
  // 12.2: Full Bloom belongs to the card reward of normal and elite fights (not bosses, The Numbness or the Echo).
  const fullBloom = (source === 'fight' || source === 'elite') && result.allResolved;

  if (combat.tier === 'final') {
    // The Numbness: outcome strip only, then the ending.
  } else if (source === 'fight' || source === 'elite') {
    cards = rollCardOffer(d.run, ctx, rng, {
      elite: source === 'elite',
      compassScreen: compass,
      fullBloom,
      ownsCompass: cid !== null && ownsKeepsake(d.run, cid),
    });
    if (source === 'elite') {
      const k = drawPoolKeepsake(d.run, ctx, rng, 'weighted');
      if (k) keepsakes = [k];
      else glimmers += EXHAUSTED_GLIMMERS;
    }
  } else if (source === 'boss') {
    cards = rollBossCards(d.run, ctx, rng);
    keepsakes = drawBossKeepsakes(d.run, ctx, rng, BOSS_CHOICES);
    if (keepsakes.length === 0) glimmers += EXHAUSTED_GLIMMERS;
  }
  d.run.glimmers += glimmers - result.glimmers;

  let then: RewardOffer['then'] = 'map';
  if (combat.tier === 'final') then = 'victory';
  else if (combat.tier === 'boss') then = d.run.act === 1 ? 'wheelCloses' : 'deep';

  return {
    source,
    glimmers,
    compass,
    keepsakes,
    keepsakeChoice: source === 'boss' && keepsakes.length > 0,
    cards,
    taken: { keepsake: keepsakes.length === 0, card: cards.length === 0 },
    outcomes: result.gone.filter((g) => g.outcome !== 'fade'),
    fullBloom,
    then,
  };
}

/** Chest node: one random pool Keepsake (or 50 Glimmers when the pool is exhausted). */
export function chestReward(d: GameState, ctx: EngineCtx, nodeSeed: number): RewardOffer {
  const rng = rngFrom(nodeSeed, 'reward');
  const k = drawPoolKeepsake(d.run, ctx, rng, 'weighted');
  const glimmers = k ? 0 : EXHAUSTED_GLIMMERS;
  d.run.glimmers += glimmers;
  return {
    source: 'chest',
    glimmers,
    compass: false,
    keepsakes: k ? [k] : [],
    keepsakeChoice: false,
    cards: [],
    taken: { keepsake: !k, card: true },
    outcomes: [],
    fullBloom: false,
    then: 'map',
  };
}

