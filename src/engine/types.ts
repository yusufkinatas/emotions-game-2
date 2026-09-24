// THE CONTRACT (DESIGN.md section 20). Every module builds against these types.
// Lead-owned: changes must be additive. Internal names are mechanical (hp, guard, energy);
// display words live in src/content/glossary.ts.

import type { AfflictionId, Blend, LethalOutcome, Light, Relation, Shade } from './emotions';
import type { RulesConfig } from './rules';

export type { AfflictionId, Blend, LethalOutcome, Light, Relation, Shade } from './emotions';
export type { RulesConfig } from './rules';

export type Uid = number;
export type CardId = string;
export type EnemyId = string;
export type StatusId = string;
export type KeepsakeId = string;
export type EventId = string;
export type EncounterId = string;
export type CompanionId = string;

// =====================================================================================================
// Effect DSL (content data). Interpreted by src/engine/interpreter.ts.
// =====================================================================================================

/**
 * Things an Amount or Cond can count.
 * - playedThisTurn: cards played earlier this turn (the card being resolved is not counted yet).
 * - companions: Companions you currently have.
 * - turn: current turn number (1-based).
 * - unspentEnergy: Spirit you have right now.
 * - incoming: total strike damage of all Shades' displayed intents (after Flare and Hush, before your Guard).
 * - promisesMade: Promises created this combat.
 * - lingered: turns the card being resolved has Lingered this combat.
 * - timesPlayed: times the card being resolved was played earlier this combat.
 * - buriedInHand: Buried cards in your hand.
 * - { status, on }: stacks of a status. on 'self' = the acting entity (the player for cards, Moods,
 *   Keepsakes and Companions; the Shade for Shade moves and passives), 'target' = the current target Shade,
 *   'player' = the player.
 */
export type Countable =
  | 'playedThisTurn'
  | 'companions'
  | 'turn'
  | 'unspentEnergy'
  | 'incoming'
  | 'promisesMade'
  | 'lingered'
  | 'timesPlayed'
  | 'buriedInHand'
  | { status: StatusId; on: 'self' | 'target' | 'player' };

/** A number, or add + count(per) * mult, clamped to [min, max]. */
export type Amount = number | { add?: number; per?: Countable; mult?: number; min?: number; max?: number };

export type CmpOp = '>=' | '<=' | '==' | '>' | '<';

export type Cond =
  /** The card being resolved is Harmonized (always false outside card effects). */
  | { c: 'harmonized' }
  /** The current target's displayed intent includes a strike. */
  | { c: 'targetIntendsAttack' }
  /** Any Shade's displayed intent includes a strike. */
  | { c: 'anyIntendsAttack' }
  /** The player has 0 Guard. */
  | { c: 'noGuard' }
  | { c: 'noCompanions' }
  /** A hit from the card being resolved Suppressed its target (Push It Down). */
  | { c: 'suppressedTarget' }
  /** The acting Shade is the only Shade on the field (Fleeting Shades count). */
  | { c: 'onlyShade' }
  /** R-2b: effective Lights of the triggering card or hit (passives) or of the card being resolved. */
  | { c: 'sourceLights'; has: Light[]; mode: 'any' | 'none' | 'all' }
  /** A memory flag on the acting Shade (see Effect mark/unmark). */
  | { c: 'marked'; key: string }
  | { c: 'status'; id: StatusId; on: 'self' | 'player' | 'target'; op: CmpOp; n: number }
  /** Cards the player played during their most recent completed turn. */
  | { c: 'playedLastTurn'; op: CmpOp; n: number }
  /** A card whose effective Lights include this Light was played this player turn. */
  | { c: 'playedLightThisTurn'; light: Light }
  /** In hitTaken/cardHitResolved passives: the triggering hit came from a card you played. */
  | { c: 'hitFromCard' }
  /** In hitTaken passives: the triggering hit's relation. */
  | { c: 'relation'; is: Relation[] }
  | { c: 'count'; of: Countable; op: CmpOp; n: number }
  | { c: 'and'; of: Cond[] }
  | { c: 'or'; of: Cond[] }
  | { c: 'not'; of: Cond };

/**
 * Effects. In card/Mood/Keepsake/Companion/Afterglow context "self" is the player.
 * In a Shade's moves and passives, 'guard', 'mend' (to self), 'status'/'setStatus' (to self) apply to that Shade.
 */
export type Effect =
  // ---- player-side ----
  /** Ease: hit Shades through the damage pipeline (DESIGN 5.4). times defaults to 1, to defaults to 'target'. */
  | { op: 'hit'; amount: Amount; times?: Amount; to?: 'target' | 'all' }
  /** Gain Guard (player: Trembling applies to card and Mood Guard; Shade: unmodified). */
  | { op: 'guard'; amount: Amount }
  /** Mend: restore Heart (player) or Intensity (a Shade's own passive, to 'self'). */
  | { op: 'mend'; amount: Amount; to?: 'player' | 'self' }
  /** Add stacks (negative removes). Clamped by StatusDef min/max. 'all' = every targetable Shade. */
  | { op: 'status'; id: StatusId; stacks: Amount; to: 'player' | 'target' | 'all' | 'self' }
  /** Set a status to exactly n (gauges: Pressure = 0, Countdown = 3). */
  | { op: 'setStatus'; id: StatusId; n: number; to: 'player' | 'target' | 'self' }
  | { op: 'clearStatus'; id: StatusId; to: 'player' | 'target' | 'self' }
  | { op: 'draw'; n: Amount }
  | { op: 'energy'; n: Amount }
  | { op: 'summon'; companion: CompanionId }
  /** Your Companions act now (in addition to their end-of-turn action). */
  | { op: 'companionsAct' }
  /** Pending effect resolved at the start of your next turn (R-14). Hits are automatic and carry the card's Lights. */
  | { op: 'promise'; effects: Effect[] }
  /** Center: the next card you play this turn costs 0. */
  | { op: 'nextCardFree' }
  /** Look Inward: put a Buried card from your draw or discard pile into your hand (choice if 2+). */
  | { op: 'fetchBuried' }
  /** Sit With It: Tend a Buried card in your hand, whatever its type (choice if 2+). */
  | { op: 'tendAny' }
  /** Remove all your afflictions except Numb. */
  | { op: 'removeAfflictions' }
  /** Serenity: at this end of turn every non-Buried card in your hand Lingers. */
  | { op: 'lingerHand' }
  // ---- Shade-side ----
  /** Strike the player. Per strike: base + Flare - Hush, min 0. */
  | { op: 'strike'; amount: Amount; times?: Amount }
  /** Give the player affliction stacks (Yellow Umbrella can block the first). */
  | { op: 'afflict'; id: AfflictionId | 'numb'; stacks: number }
  /** Summon a Shade directly to the right of the acting Shade. max = cap of this summoner's live summons. */
  | { op: 'spawn'; enemy: EnemyId; max: number }
  /** Your N oldest Companions leave. */
  | { op: 'scatter'; n: number }
  | { op: 'mark'; key: string }
  | { op: 'unmark'; key: string }
  // ---- shared ----
  | { op: 'if'; cond: Cond; then: Effect[]; else?: Effect[] }
  /** Named hook implemented in src/engine/custom.ts. Content may only use ids listed in CUSTOM_HOOK_IDS. */
  | { op: 'custom'; id: string; args?: Record<string, number | string> };

// =====================================================================================================
// Content definitions
// =====================================================================================================

export type CardKind = 'ease' | 'skill' | 'mood' | 'buried';
export type Rarity = 'starter' | 'common' | 'uncommon' | 'rare' | 'blend' | 'special';
export type Keyword = 'linger' | 'letGo' | 'innate' | 'reachesShy';

export interface MoodDef {
  on: 'turnStart' | 'turnEnd' | 'heartLostFromMove';
  if?: Cond;
  effects: Effect[];
  /** Fires at most once per enemy phase (Unconditional). */
  oncePerEnemyPhase?: boolean;
}

/**
 * Card text templates: `{0}`, `{1}`, ... are SLOTS. Slots are collected by a depth-first walk over the
 * card's effect list (then-branch before else-branch, promise contents in place), one slot per effect that
 * has a primary number: hit.amount, guard.amount, mend.amount, status.stacks, draw.n, energy.n.
 * The engine renders each slot as the evaluated Amount in context (card-face: with your Nerve/Heavy/Trembling;
 * against a target: the final number). `{w}` renders a Buried card's Weight.
 * Example Unguarded: effects [if(noGuard, [hit 11], [hit 5])] -> slots [11, 5] ->
 *   text 'Ease {1}. If you have no Guard, Ease {0} instead.'
 * `upgrade.text` replaces `text` when upgraded (use it whenever a literal number in the text changes).
 */
export interface CardDef {
  id: CardId;
  name: string;
  /** [] = neutral or Buried, 1 = mono, 2 = Blend (adjacent pair, wheel order). */
  lights: readonly Light[];
  kind: CardKind;
  rarity: Rarity;
  cost: number | 'unplayable';
  /** Cost reduction: cost += count(per) * mult (mult is negative for discounts). Min cost 0. */
  costMod?: { per: Countable; mult: number };
  target: 'enemy' | 'all' | 'self' | 'none';
  effects: Effect[];
  keywords?: Keyword[];
  /** Lasting effects of a Mood (kind 'mood') after it is played outward. `effects` still run on play. */
  mood?: MoodDef[];
  upgrade?: {
    cost?: number;
    effects?: Effect[];
    keywords?: Keyword[];
    mood?: MoodDef[];
    costMod?: { per: Countable; mult: number };
    text?: string;
  };
  text: string;
  flavor?: string;
  /** Buried cards only. */
  buried?: { shade: Shade; insight: CardId };
  /** Insight cards only: the Shade whose Buried card becomes this. */
  insightOf?: Shade;
  /** Act from which rewards/shops may offer it (Hope, Calm and three Blends are 2). */
  availableFromAct: 1 | 2;
}

export interface StatusDef {
  id: StatusId;
  name: string;
  owner: 'player' | 'enemy';
  polarity: 'buff' | 'debuff' | 'gauge' | 'flag';
  /** Afflictions decay 1 at the end of your turn (R-6). */
  affliction?: AfflictionId | 'numb';
  decay: 'playerTurnEnd' | 'never' | 'consumedOnUse';
  max?: number;
  min?: number;
  /** Tooltip text; `{n}` = stacks. */
  text: string;
}

export type IntentKind = 'strike' | 'guard' | 'afflict' | 'buff' | 'mend' | 'summon' | 'scatter';

export interface MoveDef {
  name: string;
  intent: IntentKind[];
  effects: Effect[];
}

export type IntentPatternSimple =
  | { kind: 'cycle'; moves: string[]; overrides?: { if: Cond; move: string }[] }
  | { kind: 'byFace'; moves: Partial<Record<Shade, string>>; overrides?: { if: Cond; move: string }[] };

/**
 * cycle: moves in order from the rolled start offset. byFace: move chosen by the showing face.
 * overrides: while the condition holds the intent is the override move (re-derived on every gauge change);
 * override moves do not advance the cycle index (M13).
 * phases: switch pattern when Intensity first drops to atOrBelowPct percent of max (first phase uses 100).
 */
export type IntentPattern =
  | IntentPatternSimple
  | { kind: 'phases'; phases: { atOrBelowPct: number; pattern: IntentPatternSimple }[] };

export type PassiveTrigger =
  | 'combatStart'
  | 'afterOwnAction'
  | 'playerTurnEnd'
  /** After each hit on this Shade (non-lethal). Context: the hit's Lights, relation, fromCard. */
  | 'hitTaken'
  /** After a card that hit this Shade finishes resolving (once per card). Context: the card's effective Lights. */
  | 'cardHitResolved'
  /** After any card is played (outward or Inward). Context: the card's effective Lights. */
  | 'cardPlayed'
  /** After another Shade leaves the field. */
  | 'shadeLeft'
  /** The first time Intensity is at or below thresholdPct percent of max. */
  | 'hpThreshold'
  /** After this Shade's face turns. */
  | 'faceTurned';

export interface PassiveDef {
  name: string;
  on: PassiveTrigger;
  thresholdPct?: number;
  if?: Cond;
  effects: Effect[];
  once?: boolean;
  /** Short rules text for the passive chip tooltip. Only needed on the first entry of a named passive. */
  text?: string;
}

export interface EnemyDef {
  id: EnemyId;
  name: string;
  /** [] = numb rules (Apathy, The Numbness). 1 = single Shade. 2 = compound (outer first). 4 = The Mask. */
  faces: readonly Shade[];
  hp: [min: number, max: number];
  tier: 'normal' | 'elite' | 'boss' | 'final' | 'minion' | 'surfaced';
  fleeting?: boolean;
  summoner?: boolean;
  shy?: boolean;
  /** The Mask: also turns at the end of each of its own actions. */
  turnsAfterAction?: boolean;
  /** The Mask (M1): your hits can turn it at most this many times per player turn. */
  maxTurnsPerPlayerTurn?: number;
  /** Apathy { surface: 1, hpPerHiddenWeight: 0 }, The Numbness { surface: 3, hpPerHiddenWeight: 6 }. */
  numbRules?: { surface: 1 | 3; hpPerHiddenWeight: number };
  moves: Record<string, MoveDef>;
  pattern: IntentPattern;
  passives?: PassiveDef[];
  lines: { bark: string[]; resolved: string; suppressed: string };
  visual: { family: Shade | 'doubt' | 'mask' | 'numb'; scale: number };
  /** One-line description for the Codex. */
  blurb?: string;
}

export interface EncounterDef {
  id: EncounterId;
  members: { enemy: EnemyId; hp?: [number, number] }[];
}

export interface CompanionDef {
  id: CompanionId;
  name: string;
  /** Lights of its hits (Friendship). */
  lights: readonly Light[];
  act: Effect[];
  text: string;
}

export type KeepsakeTrigger =
  | 'combatStart'
  | 'turnStart'
  | 'turn1Start'
  | 'turnEnd'
  | 'harmonized'
  | 'resolved'
  | 'summoned'
  | 'tended'
  | 'shadeGainedFlare'
  | 'combatWon';

export type KeepsakeFlag =
  | 'harmony'
  | 'mirror'
  | 'lightningRod'
  | 'leadBox'
  | 'skeletonKey'
  | 'noRest'
  | 'halfActMend'
  | 'insightUpgraded'
  | 'companionsUseNote'
  | 'prism'
  | 'umbrella'
  | 'paperCrane'
  | 'wornDiary';

export interface KeepsakeHook {
  effects: Effect[];
  /** Fire at most once per player turn / per combat. */
  limit?: 'turn' | 'combat';
}

export interface KeepsakeDef {
  id: KeepsakeId;
  name: string;
  rarity: 'fixed' | 'charm' | 'common' | 'uncommon' | 'rare' | 'boss';
  text: string;
  flavor?: string;
  on?: Partial<Record<KeepsakeTrigger, KeepsakeHook>>;
  flags?: KeepsakeFlag[];
  energyPerTurn?: number;
  /** Charms: card added to the starter deck. */
  addsCard?: CardId;
  /** Icon hint for the UI (a short generic word, e.g. 'compass', 'locket'). */
  icon?: string;
}

export interface KeepsakeInstance {
  id: KeepsakeId;
  counter: number;
}

export type RunCond =
  | { c: 'glimmers' | 'buriedCount' | 'heart' | 'upgradable'; op: CmpOp; n: number }
  | { c: 'lightCount'; light: Light; op: CmpOp; n: number }
  | { c: 'hasKeepsake'; id: KeepsakeId }
  /** Current act (1, 2, or 3 = The Deep). Wishing Well: "Hope in Act 2, any available Light in Act 1". */
  | { c: 'act'; op: CmpOp; n: number }
  /** Kind of the card picked by the most recent deckSelect (Tea, Slowly: "If it was a Buried card"). */
  | { c: 'lastSelectedKind'; kind: CardKind }
  | { c: 'not'; of: RunCond };

export interface CardFilter {
  kinds?: CardKind[];
  lights?: Light[];
  rarity?: Rarity[];
  notBuried?: boolean;
  notInsight?: boolean;
  buriedOnly?: boolean;
  upgradable?: boolean;
  /** Only cards available in the current act (DESIGN 6.0). */
  available?: boolean;
  /** Light cards of a Light adjacent to the chosen card's own (Mirror Pond transform). */
  blend?: boolean;
}

export type DeckSelectPurpose = 'remove' | 'upgrade' | 'transform' | 'duplicate' | 'tend';

/**
 * Where a deckSelect came from.
 * - shop: a Sanctuary service, paid when the card is chosen (skip is free).
 * - haven: Kindle or Reflect; choosing finishes the Haven, skipping returns to it.
 * - effects: an event (or event-combat) effect list; `continuation` runs after the choice with a stream
 *   seeded from `seed`.
 */
export type DeckSelectOrigin =
  | { kind: 'shop'; service: 'remove' | 'talk'; price: number }
  | { kind: 'haven' }
  | { kind: 'effects'; continuation: RunEffect[]; seed: number };

export type RunEffect =
  | { op: 'heart' | 'maxHeart' | 'glimmers'; n: number }
  /** Pay all Glimmers (min 1) and remember the amount for the following 'if' (RunCond 'lastPaid'). */
  | { op: 'payAll' }
  | { op: 'addCard'; card: CardId | { random: CardFilter; upgraded: boolean } }
  | { op: 'addBuried'; shade: Shade }
  | { op: 'upgradeRandom'; n: number; filter?: CardFilter }
  | { op: 'deckSelect'; purpose: DeckSelectPurpose; filter?: CardFilter }
  | { op: 'keepsake'; id: KeepsakeId | { randomRarity: 'common' | 'uncommon' | 'rare' | 'weighted' } }
  /** Start a combat; after it, apply onResolve if its (single) Shade was Resolved, else onSuppress. No card reward. */
  | { op: 'combat'; encounter: EncounterId; onResolve: RunEffect[]; onSuppress: RunEffect[] }
  | { op: 'if'; cond: RunCond | { c: 'lastPaid'; op: CmpOp; n: number }; then: RunEffect[]; else?: RunEffect[] };

export interface EventOption {
  label: string;
  /** Bracketed mechanical result shown on the button. */
  result: string;
  /** Italic line shown after choosing. */
  after?: string;
  requires?: RunCond;
  /** Shown when requires fails. */
  requiresText?: string;
  effects: RunEffect[];
}

export interface EventDef {
  id: EventId;
  title: string;
  text: string;
  options: EventOption[];
  /** Procedural illustration motif hint for the UI. */
  motif?: string;
}

export interface RowPools {
  early: EncounterId[];
  row3?: EncounterId[];
  standard: EncounterId[];
  elite: EncounterId[];
  boss: EncounterId;
}

export interface ContentPack {
  cards: Record<CardId, CardDef>;
  enemies: Record<EnemyId, EnemyDef>;
  encounters: Record<EncounterId, EncounterDef>;
  statuses: Record<StatusId, StatusDef>;
  companions: Record<CompanionId, CompanionDef>;
  keepsakes: Record<KeepsakeId, KeepsakeDef>;
  events: Record<EventId, EventDef>;
  afterglows: Record<Shade, { name: string; effects: Effect[]; text: string }>;
  pools: { act1: RowPools; act2: RowPools; deep: EncounterId; tutorial: EncounterId[] };
  starter: { deck: CardId[]; charms: KeepsakeId[]; tutorialCharm: KeepsakeId };
  /** Fallback event when all events are used ("A Quiet Moment"). */
  fallbackEvent: EventId;
  rules: Partial<RulesConfig>;
}

// =====================================================================================================
// Game state (plain JSON; engine steps never mutate their input)
// =====================================================================================================

export interface CardInstance {
  uid: Uid;
  defId: CardId;
  upgraded: boolean;
  /** Buried cards only. */
  weight?: 1 | 2 | 3;
  peakWeight?: 1 | 2 | 3;
}

export interface CombatCard extends CardInstance {
  mem: { lingered: number; timesPlayed: number; tended: boolean; lingerThisTurn: boolean };
}

export type StatusBag = Partial<Record<StatusId, number>>;

export interface MapNode {
  id: number;
  row: number;
  col: number;
  next: number[];
  kind: 'fight' | 'elite' | 'haven' | 'sanctuary' | 'memory' | 'chest' | 'boss';
  /** Pre-rolled at map generation. hps is index-aligned with the encounter members. */
  encounter?: { id: EncounterId; hps: number[] };
  seed: number;
}

export interface MapState {
  act: 1 | 2 | 3;
  nodes: MapNode[];
  /** Current node id (null before the first move of an act). */
  current: number | null;
  visited: number[];
}

export interface RunStats {
  floors: number;
  resolved: number;
  deepResolved: number;
  suppressed: number;
  insights: number;
  harmonies: number;
  tends: number;
  combats: number;
  cardsPlayed: number;
  playsByLight: Record<Light, number>;
  playsByCard: Record<CardId, number>;
  dmgByRelation: Record<Relation, number>;
  heartLost: number;
}

export interface RunState {
  heart: number;
  maxHeart: number;
  glimmers: number;
  deck: CardInstance[];
  /** Acquisition order = trigger order. */
  keepsakes: KeepsakeInstance[];
  /** 3 = The Deep. */
  act: 1 | 2 | 3;
  /** Floors entered this run, counting the current one (the same number as stats.floors, "Floors reached" in 15.4). */
  floor: number;
  tutorial: boolean;
  map: MapState;
  combatsWon: number;
  usedEvents: EventId[];
  shopRemovals: number;
  paperCraneUsed: boolean;
  /** B3: Insight ids created this run (each at most once). */
  insightsMade: CardId[];
  /** Glimmers paid by the last payAll RunEffect. */
  lastPaid: number;
  /** Def id of the card picked by the most recent deckSelect (before the change was applied). */
  lastSelected?: CardId | null;
  stats: RunStats;
}

export interface EnemyState {
  uid: Uid;
  defId: EnemyId;
  hp: number;
  maxHp: number;
  guard: number;
  /** flare, hush, understood, wavering, worry, pressure, tension, tally, countdown, coil, veiled... */
  statuses: StatusBag;
  /** faces.length === 0 means numb rules. */
  faces: Shade[];
  faceIndex: number;
  /** Cause only; numbers are derived by intents(). */
  intent: { moveId: string } | null;
  /** index = cycle position; phase = index into a phases pattern. */
  pattern: { index: number; phase: number };
  fleeting: boolean;
  summonerUid: Uid | null;
  /** Buried card uid this Surfaced Shade came from. */
  surfacedFrom: Uid | null;
  /** Passive memory flags and counters (marks, once flags, turnsThisPlayerTurn...). */
  memory: Record<string, number>;
  /** Threshold percents already fired (hpThreshold passives and phases). */
  thresholdsFired: number[];
}

export interface CompanionState {
  uid: Uid;
  defId: CompanionId;
}

export interface PromiseState {
  dueTurn: number;
  effects: Effect[];
  lights: Light[];
  targetUid: Uid | null;
  sourceUid: Uid;
}

export interface EffectCtx {
  /** 'card' for the card being played (and its Mood effects), else the automatic source. */
  source: 'card' | 'mood' | 'promise' | 'companion' | 'keepsake' | 'afterglow' | 'enemy';
  /** Card uid (card/mood/promise), companion uid, enemy uid, or 0. */
  sourceUid: Uid;
  targetUid: Uid | null;
  lights: Light[];
  harmonized: boolean;
  /** True only for hits from the card being played right now. */
  fromCard: boolean;
  /** Set when a hit from this card Suppressed its target (Push It Down). */
  suppressedTarget?: boolean;
  /** hitTaken passives: relation of the triggering hit (Cond 'relation'). */
  relation?: Relation;
}

export interface Frame {
  effects: Effect[];
  pc: number;
  ctx: EffectCtx;
}

export interface PendingChoice {
  purpose: 'toHand' | 'tend';
  options: Uid[];
  /** Remaining work to run after the choice (stack of frames, top last). */
  continuation: Frame[];
  /** The card play the choice interrupted; its cleanup (5.3 step 8) runs after the continuation. */
  play?: {
    uid: Uid;
    target: Uid | null;
    lights: Light[];
    harmonized: boolean;
    /** Shades hit by the card so far (cardHitResolved passives). */
    hit: Uid[];
    cost: number;
    suppressed: boolean;
  };
}

export interface CombatStats {
  resolved: number;
  deepResolved: number;
  suppressed: number;
  harmonies: number;
  tends: number;
  insights: number;
  cardsPlayed: number;
  playsByLight: Partial<Record<Light, number>>;
  playsByCard: Record<CardId, number>;
  dmgByRelation: Partial<Record<Relation, number>>;
  heartLost: number;
}

/** A Shade that left the field, kept for the reward outcome strip and Full Bloom. */
export interface GoneEnemy {
  uid: Uid;
  defId: EnemyId;
  outcome: LethalOutcome;
  /** Showing face when it left (null for numb rules). */
  face: Shade | null;
}

export type DeckMutation =
  /** Suppressed a Shade showing `shade`: add Buried W1, or +1 Weight, or overflow -N max Heart. */
  | { k: 'suppress'; shade: Shade }
  /** In-combat Tend of a deck card: Weight -1. */
  | { k: 'tend'; uid: Uid }
  /** Buried -> Insight. */
  | { k: 'transform'; uid: Uid; to: CardId; upgraded: boolean }
  /** B3: Buried reached Weight 0 but its Insight was already made this run: remove it. */
  | { k: 'remove'; uid: Uid }
  /** Surfaced Shade Suppressed: its card returns unchanged (no Weight change). */
  | { k: 'returnSurfaced'; uid: Uid };

export interface CombatState {
  nodeId: number | null;
  encounter: EncounterId;
  tier: 'normal' | 'elite' | 'boss' | 'final' | 'event' | 'tutorial';
  turn: number;
  energy: number;
  player: { hp: number; maxHp: number; guard: number; statuses: StatusBag };
  /** Combat copies keep the deck instance uid. */
  cards: Record<Uid, CombatCard>;
  /**
   * removed = Surfaced Buried cards and B3-removed Buried cards. draw[0] is the top of the draw pile.
   * play = the card being played (between 5.3 steps 4 and 8, incl. while a choice is pending); the engine
   * always sets it (optional only so hand-built fixtures stay valid).
   */
  piles: { draw: Uid[]; hand: Uid[]; discard: Uid[]; letGo: Uid[]; moods: Uid[]; removed: Uid[]; play?: Uid[] };
  /** Array order = position = action order (left to right). */
  enemies: EnemyState[];
  gone: GoneEnemy[];
  /** Summon order. */
  companions: CompanionState[];
  /** R-4: printed Lights of the last Light card played this combat. */
  note: Light[];
  /** R-13: last Shade you targeted with a card. */
  lastTarget: Uid | null;
  turnFlags: {
    played: number;
    harmonies: number;
    firstCardDone: boolean;
    centerActive: boolean;
    prismUsed: boolean;
    lightsThisTurn: Light[];
  };
  /** Keepsake hook fire counts for 'turn'/'combat' limits: key `${id}:${trigger}`. Turn keys reset each turn. */
  keepsakeFired: Record<string, number>;
  /** Mood card uids that fired a oncePerEnemyPhase effect this enemy phase. */
  moodFiredThisPhase: Uid[];
  playedLastTurn: number;
  promises: PromiseState[];
  promisesMade: number;
  pending: PendingChoice | null;
  rng: { shuffle: number; ai: number };
  umbrellaUsed: boolean;
  paperCraneUsed: boolean;
  /** Chronological; applied to the run by finishCombat. */
  mutations: DeckMutation[];
  /** Glimmers earned this combat from Resolves (base is added at finish). */
  glimmers: number;
  /** Max Heart change this combat (Buried overflow is applied at finish, not here). */
  maxHeartDelta: number;
  outcome: null | 'won' | 'lost';
  lossCause: null | 'heart' | 'turnLimit';
  stats: CombatStats;
}

export interface CombatResult {
  outcome: 'won' | 'lost';
  heartAfter: number;
  glimmers: number;
  mutations: DeckMutation[];
  keepsakeCounters: Record<KeepsakeId, number>;
  paperCraneUsed: boolean;
  allResolved: boolean;
  gone: GoneEnemy[];
  stats: CombatStats;
}

export interface RewardOffer {
  source: 'fight' | 'elite' | 'boss' | 'chest' | 'event';
  glimmers: number;
  /** The Compass is granted on this screen (2nd combat win). */
  compass: boolean;
  keepsakes: KeepsakeId[];
  /** true: choose 1 of keepsakes (boss); false: all keepsakes are granted with 'takeKeepsake'. */
  keepsakeChoice: boolean;
  cards: CardId[];
  taken: { keepsake: boolean; card: boolean };
  outcomes: GoneEnemy[];
  /** 12.2 Full Bloom: a fight or elite where every non-Fleeting Shade was Resolved, so `cards` has a 4th option. */
  fullBloom: boolean;
  /** Where 'continue' goes. */
  then: 'map' | 'wheelCloses' | 'deep' | 'victory';
}

export interface ShopItem {
  kind: 'card' | 'keepsake';
  id: CardId | KeepsakeId;
  price: number;
  sale: boolean;
  sold: boolean;
}

export interface ShopStock {
  items: ShopItem[];
  removeUsed: boolean;
  talkUsed: boolean;
  removePrice: number;
  talkPrice: number;
  line: string;
}

export type Phase =
  | { kind: 'charmSelect'; options: KeepsakeId[] }
  | { kind: 'map' }
  | { kind: 'combat'; nodeId: number | null }
  | { kind: 'reward'; offer: RewardOffer }
  | { kind: 'wheelCloses'; options: CardId[] }
  | { kind: 'shop'; stock: ShopStock }
  | { kind: 'haven' }
  | { kind: 'event'; eventId: EventId; chosen: number | null }
  | {
      kind: 'deckSelect';
      purpose: DeckSelectPurpose;
      /** Deck uids that may be chosen. */
      options: Uid[];
      /** Phase to return to after the choice (or on skip, if skippable). */
      then: Phase;
      skippable: boolean;
      /** What opened the selection (payment, where a choice leads, remaining event effects). */
      origin?: DeckSelectOrigin;
    }
  | { kind: 'victory'; ending: 'resolved' | 'suppressed' }
  | { kind: 'defeat'; cause: 'heart' | 'turnLimit' };

export interface GameState {
  v: 1;
  /** Hash of pack ids + rules; saves from another build are discarded. */
  contentHash: string;
  seed: number;
  nextUid: Uid;
  phase: Phase;
  run: RunState;
  /** Non-null iff phase.kind === 'combat'. */
  combat: CombatState | null;
  /** Pending event-combat continuation (RunEffect 'combat'). */
  eventCombat: { onResolve: RunEffect[]; onSuppress: RunEffect[] } | null;
}

// =====================================================================================================
// Actions, events, views, engine API
// =====================================================================================================

export type Action =
  | { t: 'pickCharm'; i: number }
  | { t: 'move'; node: number }
  | { t: 'play'; card: Uid; target?: Uid; inward?: true }
  | { t: 'endTurn' }
  | { t: 'choose'; uid: Uid }
  | { t: 'confirm' }
  | { t: 'takeCard'; i: number }
  | { t: 'takeKeepsake'; i: number }
  | { t: 'skip' }
  | { t: 'continue' }
  | { t: 'buy'; slot: number }
  | { t: 'service'; id: 'remove' | 'talk' }
  | { t: 'leave' }
  | { t: 'rest' }
  | { t: 'kindle' }
  | { t: 'reflect' }
  | { t: 'option'; i: number };

export type EntityRef = { side: 'player' } | { side: 'enemy'; uid: Uid } | { side: 'companion'; uid: Uid };

export interface HitBreakdown {
  base: number;
  flat: number;
  afflictionPct: number;
  relation: Relation;
  typePct: number;
  damage: number;
  blocked: number;
  hpLoss: number;
  hpBefore: number;
  hpAfter: number;
  guardAfter: number;
  lethal: boolean;
  outcome: LethalOutcome | null;
  fromCard: boolean;
  /** Lights the hit carried. */
  lights: Light[];
  /** For the math breakdown: [{label:'Kind Word', value:'6'}, {label:'Nerve', value:'+1'}, ...]. */
  trace: { label: string; value: string }[];
}

export type GameEvent =
  | { e: 'turn'; side: 'player' | 'enemy'; n: number }
  | { e: 'draw'; uids: Uid[] }
  | { e: 'discard'; uids: Uid[] }
  | { e: 'burn'; uids: Uid[] }
  | { e: 'shuffle'; count: number }
  | { e: 'letGo'; uid: Uid }
  | { e: 'energy'; after: number; delta: number }
  | {
      e: 'cardPlayed';
      uid: Uid;
      defId: CardId;
      inward: boolean;
      target: Uid | null;
      effectiveLights: Light[];
      harmonized: boolean;
      energyAfter: number;
    }
  | { e: 'note'; lights: Light[] }
  | { e: 'harmony'; blend: Blend | null; count: number }
  | { e: 'hit'; from: EntityRef; to: EntityRef; b: HitBreakdown }
  | { e: 'strike'; enemy: Uid; amount: number; blocked: number; hpAfter: number; guardAfter: number }
  | { e: 'guard'; to: EntityRef; amount: number; after: number }
  | { e: 'mend'; to: EntityRef; amount: number; after: number }
  | { e: 'hpLoss'; to: EntityRef; amount: number; after: number; cause: 'seething' | 'other' }
  | { e: 'status'; to: EntityRef; id: StatusId; delta: number; after: number }
  | { e: 'afflictBlocked'; id: StatusId }
  | { e: 'cleanse'; id: AfflictionId; removed: number; byLight: Light; inward: boolean }
  | { e: 'face'; enemy: Uid; face: Shade }
  | { e: 'intent'; enemy: Uid; moveId: string }
  | { e: 'enemyMove'; enemy: Uid; moveId: string }
  | { e: 'grow'; enemy: Uid; amount: number; hpAfter: number; maxHpAfter: number }
  | { e: 'summon'; companion: Uid; defId: CompanionId }
  | { e: 'companionLeft'; companion: Uid }
  | { e: 'companionAct'; companion: Uid }
  | { e: 'spawn'; enemy: Uid; defId: EnemyId }
  | { e: 'surfaced'; enemy: Uid; fromBuried: Uid }
  | { e: 'resolved'; enemy: Uid; deep: boolean; by: Light[]; glimmers: number; afterglows: Shade[] }
  | { e: 'suppressed'; enemy: Uid; buried: Shade | null }
  | { e: 'faded'; enemy: Uid }
  | { e: 'wavering'; enemy: Uid }
  | { e: 'tended'; uid: Uid; weightAfter: number }
  | { e: 'insight'; uid: Uid; to: CardId; upgraded: boolean }
  | { e: 'peace'; uid: Uid }
  /** A Mood played outward is now active (card moved to the moods pile). */
  | { e: 'moodActive'; uid: Uid }
  /** A card moved into the hand by an effect (Look Inward), not a draw. */
  | { e: 'toHand'; uid: Uid; from: 'draw' | 'discard' | 'removed' }
  | { e: 'promise'; created: boolean; targetUid: Uid | null }
  | { e: 'pending'; purpose: PendingChoice['purpose']; options: Uid[] }
  | { e: 'festering' }
  | { e: 'keepsake'; id: KeepsakeId }
  | { e: 'combatEnd'; outcome: 'won' | 'lost' }
  | { e: 'phase'; kind: Phase['kind'] }
  | { e: 'run'; what: 'glimmers' | 'heart' | 'maxHeart' | 'deck' | 'keepsake' | 'act'; after: number | string };

export interface StepResult {
  state: GameState;
  events: GameEvent[];
  /** True if the step drew, shuffled or rolled anything (Undo is not allowed past it). */
  revealedHiddenInfo: boolean;
}

export interface IntentView {
  enemy: Uid;
  moveId: string;
  name: string;
  kinds: IntentKind[];
  /** Per-strike damage after Flare and Hush, and strike count. */
  strikes: { perStrike: number; count: number } | null;
  guard: number | null;
  afflict: { id: string; stacks: number } | null;
  /** Gauge/override that forced this move (e.g. 'pressure'), else null. */
  overriddenBy: string | null;
  /** M2: this is the intent projected after your end-of-turn steps (differs from the current one). */
  projected: boolean;
  /** Why it changed, e.g. 'Lantern Moth will turn it to Fear.' */
  projectedReason: string | null;
  /** Human sentence for the tooltip ("Strikes for 8 (7 + 1 Flare)."). */
  text: string;
}

export interface PreviewTarget {
  uid: Uid;
  hpBefore: number;
  hpAfter: number;
  maxHpAfter: number;
  guardBefore: number;
  guardAfter: number;
  hits: HitBreakdown[];
  outcome: LethalOutcome | null;
  flareDelta: number;
  faceAfter: Shade | null;
  /** Gauge statuses that change: id -> [before, after]. */
  gauges: Record<string, [number, number]>;
  intentAfter: IntentView | null;
  /** Buried consequence of a Suppress. weightAfter null = overflow (max Heart loss). */
  buried: { shade: Shade; weightAfter: 1 | 2 | 3 | null; overflow: boolean } | null;
  afterglows: Shade[];
  glimmers: number;
}

export interface Preview {
  action: Action;
  targets: PreviewTarget[];
  player: {
    hpBefore: number;
    hpAfter: number;
    guardBefore: number;
    guardAfter: number;
    energyAfter: number;
    /** Affliction stacks removed. */
    cleansed: StatusBag;
    /** Status changes on the player: id -> [before, after]. */
    statuses: Record<string, [number, number]>;
    tended: { uid: Uid; weightAfter: number; insight: CardId | null; removed: boolean } | null;
    /** endTurn previews: Heart lost by the end of the enemy phase (Seething + strikes after Guard). */
    incomingLoss: number;
    lethalToPlayer: boolean;
  };
  harmonized: boolean;
  effectiveLights: Light[];
  noteAfter: Light[];
  cost: number;
  /** A draw/shuffle or a later condition depended on hidden info; numbers past that point are not shown. */
  uncertain: boolean;
  /** Stopped at a pending choice. */
  partial: boolean;
  /** One-sentence Play Line (DESIGN 16.2), built from engine data. */
  line: string;
  /** Cards in hand that could Resolve a target this preview would Suppress. */
  resolveWith: Uid[];
}

export interface HandHint {
  uid: Uid;
  playable: boolean;
  cost: number;
  inwardLegal: boolean;
  /** Would be Harmonized if played now. */
  harmonizesNow: boolean;
  blend: Blend | null;
  /** Relation against each targetable Shade's showing face. */
  relations: { enemy: Uid; relation: Relation }[];
  /** Buried card in hand this card would Tend if played Inward. */
  tends: Uid | null;
  soothes: AfflictionId[];
  /** Up to 2 context chips, e.g. 'Tends Buried Fear', 'HARMONY -> Delight', 'Soothes Heavy'. */
  chips: string[];
  /** Greyed by Numb (first card this turn). */
  numbed: boolean;
}

export interface NodeDetail {
  kind: MapNode['kind'];
  /** Faces of each Shade in the encounter (compounds have 2). */
  shades: Shade[][];
  names: string[];
  afflictions: AfflictionId[];
  deckAnswers: { shade: Shade; opposite: number; dissonant: number }[];
  rewards: string[];
  text: string;
}

/** Light Mix bar and deck counts (DESIGN 12.2, 16.4). */
export interface DeckSummary {
  total: number;
  /** Mono-Light cards per Light (Insight cards excluded). */
  byLight: Record<Light, number>;
  /** Blend cards per Blend. */
  byBlend: Record<Blend, number>;
  neutral: number;
  buried: number;
  insight: number;
  /** 12.2 "most common Light": `ease` cards only, by printed Light (a Blend counts for both), ties by wheel order. */
  easeByLight: Record<Light, number>;
  /** All six Lights sorted by easeByLight (desc), ties by wheel order. */
  mostCommon: Light[];
  /** Total Weight of Buried cards. */
  buriedWeight: number;
  /**
   * Top-bar Numbness meter (4.16), null without Buried cards. willSurface = the cards that will rise (3 heaviest,
   * ties by wheel order); hiddenIntensity = max Intensity the rest add (hiddenWeight x the boss's hpPerHiddenWeight).
   */
  numbness: { willSurface: Uid[]; hiddenWeight: number; hiddenIntensity: number } | null;
}

export interface EventOptionView {
  label: string;
  result: string;
  enabled: boolean;
  /** Why the option is disabled ("Not enough Heart", or the option's requiresText). */
  reason: string | null;
}

export interface HavenOptionView {
  id: 'rest' | 'kindle' | 'reflect';
  available: boolean;
  reason: string | null;
  /** Rest only: Heart after resting. */
  heartAfter: number | null;
}

export interface EngineCtx {
  pack: ContentPack;
  rules: RulesConfig;
}

export interface NewRunOpts {
  tutorial?: boolean;
  /** Skip charm select and take this Charm. */
  charm?: KeepsakeId;
}

/** Rules are fixed per engine instance: createEngine(pack, rulesOverride?) in src/engine/index.ts. */
export type CreateEngine = (pack: ContentPack, rules?: Partial<RulesConfig>) => Engine;

export interface Engine {
  readonly pack: ContentPack;
  readonly rules: RulesConfig;
  newRun(seed: number, opts?: NewRunOpts): GameState;
  /** Canonical order; empty only in victory/defeat. */
  legalActions(s: GameState): Action[];
  /** Pure at the boundary; throws IllegalActionError for illegal actions. */
  step(s: GameState, a: Action): StepResult;
  /** 'play' and 'endTurn' in combat; null otherwise. */
  preview(s: GameState, a: Action): Preview | null;
  intents(s: GameState): IntentView[];
  handHints(s: GameState): HandHint[];
  /** Rules text of a combat card with slots filled in context (target optional). */
  cardText(s: GameState, uid: Uid, target?: Uid): string;
  /** Rules text of a card definition outside combat (deck view, rewards, shop). */
  describeCard(defId: CardId, upgraded: boolean, weight?: number): string;
  nodeDetail(s: GameState, nodeId: number): NodeDetail;
  /** Deck counts, most common Light and the Numbness meter. */
  deckSummary(s: GameState): DeckSummary;
  /** Options of the current event with enabled state and reasons ([] outside an event). */
  eventOptions(s: GameState): EventOptionView[];
  /** Haven options with availability ([] outside a Haven). */
  havenOptions(s: GameState): HavenOptionView[];
  /** Invariant violations of a state (DESIGN 22); [] when healthy. */
  checkInvariants(s: GameState): string[];
  hash(s: GameState): string;
  serialize(s: GameState): string;
  deserialize(json: string): GameState | null;
  debug: {
    startCombat(s: GameState, e: EncounterId): GameState;
    setHand(s: GameState, ids: CardId[]): GameState;
  };
}

export class IllegalActionError extends Error {
  constructor(
    message: string,
    public readonly action: Action,
  ) {
    super(message);
    this.name = 'IllegalActionError';
  }
}
