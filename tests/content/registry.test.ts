// Content registry checks (DESIGN 22): ids resolve, counts match 1.3, tables match DESIGN 6 to 10, text is warm.

import { describe, expect, it } from 'vitest';
import {
  AFFLICTIONS,
  BLENDS,
  LIGHTS,
  SHADES,
  cureOf,
  dissonantShadeOf,
  lightsOfBlend,
} from '../../src/engine/emotions';
import type {
  Amount,
  CardDef,
  Cond,
  Countable,
  Effect,
  EnemyDef,
  IntentPattern,
  Light,
  RunCond,
  RunEffect,
} from '../../src/engine/types';
import * as content from '../../src/content';
import { defaultPack as pack } from '../../src/content';

const cards = Object.values(pack.cards);
const enemies = Object.values(pack.enemies);
const keepsakes = Object.values(pack.keepsakes);
const card = (id: string): CardDef => {
  const c = pack.cards[id];
  if (!c) throw new Error(`missing card ${id}`);
  return c;
};

// ---------------------------------------------------------------------------------------------------
// Walkers
// ---------------------------------------------------------------------------------------------------

/** Every effect in a list, depth-first (then before else, promise contents in place). */
function flatEffects(list: readonly Effect[]): Effect[] {
  const out: Effect[] = [];
  const walk = (effects: readonly Effect[]) => {
    for (const e of effects) {
      out.push(e);
      if (e.op === 'if') {
        walk(e.then);
        if (e.else) walk(e.else);
      } else if (e.op === 'promise') walk(e.effects);
    }
  };
  walk(list);
  return out;
}

/** Text slots per the CardDef doc in src/engine/types.ts: one per primary number, depth-first. */
function slotsOf(list: readonly Effect[]): Amount[] {
  const slots: Amount[] = [];
  for (const e of flatEffects(list)) {
    if (e.op === 'hit' || e.op === 'guard' || e.op === 'mend') slots.push(e.amount);
    else if (e.op === 'status') slots.push(e.stacks);
    else if (e.op === 'draw' || e.op === 'energy') slots.push(e.n);
  }
  return slots;
}

/** Printed (out-of-combat) value of an Amount: every count reads 0. */
const printed = (a: Amount): number => (typeof a === 'number' ? a : (a.add ?? 0));

function render(text: string, list: readonly Effect[], weight = 1): string {
  const slots = slotsOf(list);
  return text.replace(/\{(\d+|w)\}/g, (_, k: string) => {
    if (k === 'w') return String(weight);
    const slot = slots[Number(k)];
    if (slot === undefined) throw new Error(`slot {${k}} does not resolve in "${text}"`);
    return String(printed(slot));
  });
}

const upgradedText = (c: CardDef): string => c.upgrade?.text ?? c.text;
const upgradedEffects = (c: CardDef): Effect[] => c.upgrade?.effects ?? c.effects;
const upgradedCost = (c: CardDef): number | 'unplayable' => c.upgrade?.cost ?? c.cost;

function condsOf(cond: Cond | undefined): Cond[] {
  if (!cond) return [];
  if (cond.c === 'and' || cond.c === 'or') return [cond, ...cond.of.flatMap(condsOf)];
  if (cond.c === 'not') return [cond, ...condsOf(cond.of)];
  return [cond];
}

function amountsOf(e: Effect): Amount[] {
  switch (e.op) {
    case 'hit':
      return e.times === undefined ? [e.amount] : [e.amount, e.times];
    case 'strike':
      return e.times === undefined ? [e.amount] : [e.amount, e.times];
    case 'guard':
    case 'mend':
      return [e.amount];
    case 'status':
      return [e.stacks];
    case 'draw':
    case 'energy':
      return [e.n];
    default:
      return [];
  }
}

function countablesOf(a: Amount): Countable[] {
  return typeof a === 'number' || a.per === undefined ? [] : [a.per];
}

function patternMoves(p: IntentPattern): string[] {
  if (p.kind === 'phases') return p.phases.flatMap((ph) => patternMoves(ph.pattern));
  const base = p.kind === 'cycle' ? p.moves : Object.values(p.moves).filter((m): m is string => !!m);
  return [...base, ...(p.overrides ?? []).map((o) => o.move)];
}

function patternConds(p: IntentPattern): Cond[] {
  if (p.kind === 'phases') return p.phases.flatMap((ph) => patternConds(ph.pattern));
  return (p.overrides ?? []).flatMap((o) => condsOf(o.if));
}

/** Every (context, effect list) pair in the pack. */
function effectLists(): { where: string; effects: Effect[]; conds: Cond[] }[] {
  const out: { where: string; effects: Effect[]; conds: Cond[] }[] = [];
  for (const c of cards) {
    out.push({ where: c.id, effects: c.effects, conds: [] });
    if (c.upgrade?.effects) out.push({ where: `${c.id}+`, effects: c.upgrade.effects, conds: [] });
    for (const m of [...(c.mood ?? []), ...(c.upgrade?.mood ?? [])]) {
      out.push({ where: `${c.id} mood`, effects: m.effects, conds: condsOf(m.if) });
    }
  }
  for (const e of enemies) {
    for (const [id, m] of Object.entries(e.moves)) out.push({ where: `${e.id}.${id}`, effects: m.effects, conds: [] });
    for (const p of e.passives ?? []) out.push({ where: `${e.id} ${p.name}`, effects: p.effects, conds: condsOf(p.if) });
    out.push({ where: `${e.id} pattern`, effects: [], conds: patternConds(e.pattern) });
  }
  for (const c of Object.values(pack.companions)) out.push({ where: c.id, effects: c.act, conds: [] });
  for (const k of keepsakes) {
    for (const [trigger, hook] of Object.entries(k.on ?? {})) {
      out.push({ where: `${k.id}.${trigger}`, effects: hook?.effects ?? [], conds: [] });
    }
  }
  for (const [shade, a] of Object.entries(pack.afterglows)) out.push({ where: `afterglow ${shade}`, effects: a.effects, conds: [] });
  return out.map((x) => {
    const flat = flatEffects(x.effects);
    const nested = flat.flatMap((e) => (e.op === 'if' ? condsOf(e.cond) : []));
    return { where: x.where, effects: flat, conds: [...x.conds, ...nested] };
  });
}

function flatRunEffects(list: readonly RunEffect[]): RunEffect[] {
  const out: RunEffect[] = [];
  for (const e of list) {
    out.push(e);
    if (e.op === 'if') out.push(...flatRunEffects(e.then), ...flatRunEffects(e.else ?? []));
    if (e.op === 'combat') out.push(...flatRunEffects(e.onResolve), ...flatRunEffects(e.onSuppress));
  }
  return out;
}

const monoOf = (c: CardDef, l: Light) => c.lights.length === 1 && c.lights[0] === l;

// ---------------------------------------------------------------------------------------------------
// Counts (DESIGN 1.3)
// ---------------------------------------------------------------------------------------------------

describe('counts match DESIGN 1.3', () => {
  it('cards: 5 starter, 36 Light, 6 Blend, 5 neutral, 6 Buried, 6 Insight', () => {
    const starter = cards.filter((c) => c.rarity === 'starter');
    const light = cards.filter((c) => c.lights.length === 1 && ['common', 'uncommon', 'rare'].includes(c.rarity));
    const blend = cards.filter((c) => c.rarity === 'blend');
    const neutral = cards.filter((c) => c.lights.length === 0 && c.kind !== 'buried');
    const buried = cards.filter((c) => c.kind === 'buried');
    const insight = cards.filter((c) => c.id.startsWith('insight.'));
    expect(starter).toHaveLength(5);
    expect(light).toHaveLength(36);
    expect(blend).toHaveLength(6);
    expect(neutral).toHaveLength(5);
    expect(buried).toHaveLength(6);
    expect(insight).toHaveLength(6);
    expect(cards).toHaveLength(64);
  });

  it('keepsakes: 23 = 1 Compass, 4 Charms, 12 pool (5 common, 4 uncommon, 3 rare), 6 boss', () => {
    const by = (r: string) => keepsakes.filter((k) => k.rarity === r).length;
    expect(keepsakes).toHaveLength(23);
    expect([by('fixed'), by('charm'), by('common'), by('uncommon'), by('rare'), by('boss')]).toEqual([1, 4, 5, 4, 3, 6]);
  });

  it('enemies 28, encounters 30, companions 3, Memory events 6 (+ fallback), statuses 21 (+ veiled)', () => {
    expect(enemies).toHaveLength(28);
    expect(enemies.filter((e) => e.id.startsWith('shade.tut_'))).toHaveLength(4);
    expect(enemies.filter((e) => e.tier === 'surfaced')).toHaveLength(6);
    expect(Object.keys(pack.encounters)).toHaveLength(30);
    expect(Object.keys(pack.companions)).toHaveLength(3);
    const events = Object.keys(pack.events).filter((id) => id !== pack.fallbackEvent);
    expect(events).toHaveLength(6);
    const statusIds = Object.keys(pack.statuses).filter((id) => id !== 'veiled');
    expect(statusIds.sort()).toEqual(
      [
        'nerve', 'warmth', 'seething', 'heavy', 'isolated', 'trembling', 'hollow', 'restless', 'numb', 'next_draw',
        'next_spirit', 'flare', 'hush', 'understood', 'wavering', 'worry', 'pressure', 'tension', 'tally', 'countdown',
        'coil',
      ].sort(),
    );
  });
});

// ---------------------------------------------------------------------------------------------------
// References
// ---------------------------------------------------------------------------------------------------

describe('every referenced id exists', () => {
  const KNOWN_OPS = new Set([
    'hit', 'guard', 'mend', 'status', 'setStatus', 'clearStatus', 'draw', 'energy', 'summon', 'companionsAct',
    'promise', 'nextCardFree', 'fetchBuried', 'tendAny', 'removeAfflictions', 'lingerHand', 'strike', 'afflict',
    'spawn', 'scatter', 'mark', 'unmark', 'if',
  ]);

  it('effects use only known ops (no custom hooks, no random targets)', () => {
    for (const { where, effects } of effectLists()) {
      for (const e of effects) expect(KNOWN_OPS.has(e.op), `${where}: op ${e.op}`).toBe(true);
    }
  });

  it('statuses, companions and spawned Shades in effects, amounts and conditions exist', () => {
    const statusExists = (id: string, where: string) => expect(pack.statuses[id], `${where}: status ${id}`).toBeDefined();
    for (const { where, effects, conds } of effectLists()) {
      for (const e of effects) {
        if (e.op === 'status' || e.op === 'setStatus' || e.op === 'clearStatus') statusExists(e.id, where);
        if (e.op === 'afflict') {
          expect(pack.statuses[e.id]?.affliction, `${where}: afflict ${e.id}`).toBe(e.id);
        }
        if (e.op === 'summon') expect(pack.companions[e.companion], `${where}: ${e.companion}`).toBeDefined();
        if (e.op === 'spawn') expect(pack.enemies[e.enemy], `${where}: ${e.enemy}`).toBeDefined();
        for (const a of amountsOf(e)) {
          for (const k of countablesOf(a)) if (typeof k === 'object') statusExists(k.status, where);
        }
      }
      for (const c of conds) {
        if (c.c === 'status') statusExists(c.id, where);
        if (c.c === 'count' && typeof c.of === 'object') statusExists(c.of.status, where);
      }
    }
    for (const c of cards) {
      const k = c.costMod?.per;
      if (k && typeof k === 'object') statusExists(k.status, c.id);
    }
  });

  it('encounters, pools and the starter reference existing ids', () => {
    for (const enc of Object.values(pack.encounters)) {
      expect(enc.members.length, enc.id).toBeGreaterThan(0);
      expect(enc.members.length, enc.id).toBeLessThanOrEqual(4);
      for (const m of enc.members) expect(pack.enemies[m.enemy], `${enc.id}: ${m.enemy}`).toBeDefined();
    }
    const { act1, act2, deep, tutorial } = pack.pools;
    const pooled = [act1, act2].flatMap((p) => [...p.early, ...(p.row3 ?? []), ...p.standard, ...p.elite, p.boss]);
    for (const id of [...pooled, deep, ...tutorial]) expect(pack.encounters[id], id).toBeDefined();
    for (const id of pack.starter.deck) expect(pack.cards[id], id).toBeDefined();
    for (const id of pack.starter.charms) expect(pack.keepsakes[id]?.rarity, id).toBe('charm');
    expect(pack.starter.charms).toContain(pack.starter.tutorialCharm);
  });

  it('keepsakes, events and the fallback event reference existing ids', () => {
    for (const k of keepsakes) if (k.addsCard) expect(pack.cards[k.addsCard], `${k.id} adds ${k.addsCard}`).toBeDefined();
    const conds = (c: RunCond | { c: 'lastPaid' }): (RunCond | { c: 'lastPaid' })[] =>
      c.c === 'not' ? [c, ...conds(c.of)] : [c];
    expect(pack.events[pack.fallbackEvent]).toBeDefined();
    for (const ev of Object.values(pack.events)) {
      expect(ev.options.length, ev.id).toBeGreaterThan(0);
      for (const o of ev.options) {
        for (const e of flatRunEffects(o.effects)) {
          if (e.op === 'addCard' && typeof e.card === 'string') expect(pack.cards[e.card], e.card).toBeDefined();
          if (e.op === 'keepsake' && typeof e.id === 'string') expect(pack.keepsakes[e.id], e.id).toBeDefined();
          if (e.op === 'combat') expect(pack.encounters[e.encounter], e.encounter).toBeDefined();
          if (e.op === 'if') {
            for (const c of conds(e.cond)) if (c.c === 'hasKeepsake') expect(pack.keepsakes[c.id]).toBeDefined();
          }
        }
        for (const c of o.requires ? conds(o.requires) : []) {
          if (c.c === 'hasKeepsake') expect(pack.keepsakes[c.id], c.id).toBeDefined();
        }
      }
    }
  });

  it('Tea, Slowly and the Wishing Well branch on the picked card and the act', () => {
    const tea = pack.events['mem.tea_slowly']!.options[2]!.effects;
    expect(tea[0]).toEqual({ op: 'deckSelect', purpose: 'remove' });
    expect(tea[1]).toMatchObject({ op: 'if', cond: { c: 'lastSelectedKind', kind: 'buried' }, then: [{ op: 'heart', n: 6 }] });
    const well = pack.events['mem.wishing_well']!.options[0]!.effects[1]!;
    expect(well).toMatchObject({ op: 'if', cond: { c: 'act', op: '>=', n: 2 } });
    if (well.op !== 'if') throw new Error('expected an if');
    const [hope] = well.then;
    expect(hope?.op === 'addCard' && typeof hope.card === 'object' && hope.card.random.lights).toEqual(['hope']);
  });

  it('every encounter is used by a pool or a Memory', () => {
    const { act1, act2, deep, tutorial } = pack.pools;
    const used = new Set([
      ...[act1, act2].flatMap((p) => [...p.early, ...(p.row3 ?? []), ...p.standard, ...p.elite, p.boss]),
      deep,
      ...tutorial,
      ...Object.values(pack.events).flatMap((ev) =>
        ev.options.flatMap((o) => flatRunEffects(o.effects).flatMap((e) => (e.op === 'combat' ? [e.encounter] : []))),
      ),
    ]);
    for (const id of Object.keys(pack.encounters)) expect(used.has(id), `${id} unused`).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------
// Cards (DESIGN 6)
// ---------------------------------------------------------------------------------------------------

/** [cost, upgraded cost, base text, upgraded text], printed with base numbers (DESIGN 6 tables). */
const EXPECTED: Record<string, [number, number, string, string]> = {
  'love.kind_word': [1, 1, 'Ease 6.', 'Ease 9.'],
  'joy.bright_spark': [1, 1, 'Ease 4. Draw 1.', 'Ease 6. Draw 1.'],
  'friendship.reach_out': [1, 1, 'Ease 6.', 'Ease 9.'],
  'courage.brave_strike': [1, 1, 'Ease 6.', 'Ease 9.'],
  'courage.stand_firm': [1, 1, 'Gain 5 Guard.', 'Gain 8 Guard.'],

  'love.soft_spot': [1, 1, 'Ease 6. Mend 2.', 'Ease 8. Mend 3.'],
  'love.warm_embrace': [1, 1, 'Gain 5 Guard. Gain 2 Warmth.', 'Gain 7 Guard. Gain 3 Warmth.'],
  'love.unguarded': [
    1, 1,
    'Ease 5. If you have no Guard, Ease 11 instead.',
    'Ease 7. If you have no Guard, Ease 15 instead.',
  ],
  'love.forgive': [
    2, 2,
    'Ease 8, +4 for each Flare on the target. Then remove all its Flare.',
    'Ease 11, +5 for each Flare on the target. Then remove all its Flare.',
  ],
  'love.tender_tune': [
    1, 1,
    'Gain 4 Warmth. Harmony: also gain 5 Guard. Let Go.',
    'Gain 6 Warmth. Harmony: also gain 7 Guard. Let Go.',
  ],
  'love.unconditional': [
    2, 1,
    "The first time each turn a Shade's move makes you lose Heart, gain 2 Warmth.",
    "The first time each turn a Shade's move makes you lose Heart, gain 2 Warmth.",
  ],

  'joy.giggle': [0, 0, 'Ease 3. Spark +1.', 'Ease 4. Spark +2.'],
  'joy.confetti': [1, 1, 'Ease 3 to ALL Shades twice.', 'Ease 4 to ALL Shades twice.'],
  'joy.skip_along': [
    1, 1,
    'Gain 5 Guard. Draw 1. Harmony: draw 1 more.',
    'Gain 8 Guard. Draw 1. Harmony: draw 1 more.',
  ],
  'joy.belly_laugh': [2, 2, 'Ease 8. Spark +2.', 'Ease 10. Spark +3.'],
  'joy.zoomies': [
    0, 0,
    'Gain 1 Spirit. Draw 1. Harmony: draw 1 more. Let Go.',
    'Gain 1 Spirit. Draw 2. Harmony: draw 1 more. Let Go.',
  ],
  'joy.grand_finale': [
    2, 2,
    'Ease 4 to ALL Shades once for each card you played earlier this turn (at least once). Let Go.',
    'Ease 5 to ALL Shades once for each card you played earlier this turn (at least once). Let Go.',
  ],

  'friendship.call_a_friend': [1, 1, 'Summon a Lantern Moth.', 'Summon a Lantern Moth. Draw 1.'],
  'friendship.buddy_up': [1, 1, 'Gain 4 Guard. Summon a Burrow Hare.', 'Gain 7 Guard. Summon a Burrow Hare.'],
  'friendship.high_five': [
    1, 1,
    'Ease 5, +2 per Companion. Harmony: your Companions act now.',
    'Ease 7, +3 per Companion. Harmony: your Companions act now.',
  ],
  'friendship.group_hug': [2, 2, 'Gain 8 Guard, +3 per Companion.', 'Gain 11 Guard, +4 per Companion.'],
  'friendship.pile_on': [
    2, 2,
    'Ease 5 to ALL Shades, +2 per Companion.',
    'Ease 7 to ALL Shades, +3 per Companion.',
  ],
  'friendship.best_friend': [2, 1, 'Summon an Old Dog.', 'Summon an Old Dog.'],

  'courage.hold_the_line': [1, 1, 'Gain 8 Guard.', 'Gain 11 Guard.'],
  'courage.face_the_storm': [
    1, 1,
    'Ease 7. If the target intends to attack, Ease 10 instead. Harmony: always Ease 10.',
    'Ease 9. If the target intends to attack, Ease 13 instead. Harmony: always Ease 13.',
  ],
  'courage.chin_up': [1, 1, 'Ease 5. Gain 5 Guard.', 'Ease 7. Gain 7 Guard.'],
  'courage.find_your_nerve': [1, 1, 'Gain 2 Nerve.', 'Gain 3 Nerve.'],
  'courage.bold_leap': [
    2, 2,
    'Ease 15. If the target intends to attack, also gain 8 Guard.',
    'Ease 19. If the target intends to attack, also gain 10 Guard.',
  ],
  'courage.lionheart': [
    2, 1,
    'At the start of your turn, if any Shade intends to attack, gain 1 Nerve.',
    'At the start of your turn, if any Shade intends to attack, gain 1 Nerve.',
  ],

  'hope.wish_on_a_star': [
    1, 1,
    'Ease 4. Promise: Ease 8 to the same Shade. Harmony: the Promise Eases 12 instead.',
    'Ease 5. Promise: Ease 11 to the same Shade. Harmony: the Promise Eases 15 instead.',
  ],
  'hope.silver_lining': [
    1, 1,
    'Gain 5 Guard. Promise: gain 5 Guard and draw 1.',
    'Gain 7 Guard. Promise: gain 7 Guard and draw 1.',
  ],
  'hope.plant_a_seed': [
    0, 0,
    'Promise: gain 1 Spirit and draw 1. Let Go.',
    'Promise: gain 1 Spirit and draw 2. Let Go.',
  ],
  'hope.growing_light': [
    1, 1,
    'Ease 6. Each time you play this, it Eases 3 more for the rest of this combat.',
    'Ease 8. Each time you play this, it Eases 4 more for the rest of this combat.',
  ],
  'hope.better_days': [
    1, 0,
    'At the start of your turn, gain Guard equal to the turn number (max 8).',
    'At the start of your turn, gain Guard equal to the turn number (max 8).',
  ],
  'hope.daybreak': [
    3, 3,
    'Ease 18 to ALL Shades. Costs 1 less for each Promise you made this combat. Let Go.',
    'Ease 24 to ALL Shades. Costs 1 less for each Promise you made this combat. Let Go.',
  ],

  'calm.still_water': [1, 1, 'Gain 7 Guard. Linger.', 'Gain 10 Guard. Linger.'],
  'calm.lullaby': [
    1, 1,
    'Ease 5. Hush 4. Harmony: Hush ALL Shades instead.',
    'Ease 7. Hush 5. Harmony: Hush ALL Shades instead.',
  ],
  'calm.count_to_ten': [
    2, 2,
    'Ease 13. Linger. Costs 1 less for each turn it has Lingered this combat.',
    'Ease 17. Linger. Costs 1 less for each turn it has Lingered this combat.',
  ],
  'calm.center': [
    1, 0,
    'The next card you play this turn costs 0. Draw 1.',
    'The next card you play this turn costs 0. Draw 1.',
  ],
  'calm.unhurried': [
    1, 1,
    'At the end of your turn, gain 4 Guard for each unspent Spirit.',
    'At the end of your turn, gain 6 Guard for each unspent Spirit.',
  ],
  'calm.serenity': [
    2, 1,
    'At the end of your turn, every non-Buried card in your hand Lingers.',
    'At the end of your turn, every non-Buried card in your hand Lingers.',
  ],

  'blend.sunbeam': [1, 1, 'Ease 7. Mend 2. Draw 1.', 'Ease 9. Mend 3. Draw 1.'],
  'blend.tag_youre_it': [
    1, 1,
    'Ease 5. Spark +1. Summon a Lantern Moth.',
    'Ease 7. Spark +2. Summon a Lantern Moth.',
  ],
  'blend.shoulder_to_shoulder': [
    1, 1,
    'Ease 6 and gain 6 Guard, +2 each per Companion. Reaches Shy.',
    'Ease 8 and gain 8 Guard, +2 each per Companion. Reaches Shy.',
  ],
  'blend.against_the_odds': [
    2, 2,
    'Ease 10. Promise: Ease 10 to the same Shade.',
    'Ease 13. Promise: Ease 13 to the same Shade.',
  ],
  'blend.wait_it_out': [
    1, 1,
    'Ease 7. Linger. Eases 4 more for each turn it has Lingered this combat.',
    'Ease 10. Linger. Eases 5 more for each turn it has Lingered this combat.',
  ],
  'blend.gentle_hands': [1, 1, 'Ease 6. Hush 5. Mend 3.', 'Ease 8. Hush 7. Mend 4.'],

  'neutral.name_it': [
    1, 1,
    'Ease 4. Then the target becomes Understood.',
    'Ease 7. Then the target becomes Understood.',
  ],
  'neutral.pause': [0, 0, 'Draw 2. Let Go.', 'Draw 3. Let Go.'],
  'neutral.push_it_down': [
    1, 1,
    'Ease 9. If this Suppresses a Shade, gain 2 Spirit.',
    'Ease 12. If this Suppresses a Shade, gain 2 Spirit.',
  ],
  'neutral.look_inward': [
    1, 0,
    'Put a Buried card from your draw or discard pile into your hand. Draw 1.',
    'Put a Buried card from your draw or discard pile into your hand. Draw 1.',
  ],
  'neutral.sit_with_it': [
    1, 0,
    'Tend a Buried card in your hand, whatever its type. Let Go.',
    'Tend a Buried card in your hand, whatever its type. Let Go.',
  ],

  'insight.passion': [
    1, 1,
    'Ease 9, +3 for each Flare on the target. Gain 1 Nerve.',
    'Ease 12, +4 for each Flare on the target. Gain 1 Nerve.',
  ],
  'insight.bittersweet': [1, 1, 'Mend 4. Draw 2. Linger.', 'Mend 6. Draw 2. Linger.'],
  'insight.solitude': [
    2, 2,
    'Ease 10. If you have no Companions, Ease 20 instead. Then Summon a Lantern Moth.',
    'Ease 13. If you have no Companions, Ease 26 instead. Then Summon a Lantern Moth.',
  ],
  'insight.instinct': [
    1, 0,
    "Innate. Gain Guard equal to the total of all Shades' incoming strikes (max 30).",
    "Innate. Gain Guard equal to the total of all Shades' incoming strikes (max 30).",
  ],
  'insight.resilience': [
    0, 0,
    'Gain 6 Guard. Promise: gain 1 Spirit and draw 1.',
    'Gain 9 Guard. Promise: gain 1 Spirit and draw 1.',
  ],
  'insight.foresight': [
    0, 0,
    'Draw 2. Hush 3 on ALL Shades. Linger.',
    'Draw 2. Hush 5 on ALL Shades. Linger.',
  ],
};

describe('cards (DESIGN 6)', () => {
  it('every text slot resolves, and {w} appears only on Buried cards', () => {
    for (const c of cards) {
      for (const [text, list] of [
        [c.text, c.effects],
        [upgradedText(c), upgradedEffects(c)],
      ] as const) {
        for (const m of text.matchAll(/\{([^}]*)\}/g)) {
          const k = m[1]!;
          if (k === 'w') expect(c.kind, `${c.id}: {w}`).toBe('buried');
          else {
            expect(k, `${c.id}: placeholder {${k}}`).toMatch(/^\d+$/);
            expect(Number(k), `${c.id}: {${k}} in "${text}"`).toBeLessThan(slotsOf(list).length);
          }
        }
      }
    }
  });

  it('printed text and costs match the DESIGN 6 tables, base and upgraded', () => {
    const nonBuried = cards.filter((c) => c.kind !== 'buried');
    expect(nonBuried.map((c) => c.id).sort()).toEqual(Object.keys(EXPECTED).sort());
    for (const c of nonBuried) {
      const [cost, upCost, text, upText] = EXPECTED[c.id]!;
      expect(c.cost, `${c.id} cost`).toBe(cost);
      expect(upgradedCost(c), `${c.id}+ cost`).toBe(upCost);
      expect(render(c.text, c.effects), c.id).toBe(text);
      expect(render(upgradedText(c), upgradedEffects(c)), `${c.id}+`).toBe(upText);
    }
  });

  it('every non-Buried card has an upgrade that changes something', () => {
    for (const c of cards.filter((x) => x.kind !== 'buried')) {
      expect(c.upgrade, c.id).toBeDefined();
      const u = c.upgrade!;
      const changed =
        (u.cost !== undefined && u.cost !== c.cost) ||
        (u.effects !== undefined && JSON.stringify(u.effects) !== JSON.stringify(c.effects)) ||
        u.mood !== undefined ||
        u.keywords !== undefined;
      expect(changed, c.id).toBe(true);
    }
  });

  it('keywords match the keyword words printed in the text', () => {
    const WORDS = { linger: /\bLinger\./, letGo: /\bLet Go\./, innate: /\bInnate\./, reachesShy: /\bReaches Shy\./ };
    for (const c of cards) {
      for (const [kw, re] of Object.entries(WORDS)) {
        const has = (c.keywords ?? []).includes(kw as keyof typeof WORDS);
        expect(has, `${c.id} ${kw}`).toBe(re.test(c.text));
      }
    }
  });

  it("kinds and targets agree with the effects ('ease' cards hit, 'all' cards reach every Shade)", () => {
    for (const c of cards) {
      const flat = flatEffects(c.effects);
      const hits = flat.filter((e) => e.op === 'hit');
      if (c.kind === 'ease') {
        expect(hits.length, `${c.id} has no hit`).toBeGreaterThan(0);
        expect(c.text, c.id).toMatch(/\bEase\b/);
      } else expect(hits, `${c.id} (${c.kind}) hits`).toHaveLength(0);
      if (c.target === 'all') expect(hits.some((h) => h.op === 'hit' && h.to === 'all'), c.id).toBe(true);
      const targeted = flat.some(
        (e) => (e.op === 'hit' && e.to !== 'all') || ((e.op === 'status' || e.op === 'clearStatus') && e.to === 'target'),
      );
      if (targeted) expect(c.target, c.id).toBe('enemy');
      if (c.kind === 'mood') expect(c.target, c.id).toBe('none');
    }
  });

  it('each Light has 3 common, 2 uncommon and 1 rare card', () => {
    for (const l of LIGHTS) {
      const own = cards.filter((c) => monoOf(c, l) && ['common', 'uncommon', 'rare'].includes(c.rarity));
      const n = (r: string) => own.filter((c) => c.rarity === r).length;
      expect([n('common'), n('uncommon'), n('rare')], l).toEqual([3, 2, 1]);
      for (const c of own) expect(c.id.startsWith(`${l}.`), c.id).toBe(true);
    }
  });

  it('the 6 Blends cover every adjacent pair, with Lights in wheel order', () => {
    const blends = cards.filter((c) => c.rarity === 'blend');
    for (const b of BLENDS) {
      const want = lightsOfBlend(b);
      const matches = blends.filter((c) => c.lights.length === 2 && c.lights[0] === want[0] && c.lights[1] === want[1]);
      expect(matches, b).toHaveLength(1);
      expect(matches[0]!.kind, b).toBe('ease');
      expect(content.BLEND_INFO[b].card).toBe(matches[0]!.id);
    }
    for (const c of cards) if (c.lights.length === 2) expect(c.rarity, c.id).toBe('blend');
  });

  it('each Blend is the key to the compound whose two cures are its Lights (6.8)', () => {
    for (const b of BLENDS) {
      const info = content.BLEND_INFO[b];
      const compound = pack.enemies[info.keyTo]!;
      expect(compound.faces.map(cureOf).sort()).toEqual([...info.lights].sort());
    }
  });

  it('availableFromAct follows 6.0 (Hope and Calm from Act 2; Delight, Playfulness, Loyalty from Act 1)', () => {
    for (const c of cards) {
      const act2 = c.lights.includes('hope') || c.lights.includes('calm');
      expect(c.availableFromAct, c.id).toBe(act2 ? 2 : 1);
    }
  });

  it('the starter deck is 11 cards: Kind Word x2, Bright Spark x2, Reach Out x2, Brave Strike x2, Stand Firm x3', () => {
    const count = (id: string) => pack.starter.deck.filter((x) => x === id).length;
    expect(pack.starter.deck).toHaveLength(11);
    expect(
      ['love.kind_word', 'joy.bright_spark', 'friendship.reach_out', 'courage.brave_strike', 'courage.stand_firm'].map(
        count,
      ),
    ).toEqual([2, 2, 2, 2, 3]);
    for (const id of pack.starter.deck) expect(card(id).rarity).toBe('starter');
  });

  it('Moods carry their lasting effects as MoodDefs', () => {
    const unconditional = card('love.unconditional').mood![0]!;
    expect(unconditional).toMatchObject({ on: 'heartLostFromMove', oncePerEnemyPhase: true });
    expect(card('courage.lionheart').mood![0]).toMatchObject({ on: 'turnStart', if: { c: 'anyIntendsAttack' } });
    expect(card('hope.better_days').mood![0]!.on).toBe('turnStart');
    expect(card('calm.unhurried').mood![0]!.on).toBe('turnEnd');
    expect(card('calm.unhurried').upgrade!.mood![0]!.effects).toEqual([
      { op: 'guard', amount: { add: 0, per: 'unspentEnergy', mult: 6 } },
    ]);
    expect(card('calm.serenity').mood![0]!.effects).toEqual([{ op: 'lingerHand' }]);
    expect(card('hope.daybreak').costMod).toEqual({ per: 'promisesMade', mult: -1 });
    expect(card('calm.count_to_ten').costMod).toEqual({ per: 'lingered', mult: -1 });
  });
});

describe('Buried and Insight (DESIGN 4.10, 6.10, 6.11)', () => {
  it('6 Buried <-> 6 Insight pairs, one per Shade, Insight in the cure Light', () => {
    const buried = cards.filter((c) => c.kind === 'buried');
    expect(buried.map((c) => c.buried!.shade).sort()).toEqual([...SHADES].sort());
    const insights = new Set<string>();
    for (const b of buried) {
      const s = b.buried!.shade;
      expect(b.id).toBe(`buried.${s}`);
      expect(b.cost).toBe('unplayable');
      expect(b.lights).toEqual([]);
      const ins = card(b.buried!.insight);
      expect(ins.insightOf, ins.id).toBe(s);
      expect(ins.lights, ins.id).toEqual([cureOf(s)]);
      expect(ins.rarity).toBe('special');
      insights.add(ins.id);
    }
    expect(insights.size).toBe(6);
    for (const c of cards.filter((x) => x.insightOf)) expect(insights.has(c.id), c.id).toBe(true);
  });

  it('Buried text names its affliction and its Tending Light', () => {
    expect(render(card('buried.anger').text, [], 2)).toBe(
      'Weight 2. Unplayable. End of turn in hand: gain 2 Seething. Play a Love card Inward to Tend.',
    );
    expect(render(card('buried.anxiety').text, [], 1)).toBe(
      'Weight 1. Unplayable. End of turn in hand: gain 1 Restless. Play a Calm card Inward to Tend.',
    );
  });
});

// ---------------------------------------------------------------------------------------------------
// Shades (DESIGN 7)
// ---------------------------------------------------------------------------------------------------

describe('Shades (DESIGN 7)', () => {
  it('every move is reachable from its pattern and every pattern move exists', () => {
    for (const e of enemies) {
      const used = new Set(patternMoves(e.pattern));
      for (const m of used) expect(e.moves[m], `${e.id}: pattern move ${m}`).toBeDefined();
      for (const m of Object.keys(e.moves)) expect(used.has(m), `${e.id}: move ${m} unreachable`).toBe(true);
    }
  });

  it('every move has at least one intent icon', () => {
    for (const e of enemies) {
      for (const [id, m] of Object.entries(e.moves)) expect(m.intent.length, `${e.id}.${id}`).toBeGreaterThan(0);
    }
  });

  it("compounds: the outer face's cure is DISSONANT against the inner face", () => {
    const compounds = enemies.filter((e) => e.faces.length === 2);
    expect(compounds.map((e) => e.id).sort()).toEqual(
      ['shade.dread', 'shade.knot', 'shade.longing', 'shade.old_grudge', 'shade.spiral', 'shade.wallflower'].sort(),
    );
    for (const e of compounds) expect(dissonantShadeOf(cureOf(e.faces[0]!)), e.id).toBe(e.faces[1]);
  });

  it('faces, visual families and numb rules are consistent', () => {
    for (const e of enemies) {
      if (e.faces.length === 0) {
        expect(e.numbRules, e.id).toBeDefined();
        expect(e.visual.family, e.id).toBe('numb');
      } else if (e.faces.length === 4) expect(e.visual.family, e.id).toBe('mask');
      else if (e.fleeting) expect(e.visual.family, e.id).toBe('doubt');
      else expect(e.visual.family, e.id).toBe(e.faces[0]);
      expect(e.hp[0], e.id).toBeLessThanOrEqual(e.hp[1]);
    }
    expect(pack.enemies['shade.apathy']!.numbRules).toEqual({ surface: 1, hpPerHiddenWeight: 0 });
    expect(pack.enemies['shade.numbness']!.numbRules).toEqual({ surface: 3, hpPerHiddenWeight: 6 });
    expect(pack.enemies['shade.mask']).toMatchObject({ turnsAfterAction: true, maxTurnsPerPlayerTurn: 2 });
  });

  it('tutorial variants have no passives; every other Shade has barks unless it has no words', () => {
    for (const e of enemies.filter((x) => x.id.startsWith('shade.tut_'))) expect(e.passives ?? [], e.id).toEqual([]);
    for (const e of enemies) {
      expect(e.lines.resolved.length, e.id).toBeGreaterThan(0);
      expect(e.lines.suppressed.length, e.id).toBeGreaterThan(0);
      if (e.id !== 'shade.mask' && e.id !== 'shade.numbness') expect(e.lines.bark.length, e.id).toBeGreaterThan(0);
    }
  });

  it('thresholds are percents: Mask Cracked 50, Spiral Deepening 50, Numbness Thaw at 50', () => {
    const threshold = (id: string, name: string) =>
      pack.enemies[id]!.passives!.find((p) => p.name === name && p.on === 'hpThreshold')!.thresholdPct;
    expect(threshold('shade.mask', 'Cracked')).toBe(50);
    expect(threshold('shade.spiral', 'Deepening')).toBe(50);
    const numb = pack.enemies['shade.numbness']!.pattern;
    expect(numb.kind === 'phases' && numb.phases.map((p) => p.atOrBelowPct)).toEqual([100, 50]);
  });

  it('overrides point at boil_over, snap and the_thing', () => {
    const overrides = (id: string) => {
      const p = pack.enemies[id]!.pattern;
      return p.kind === 'cycle' ? (p.overrides ?? []).map((o) => o.move) : [];
    };
    expect(overrides('shade.kettle')).toEqual(['boil_over']);
    expect(overrides('shade.knot')).toEqual(['snap']);
    expect(overrides('shade.dread')).toEqual(['the_thing']);
  });

  it('named passives carry tooltip text on their first entry', () => {
    for (const e of enemies) {
      const seen = new Set<string>();
      for (const p of e.passives ?? []) {
        if (seen.has(p.name)) continue;
        seen.add(p.name);
        expect(p.text, `${e.id} ${p.name}`).toBeTruthy();
      }
    }
  });

  it('gauges have the clamps of DESIGN 7 (and Warmth max 6)', () => {
    const clamp = (id: string) => [pack.statuses[id]!.min ?? 0, pack.statuses[id]!.max ?? null];
    expect(clamp('pressure')).toEqual([0, 6]);
    expect(clamp('tension')).toEqual([0, 6]);
    expect(clamp('tally')).toEqual([0, 6]);
    expect(clamp('worry')).toEqual([0, 6]);
    expect(clamp('coil')).toEqual([1, 6]);
    expect(clamp('countdown')).toEqual([0, 3]);
    expect(pack.statuses.understood!.max).toBe(1);
    expect(pack.statuses.warmth!.max).toBe(6);
    for (const a of [...AFFLICTIONS, 'numb' as const]) {
      expect(pack.statuses[a]!.affliction, a).toBe(a);
      expect(pack.statuses[a]!.decay, a).toBe('playerTurnEnd');
    }
  });
});

// ---------------------------------------------------------------------------------------------------
// Afterglows, Keepsakes, Memories
// ---------------------------------------------------------------------------------------------------

describe('afterglows, keepsakes and memories', () => {
  it('afterglows cover all 6 Shades with the 4.9 names', () => {
    expect(Object.keys(pack.afterglows).sort()).toEqual([...SHADES].sort());
    expect(SHADES.map((s) => pack.afterglows[s].name)).toEqual([
      'Conviction',
      'Release',
      'Belonging',
      'Caution',
      'Perspective',
      'Clarity',
    ]);
  });

  it('Charms add the Light card of their Light', () => {
    expect(pack.starter.charms.map((id) => pack.keepsakes[id]!.addsCard)).toEqual([
      'love.kind_word',
      'joy.bright_spark',
      'friendship.reach_out',
      'courage.brave_strike',
    ]);
    expect(pack.starter.tutorialCharm).toBe('ks.warm_locket');
  });

  it('every event option has a mechanical result; Heart costs are guarded', () => {
    for (const ev of Object.values(pack.events)) {
      for (const o of ev.options) {
        expect(o.result.length, `${ev.id} ${o.label}`).toBeGreaterThan(0);
        const heartCost = o.effects.find((e) => e.op === 'heart' && e.n < 0);
        if (heartCost && heartCost.op === 'heart') {
          expect(o.requires, `${ev.id} ${o.label}`).toEqual({ c: 'heart', op: '>', n: -heartCost.n });
        }
      }
    }
    expect(pack.events[pack.fallbackEvent]!.options[0]!.effects).toEqual([{ op: 'heart', n: 10 }]);
  });
});

// ---------------------------------------------------------------------------------------------------
// Player-facing text (DESIGN 2)
// ---------------------------------------------------------------------------------------------------

/** All strings in a value, recursively. */
function stringsIn(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) for (const x of v) stringsIn(x, out);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) stringsIn(x, out);
  return out;
}

function playerFacing(): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];
  const add = (where: string, ...texts: (string | undefined)[]) => {
    for (const t of texts) if (t) out.push({ where, text: t });
  };
  for (const c of cards) add(c.id, c.name, c.text, c.upgrade?.text, c.flavor);
  for (const s of Object.values(pack.statuses)) add(s.id, s.name, s.text);
  for (const c of Object.values(pack.companions)) add(c.id, c.name, c.text);
  for (const k of keepsakes) add(k.id, k.name, k.text, k.flavor);
  for (const [s, a] of Object.entries(pack.afterglows)) add(`afterglow ${s}`, a.name, a.text);
  for (const ev of Object.values(pack.events)) {
    add(ev.id, ev.title, ev.text);
    for (const o of ev.options) add(ev.id, o.label, o.result, o.after, o.requiresText);
  }
  for (const e of enemies as EnemyDef[]) {
    add(e.id, e.name, e.blurb, e.lines.resolved, e.lines.suppressed, ...e.lines.bark);
    for (const m of Object.values(e.moves)) add(e.id, m.name);
    for (const p of e.passives ?? []) add(e.id, p.name, p.text);
  }
  const { BANNED_WORDS: _banned, TITLE_PREMISE: _premise, ...exported } = content as Record<string, unknown>;
  void _banned;
  void _premise;
  for (const [name, value] of Object.entries(exported)) {
    if (name === 'defaultPack') continue;
    for (const t of stringsIn(value)) add(name, t);
  }
  return out;
}

describe('player-facing text (DESIGN 2)', () => {
  const banned = new RegExp(`\\b(${content.BANNED_WORDS.map((w) => w.replace(/ /g, '\\s+')).join('|')})`, 'i');

  it('uses no banned words', () => {
    const texts = playerFacing();
    expect(texts.length).toBeGreaterThan(300);
    for (const { where, text } of texts) expect(text, `${where}: "${text}"`).not.toMatch(banned);
  });

  it('the title premise is the canonical 1.1 text (its "aren\'t monsters" negation is the only exception)', () => {
    expect(content.TITLE_PREMISE).toBe(
      "Something in you has gone quiet and grey. You take your lantern and wade into the Mere, the lake where feelings go when nobody tends them. The Shades there aren't monsters. They're feelings that got too big to carry alone.",
    );
    expect(content.TITLE_PREMISE.replace("aren't monsters", '')).not.toMatch(banned);
  });

  it('uses no em dashes and no en dashes', () => {
    for (const { where, text } of playerFacing()) expect(text, where).not.toMatch(/[\u2013\u2014]/);
  });

  it('coach marks are at most 18 words', () => {
    for (const m of content.COACH_MARKS) expect(m.copy.split(/\s+/).length, m.id).toBeLessThanOrEqual(18);
  });

  it('Light and Shade display tables follow the wheel and the chart', () => {
    for (const l of LIGHTS) {
      const info = content.LIGHT_INFO[l];
      expect(cureOf(info.answers)).toBe(l);
      expect(info.dissonantVs).toBe(dissonantShadeOf(l));
      expect(info.color).toMatch(/^#[0-9A-F]{6}$/);
      expect(info.cbColor).toMatch(/^#[0-9A-F]{6}$/);
    }
    for (const s of SHADES) {
      const info = content.SHADE_INFO[s];
      expect(info.cure).toBe(cureOf(s));
      expect(dissonantShadeOf(info.dissonant)).toBe(s);
      expect(info.badAdvice).toBe(content.BAD_ADVICE[s]);
      expect(info.afterglow).toBe(pack.afterglows[s].name);
    }
  });
});
