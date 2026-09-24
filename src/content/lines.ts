// Player-facing lines (DESIGN 1.1, 4.2, 4.10, 7.4, 13, 15, 17.3). All text here is game text: warm, never clinical.

import type { EnemyDef, EnemyId, Shade } from '../engine/types';

export const GAME_TITLE = 'Heartward';
export const TAGLINE = 'Every feeling has a light.';

/** Title screen premise (1.1), shown on first launch. */
export const TITLE_PREMISE =
  "Something in you has gone quiet and grey. You take your lantern and wade into the Mere, the lake where feelings go when nobody tends them. The Shades there aren't monsters. They're feelings that got too big to carry alone.";

export const ACT_NAMES: Record<1 | 2 | 3, string> = { 1: 'The Shallows', 2: 'The Undertow', 3: 'The Deep' };

/** The "bad advice" line shown in each Shade's DISSONANT tooltip and floating text (4.2). */
export const BAD_ADVICE: Record<Shade, string> = {
  anger: 'Just calm down.',
  sadness: 'At least you have people who love you.',
  loneliness: 'Just go out and have fun!',
  fear: 'Come on, everyone else is doing it.',
  despair: 'Just pull yourself together.',
  anxiety: "Don't worry, it'll all work out.",
};

type ShadeLines = EnemyDef['lines'];

const GRUMBLE: ShadeLines = {
  bark: ['HMPH.', 'Nobody LISTENS.'],
  resolved: "Cools into a small ember and curls up by your boots. It's very warm, actually.",
  suppressed: 'It goes quiet. Not calm. Just quiet.',
};
const MOPE: ShadeLines = {
  bark: ["...It's fine.", "Don't mind me."],
  resolved: 'The drizzle stops. Mope blinks, and a very small rainbow peeks out from behind it.',
  suppressed: 'It sinks out of sight, still damp.',
};
const SKITTER: ShadeLines = {
  bark: ['What was that?!'],
  resolved: 'It uncurls. It was a moth all along. It would like to sit on your lantern.',
  suppressed: 'It scurries under a stone. You can still hear it, a little.',
};
const ECHO: ShadeLines = {
  bark: ['Anyone? ...anyone?'],
  resolved: "It calls out, and this time something answers. It's you.",
  suppressed: 'The echo fades. The quiet it leaves is louder.',
};

const SURFACED_RESOLVED = 'It was yours all along. You can hold it now.';
const SURFACED_SUPPRESSED = 'It sinks back down. The grey grows thicker.';
/** Surfaced Shades use their Shade's own bark, quieter (7.4). */
const surfaced = (bark: string): ShadeLines => ({
  bark: [bark],
  resolved: SURFACED_RESOLVED,
  suppressed: SURFACED_SUPPRESSED,
});

/** Endings (15.3). */
export const ENDINGS = {
  resolved:
    "Colour comes back all at once. It's loud. It's a lot. You laugh, and you're also crying a little, and that seems exactly right.",
  suppressed:
    "The grey settles. It's quiet. You made it through, and that counts. Some colours are still missing. Maybe next time.",
} as const;

/** Barks and farewells per Shade id (7.4). The Mask and The Numbness have no words (visual only). */
export const SHADE_LINES: Record<EnemyId, ShadeLines> = {
  'shade.grumble': GRUMBLE,
  'shade.mope': MOPE,
  'shade.skitter': SKITTER,
  'shade.doubt': {
    bark: ['...are you sure?'],
    resolved: 'It pops like a soap bubble.',
    suppressed: 'It fades.',
  },
  'shade.echo': ECHO,
  'shade.looming': {
    bark: ["I'M ENORMOUS."],
    resolved: "Up close, it's only a coat on a hook. It seems embarrassed about the whole thing.",
    suppressed: 'It shrinks back into the corner. The corner stays dark.',
  },
  'shade.kettle': {
    bark: ['Hhhhhhhhhhh.'],
    resolved: 'It clicks off. Somewhere, two cups of tea are poured. One is for you.',
    suppressed: "The lid is jammed on tight. Now and then you'll hear it rattle.",
  },
  'shade.mask': {
    bark: [],
    resolved: 'The mask falls away. Underneath is a face of pearl light, and it looks like yours.',
    suppressed: 'The mask settles on one expression and stays that way.',
  },
  'shade.tut_grumble': GRUMBLE,
  'shade.tut_mope': MOPE,
  'shade.tut_echo': ECHO,
  'shade.tut_skitter': SKITTER,
  'shade.fret': {
    bark: ['Did I leave the... what if...'],
    resolved: 'It stops pacing, sits down and says "oh" very softly, like someone who just remembered to breathe.',
    suppressed: "It hurries off. It'll be back to check on things.",
  },
  'shade.slump': {
    bark: ['Why bother.'],
    resolved: 'It sits up. Then stands. Then, astonishingly, stretches.',
    suppressed: 'It sinks a little deeper. So do you.',
  },
  'shade.old_grudge': {
    bark: ["I haven't forgotten.", "That's another one."],
    resolved: "It puts down the chalk. It can't remember what the tally was for.",
    suppressed: "It pockets the chalk. It's still counting.",
  },
  'shade.longing': {
    bark: ['Remember when...?'],
    resolved: 'It gives everything back, one thing at a time. It was keeping them safe.',
    suppressed: "It lets go all at once and doesn't look back.",
  },
  'shade.wallflower': {
    bark: ["Don't look at me."],
    resolved: "It steps off the wall. It's a sunflower, and it turns toward you.",
    suppressed: "It presses flatter against the wall until you can't see it.",
  },
  'shade.dread': {
    bark: ["It's coming.", 'Three.'],
    resolved: "The countdown reaches zero. The Thing arrives. It's morning.",
    suppressed: "The countdown freezes at one. It'll wait.",
  },
  'shade.knot': {
    bark: ['Too much. Too much. Too much.'],
    resolved: 'It loosens, and loosens, and turns out to be a very long, very warm scarf.',
    suppressed: 'It pulls itself tighter and rolls away.',
  },
  'shade.apathy': {
    bark: ['Meh.'],
    resolved: 'It blinks, slowly, like it just noticed the colour of the sky.',
    suppressed: "It shrugs and drifts off. It didn't care anyway. Probably.",
  },
  'shade.spiral': {
    bark: ["What if... what's the point... what if..."],
    resolved: 'It slows to a curl, then a line, then a path. It leads forward.',
    suppressed: "It winds itself small and burrows down. Some nights you'll feel it turning.",
  },
  'shade.numbness': { bark: [], resolved: ENDINGS.resolved, suppressed: ENDINGS.suppressed },
  'shade.surfaced_anger': surfaced('...hmph.'),
  'shade.surfaced_sadness': surfaced("...it's fine."),
  'shade.surfaced_loneliness': surfaced('anyone?'),
  'shade.surfaced_fear': surfaced('what was that?'),
  'shade.surfaced_despair': surfaced('...why bother.'),
  'shade.surfaced_anxiety': surfaced('what if...'),
};

/** Buried card and Insight moments (4.10, 18.1). */
export const BURIED_LINES = {
  flavor: 'Not gone. Just quiet.',
  insight: "Oh. So that's what it was.",
  peace: "You've already made peace with this one.",
} as const;

/** Mo the heron, random on Sanctuary entry (13). */
export const MO_LINES: readonly string[] = [
  'Found it on a Tuesday.',
  "No refunds. Herons don't do refunds.",
  "Shiny. Very shiny. You'll want that.",
];

/** Defeat screen (2, 15.2). Used for both Heart 0 and the turn limit. */
export const DEFEAT_TEXT = "Your Heart needs rest. The Lights will keep until you're back.";

/** Act transition title cards (15.1). */
export const TITLE_CARDS = {
  wheelCloses: { title: 'The wheel closes', text: 'Hope and Calm awaken.' },
  deep: { title: 'The Deep', text: "It's very quiet down here." },
} as const;

/** Banners and fixed UI sentences quoted in DESIGN 4 and 16. `{...}` are filled by the UI from engine data. */
export const BANNERS = {
  festering: 'The Shades fester.',
  shadesStir: 'The Shades stir',
  wavering: 'Finish it yourself',
  buriedFull: 'Buried {Shade} is full: lose 3 max Heart.',
  buriedJoins: 'Buried {Shade} joins your deck (Weight 1)',
  buriedWeight: 'Buried {Shade} W{from} -> W{to}',
  insightJoins: 'Insight: {Card} joins your hand',
  buriedReleased: 'Buried {Shade} is released',
  bossGrows: '{Boss} +{n} Intensity',
  resolveWith: 'Resolve with: {Card}',
  numbnessMeter: 'The Numbness: {n} will surface',
  isolatedCompanions: "Isolated: won't act",
  lethalToYou: 'Lethal: you will fall',
  companionLeaves: 'waves goodbye',
  awakensAct2: 'Awakens in Act 2',
  noLight: 'NO LIGHT',
  notEnoughHeart: 'Not enough Heart',
  newCardsRevealed: 'New cards were revealed',
} as const;

export interface CoachMark {
  id: string;
  /** Machine key for the triggering moment (the UI maps engine events to these). */
  trigger: string;
  /** Where the arrow points. */
  anchor: string;
  /** Max 18 words. Braced names ({Shade}, {Light}, {Card}, {Affliction}, {line}, {short effect}) come from the trigger event. */
  copy: string;
}

/** Coach marks (17.2, 17.3). C15 to C17 are authored copy for the Act 2 moments 17.2 names without text. */
export const COACH_MARKS: readonly CoachMark[] = [
  { id: 'C1', trigger: 't1Start', anchor: 'intent', copy: 'Shades show their next move. This one will strike for 5.' },
  {
    id: 'C2',
    trigger: 't1Start',
    anchor: 'card:love.kind_word',
    copy: "Kind Word is Love. Love is Anger's opposite, so it Eases double.",
  },
  { id: 'C3', trigger: 't1SpiritZero', anchor: 'endTurn', copy: 'Out of Spirit. End your turn and you get 3 back.' },
  {
    id: 'C4',
    trigger: 'firstResolvePreview',
    anchor: 'banner',
    copy: 'Finish a Shade with its opposite to Resolve it. It heals instead of vanishing.',
  },
  {
    id: 'C5',
    trigger: 'firstDissonantPreview',
    anchor: 'dissonantBadge',
    copy: "'{line}' {Light} alone deepens {Shade}: half, and it Flares.",
  },
  {
    id: 'C6',
    trigger: 'compassGranted',
    anchor: 'compass',
    copy: 'The Compass remembers your last Light. Its neighbours Harmonize and count as both.',
  },
  {
    id: 'C7',
    trigger: 'firstHarmonyChip',
    anchor: 'card',
    copy: '{Card} sits next to {Light}. Play it now and it counts as both.',
  },
  {
    id: 'C8',
    trigger: 'firstSuppressPreview',
    anchor: 'banner',
    copy: "Not its opposite, so this Suppresses it. You'll carry it as a Buried card.",
  },
  {
    id: 'C9',
    trigger: 'firstAffliction',
    anchor: 'afflictionChip',
    copy: '{Affliction} {short effect}. {Light} soothes it. Play {Light} on yourself to clear it.',
  },
  {
    id: 'C10',
    trigger: 'firstInwardTarget',
    anchor: 'inwardTarget',
    copy: 'Drop a card on yourself: clear your feeling and Tend what you buried.',
  },
  {
    id: 'C11',
    trigger: 'firstBuriedDrawn',
    anchor: 'card',
    copy: 'Buried {Shade} hurts while held. Play {Light} Inward to Tend it.',
  },
  {
    id: 'C12',
    trigger: 'firstWavering',
    anchor: 'shade',
    copy: 'Companions never finish a Shade the wrong way. Finish it yourself.',
  },
  {
    id: 'C13',
    trigger: 'firstMap',
    anchor: 'mapLegend',
    copy: 'Sigils show which Shades wait on each path. Pick fights your deck answers.',
  },
  {
    id: 'C14',
    trigger: 'firstTwoFaced',
    anchor: 'nameplate',
    copy: 'Two feelings. OPPOSITE hits turn it. A Blend answers both at once.',
  },
  {
    id: 'C15',
    trigger: 'firstMuffled',
    anchor: 'nameplate',
    copy: 'One Light is MUFFLED here. Two Lights at once are FELT: double.',
  },
  {
    id: 'C16',
    trigger: 'firstSurfacing',
    anchor: 'shade',
    copy: 'Your Buried cards rose first. Resolve one and it becomes Insight.',
  },
  {
    id: 'C17',
    trigger: 'numbnessStart',
    anchor: 'shade',
    copy: "One feeling isn't enough here. Feel two at once.",
  },
];
