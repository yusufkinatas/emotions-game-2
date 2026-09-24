// Memories (DESIGN 10) as RunEffect data. `result` is the bracketed mechanical result (the UI adds the brackets);
// `after` is the italic line shown after choosing. Effects after a deckSelect run once the card is picked.

import { LIGHTS } from '../engine/emotions';
import type { CardFilter, EventDef, EventId, RunCond, RunEffect } from '../engine/types';

const NOT_ENOUGH_HEART = 'Not enough Heart';
/** Options whose Heart cost is >= your current Heart are disabled (10). */
const heartAbove = (n: number): RunCond => ({ c: 'heart', op: '>', n });
const loseHeart = (n: number): RunEffect => ({ op: 'heart', n: -n });
const mendHeart = (n: number): RunEffect => ({ op: 'heart', n });

/** "Light cards available in the current act" (10): mono-Light reward cards (Blends have rarity 'blend'). */
const lightCards = (extra: CardFilter = {}): CardFilter => ({
  lights: [...LIGHTS],
  rarity: ['common', 'uncommon', 'rare'],
  available: true,
  ...extra,
});

export const EVENTS: EventDef[] = [
  {
    id: 'mem.unsent_letter',
    title: 'The Unsent Letter',
    text: 'Tucked in the reeds is a letter in your handwriting. You never sent it. You remember exactly what it says.',
    motif: 'letter',
    options: [
      {
        label: 'Read it aloud',
        result: 'Lose 6 Heart. Tend a Buried card of your choice. If you have none: upgrade 2 random cards.',
        requires: heartAbove(6),
        requiresText: NOT_ENOUGH_HEART,
        effects: [
          loseHeart(6),
          {
            op: 'if',
            cond: { c: 'buriedCount', op: '>=', n: 1 },
            then: [{ op: 'deckSelect', purpose: 'tend', filter: { buriedOnly: true } }],
            else: [{ op: 'upgradeRandom', n: 2, filter: { upgradable: true } }],
          },
        ],
      },
      {
        label: 'Fold it into a paper crane',
        result: 'Gain Paper Crane. Gain Buried Sadness (or +1 Weight; at Weight 3, lose 3 max Heart instead).',
        after: 'Some things fly better folded.',
        requires: { c: 'not', of: { c: 'hasKeepsake', id: 'ks.paper_crane' } },
        requiresText: 'You already carry a Paper Crane',
        effects: [
          { op: 'keepsake', id: 'ks.paper_crane' },
          { op: 'addBuried', shade: 'sadness' },
        ],
      },
      {
        label: 'Put it back',
        result: 'Nothing.',
        after: "Not today. That's allowed.",
        effects: [],
      },
    ],
  },
  {
    id: 'mem.campfire',
    title: 'The Campfire',
    text: "Three travellers wave you over. There's room on the log. Someone is toasting something that was probably bread once.",
    motif: 'campfire',
    options: [
      { label: 'Sit with them', result: 'Mend 16.', effects: [mendHeart(16)] },
      {
        label: 'Swap stories',
        result: 'Add a random upgraded Friendship card.',
        effects: [{ op: 'addCard', card: { random: lightCards({ lights: ['friendship'] }), upgraded: true } }],
      },
      {
        label: 'Take the first watch',
        result: 'Lose 5 Heart. Gain 45 Glimmers.',
        after: 'They insist on paying you, mostly in toast.',
        requires: heartAbove(5),
        requiresText: NOT_ENOUGH_HEART,
        effects: [loseHeart(5), { op: 'glimmers', n: 45 }],
      },
    ],
  },
  {
    id: 'mem.mirror_pond',
    title: 'The Mirror Pond',
    text: "The water is perfectly still. Your reflection looks like it's been waiting for you.",
    motif: 'pond',
    options: [
      {
        label: 'Look closer',
        result: 'Duplicate a card of your choice (not Buried, not Insight).',
        effects: [{ op: 'deckSelect', purpose: 'duplicate', filter: { notBuried: true, notInsight: true } }],
      },
      {
        // Choosable: mono-Light cards (the Light filter drops neutral and Buried cards, the rarity filter drops
        // Blends). The result (a random upgraded card of an adjacent available Light) is the transform purpose.
        label: 'Make a face',
        result:
          "Transform a card of your choice into a random upgraded card of a Light adjacent to its own (available Lights only). Neutral, Buried and Blend cards can't be chosen.",
        effects: [
          {
            op: 'deckSelect',
            purpose: 'transform',
            filter: { lights: [...LIGHTS], rarity: ['starter', 'common', 'uncommon', 'rare', 'special'] },
          },
        ],
      },
      {
        label: 'Skip a stone',
        result: 'Gain 20 Glimmers.',
        after: "It skips four times. You'll take that as a sign.",
        effects: [{ op: 'glimmers', n: 20 }],
      },
    ],
  },
  {
    id: 'mem.stuck_balloon',
    title: 'The Stuck Balloon',
    text: "A very small Mope sits under a tree. Its red balloon is caught in the branches. It isn't crying, exactly. It's being very brave about it.",
    motif: 'balloon',
    options: [
      {
        label: 'Climb up',
        result: 'Lose 7 Heart. Gain a random common Keepsake.',
        requires: heartAbove(7),
        requiresText: NOT_ENOUGH_HEART,
        effects: [loseHeart(7), { op: 'keepsake', id: { randomRarity: 'common' } }],
      },
      {
        label: 'Tell it a joke',
        result: 'If you have 3+ Joy cards: upgrade 2 random Joy cards. Otherwise: gain 10 Glimmers.',
        effects: [
          {
            op: 'if',
            cond: { c: 'lightCount', light: 'joy', op: '>=', n: 3 },
            then: [{ op: 'upgradeRandom', n: 2, filter: { lights: ['joy'], upgradable: true } }],
            else: [{ op: 'glimmers', n: 10 }],
          },
        ],
      },
      {
        label: 'Sit with it',
        result: 'Mend 8. Remove a card of your choice.',
        after: 'Nothing happens for a while. Then it leans on you.',
        effects: [mendHeart(8), { op: 'deckSelect', purpose: 'remove' }],
      },
    ],
  },
  {
    id: 'mem.tea_slowly',
    title: 'Tea, Slowly',
    text: 'An old tortoise runs a tea stall at the crossroads. The sign says OPEN, SLOWLY.',
    motif: 'teapot',
    options: [
      { label: 'Chamomile', result: 'Mend 12.', effects: [mendHeart(12)] },
      {
        label: 'Strong brew',
        result: 'Pay 25 Glimmers. Upgrade 2 random cards.',
        requires: { c: 'glimmers', op: '>=', n: 25 },
        requiresText: 'Needs 25 Glimmers',
        effects: [
          { op: 'glimmers', n: -25 },
          { op: 'upgradeRandom', n: 2, filter: { upgradable: true } },
        ],
      },
      {
        label: 'Ask for advice',
        result: 'Remove a card of your choice. If it was a Buried card, also Mend 6.',
        after: '"Put that down, dear. You\'ve been carrying it all day."',
        effects: [
          { op: 'deckSelect', purpose: 'remove' },
          { op: 'if', cond: { c: 'lastSelectedKind', kind: 'buried' }, then: [mendHeart(6)] },
        ],
      },
    ],
  },
  {
    id: 'mem.wishing_well',
    title: 'The Wishing Well',
    text: 'A well with a tin cup on a string. Someone scratched WISHES 10G on the rim, crossed out the 10, and wrote "whatever you can spare."',
    motif: 'well',
    options: [
      {
        label: 'Toss in 20 Glimmers',
        result: 'Add a random upgraded card: Hope in Act 2, any available Light in Act 1.',
        requires: { c: 'glimmers', op: '>=', n: 20 },
        requiresText: 'Needs 20 Glimmers',
        effects: [
          { op: 'glimmers', n: -20 },
          {
            op: 'if',
            cond: { c: 'act', op: '>=', n: 2 },
            then: [{ op: 'addCard', card: { random: lightCards({ lights: ['hope'] }), upgraded: true } }],
            else: [{ op: 'addCard', card: { random: lightCards(), upgraded: true } }],
          },
        ],
      },
      {
        label: 'Toss in everything',
        result: 'Pay all Glimmers (min 1). Add a random rare card. If you paid 80+, also gain a random Keepsake.',
        requires: { c: 'glimmers', op: '>=', n: 1 },
        requiresText: 'Needs 1 Glimmer',
        effects: [
          { op: 'payAll' },
          { op: 'addCard', card: { random: lightCards({ rarity: ['rare'] }), upgraded: false } },
          {
            op: 'if',
            cond: { c: 'lastPaid', op: '>=', n: 80 },
            then: [{ op: 'keepsake', id: { randomRarity: 'weighted' } }],
          },
        ],
      },
      {
        label: 'Shout into it',
        result: 'Fight an Echo. Resolve it: gain a random uncommon Keepsake. Suppress it: gain 30 Glimmers.',
        effects: [
          {
            op: 'combat',
            encounter: 'enc.mem.echo',
            onResolve: [{ op: 'keepsake', id: { randomRarity: 'uncommon' } }],
            onSuppress: [{ op: 'glimmers', n: 30 }],
          },
        ],
      },
    ],
  },
];

/** Used when every Memory has been seen this run (10). Not part of the random event pool. */
export const QUIET_MOMENT: EventDef = {
  id: 'mem.quiet_moment',
  title: 'A Quiet Moment',
  text: 'Nothing waits for you here. The water is still, and for a little while, so are you.',
  motif: 'still_water',
  options: [{ label: 'Breathe', result: 'Mend 10.', effects: [mendHeart(10)] }],
};

export const FALLBACK_EVENT: EventId = QUIET_MOMENT.id;
