// Keepsakes (DESIGN 9): 1 Compass, 4 Charms, 12 pool (5 common, 4 uncommon, 3 rare), 6 boss.
// Rule-changing Keepsakes are flags the engine reads; the rest are trigger hooks written in the DSL.

import { afflict, draw, guard, mend, status, summon } from '../engine/dsl';
import type { KeepsakeDef, KeepsakeId } from '../engine/types';

export const KEEPSAKES: KeepsakeDef[] = [
  // ---- fixed ----
  {
    id: 'ks.compass',
    name: 'The Compass',
    rarity: 'fixed',
    text: 'The Compass remembers the last Light you played. A card whose Light is next to it on the wheel is Harmonized: it counts as both Lights.',
    flags: ['harmony'],
    icon: 'compass',
  },

  // ---- Charms (choose 1 of 4) ----
  {
    id: 'ks.warm_locket',
    name: 'Warm Locket',
    rarity: 'charm',
    text: 'At the end of each combat you win, Mend 8.',
    on: { combatWon: { effects: [mend(8)] } },
    addsCard: 'love.kind_word',
    icon: 'locket',
  },
  {
    // Adds to the turn-1 draw itself (DESIGN 5.2 step 4: "Draw 5 + next_draw (+2 Sun Charm on turn 1)").
    id: 'ks.sun_charm',
    name: 'Sun Charm',
    rarity: 'charm',
    text: 'On turn 1 of each combat, draw 2 extra cards.',
    on: { combatStart: { effects: [status('next_draw', 2)] } },
    addsCard: 'joy.bright_spark',
    icon: 'sun',
  },
  {
    // L7: summons at turn 1 start (after 5.2's Guard reset), so Welcome Mat's +3 Guard from it is kept.
    id: 'ks.woven_bracelet',
    name: 'Woven Bracelet',
    rarity: 'charm',
    text: 'At the start of each combat, Summon a Lantern Moth.',
    on: { turn1Start: { effects: [summon('comp.lantern_moth')] } },
    addsCard: 'friendship.reach_out',
    icon: 'bracelet',
  },
  {
    id: 'ks.brave_pebble',
    name: 'Brave Pebble',
    rarity: 'charm',
    text: 'At the start of each combat, gain 1 Nerve.',
    on: { combatStart: { effects: [status('nerve', 1)] } },
    addsCard: 'courage.brave_strike',
    icon: 'pebble',
  },

  // ---- pool: common ----
  {
    id: 'ks.tuning_fork',
    name: 'Tuning Fork',
    rarity: 'common',
    text: 'The first time a card is Harmonized each turn, draw 1.',
    on: { harmonized: { effects: [draw(1)], limit: 'turn' } },
    icon: 'fork',
  },
  {
    id: 'ks.pressed_flower',
    name: 'Pressed Flower',
    rarity: 'common',
    text: 'Whenever you Resolve a Shade, Mend 3.',
    on: { resolved: { effects: [mend(3)] } },
    icon: 'flower',
  },
  {
    id: 'ks.yellow_umbrella',
    name: 'Yellow Umbrella',
    rarity: 'common',
    text: 'The first time each combat you would gain affliction stacks, gain none (from any source, including Chipped Teacup and Numb).',
    flags: ['umbrella'],
    icon: 'umbrella',
  },
  {
    // Adds to the turn-1 Spirit itself (DESIGN 5.2 step 3: "+1 Morning Tea on turn 1").
    id: 'ks.morning_tea',
    name: 'Morning Tea',
    rarity: 'common',
    text: 'On turn 1 of each combat, gain 1 extra Spirit.',
    on: { combatStart: { effects: [status('next_spirit', 1)] } },
    icon: 'tea',
  },
  {
    id: 'ks.warm_socks',
    name: 'Warm Socks',
    rarity: 'common',
    text: 'On turn 1 of each combat, gain 6 Guard.',
    on: { turn1Start: { effects: [guard(6)] } },
    icon: 'socks',
  },

  // ---- pool: uncommon ----
  {
    id: 'ks.prism_shard',
    name: 'Prism Shard',
    rarity: 'uncommon',
    text: 'Your first Harmonized card each turn costs 1 less.',
    flags: ['prism'],
    icon: 'prism',
  },
  {
    id: 'ks.journal',
    name: 'Journal',
    rarity: 'uncommon',
    text: 'Whenever you Tend a Buried card in combat, draw 1 and gain 3 Guard. (A Surfaced Resolve is not a Tend.)',
    on: { tended: { effects: [draw(1), guard(3)] } },
    icon: 'journal',
  },
  {
    id: 'ks.ember_lantern',
    name: 'Ember Lantern',
    rarity: 'uncommon',
    text: 'Whenever a Shade gains Flare, gain 2 Guard.',
    on: { shadeGainedFlare: { effects: [guard(2)] } },
    icon: 'lantern',
  },
  {
    id: 'ks.welcome_mat',
    name: 'Welcome Mat',
    rarity: 'uncommon',
    text: 'Whenever you Summon a Companion, gain 3 Guard.',
    on: { summoned: { effects: [guard(3)] } },
    icon: 'mat',
  },

  // ---- pool: rare ----
  {
    id: 'ks.paper_crane',
    name: 'Paper Crane',
    rarity: 'rare',
    text: 'Once per run, when your Heart would drop to 0, Mend to 25 instead.',
    flags: ['paperCrane'],
    icon: 'crane',
  },
  {
    id: 'ks.worn_diary',
    name: 'Worn Diary',
    rarity: 'rare',
    text: 'At the start of each combat, put your heaviest Buried card into your opening hand. Insights you create are always upgraded (including by a Surfaced Resolve).',
    flags: ['wornDiary', 'insightUpgraded'],
    icon: 'diary',
  },
  {
    id: 'ks.friendship_bracelet',
    name: 'Friendship Bracelet',
    rarity: 'rare',
    text: "Your Companions' hits count as the Lights of the Note (if the Note is empty: Friendship).",
    flags: ['companionsUseNote'],
    icon: 'band',
  },

  // ---- boss ----
  {
    // afflict (not status) so Yellow Umbrella can block it.
    id: 'ks.chipped_teacup',
    name: 'Chipped Teacup',
    rarity: 'boss',
    text: '+1 Spirit each turn. At the start of each combat, gain 3 Seething.',
    energyPerTurn: 1,
    on: { combatStart: { effects: [afflict('seething', 3)] } },
    icon: 'cup',
  },
  {
    id: 'ks.spiral_shell',
    name: 'Spiral Shell',
    rarity: 'boss',
    text: "+1 Spirit each turn. You can't Rest at Havens, and between acts you Mend only 50% of your missing Heart instead of to full.",
    energyPerTurn: 1,
    flags: ['noRest', 'halfActMend'],
    icon: 'shell',
  },
  {
    id: 'ks.lead_box',
    name: 'Lead Box',
    rarity: 'boss',
    text: "Buried cards in your hand never afflict you. You can't Tend. Surfaced Shades have +50% Intensity. (Resolving a Surfaced Shade still creates its Insight: it is not a Tend.)",
    flags: ['leadBox'],
    icon: 'box',
  },
  {
    id: 'ks.mirror_shard',
    name: 'Mirror Shard',
    rarity: 'boss',
    text: 'Lights directly across the wheel also Harmonize (Love and Courage, Joy and Hope, Friendship and Calm).',
    flags: ['mirror'],
    icon: 'mirror',
  },
  {
    id: 'ks.skeleton_key',
    name: 'Skeleton Key',
    rarity: 'boss',
    text: 'Inward plays can Tend any Buried card, whatever its type.',
    flags: ['skeletonKey'],
    icon: 'key',
  },
  {
    id: 'ks.lightning_rod',
    name: 'Lightning Rod',
    rarity: 'boss',
    text: 'DISSONANT hits deal x1 instead of x1/2 (the Shade still gains 1 Flare).',
    flags: ['lightningRod'],
    icon: 'rod',
  },
];

export const CHARMS: KeepsakeId[] = ['ks.warm_locket', 'ks.sun_charm', 'ks.woven_bracelet', 'ks.brave_pebble'];
/** The profile's first run gets Warm Locket automatically (3.2). */
export const TUTORIAL_CHARM: KeepsakeId = 'ks.warm_locket';
