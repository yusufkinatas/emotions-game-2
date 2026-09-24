// The combat view model: everything the combat screen draws, derived from one GameState plus the UI
// selection. Components render from this, and the animation layer mutates a copy of it event by event.
// All numbers, sentences and legality come from the engine views.

import type {
  CardDef,
  EnemyDef,
  EnemyState,
  GameState,
  HandHint,
  IntentView,
  Light,
  Preview,
  PreviewTarget,
  Relation,
  Shade,
  Uid,
} from '../../../engine/types';
import { adjacent, BLENDS, cureOf, LIGHTS, lightIndex, lightsOfBlend } from '../../../engine/index';
import { AFFLICTION_INFO, BANNERS, BAD_ADVICE } from '../../../content/index';
import type { App } from '../../app';
import type { CardFaceProps } from '../../kit/cardFace';
import type { CompassProps } from '../../kit/compass';
import type { CompanionSlot } from '../../kit/player';
import { ornamentFor, type ShadeOrnament } from '../../kit/shadeOrnaments';
import type { ShadeFamily } from '../../kit/shadeArt';
import {
  defaultMatchups,
  type LethalBannerProps,
  type MatchupChipProps,
  type StatusChipProps,
} from '../../kit/widgets';
import { LIGHT_NAME, SHADE_NAME } from '../../kit/names';
import { focusedOption, optionFor, type Selection, type TargetKey } from './selection';
import {
  cardName,
  cardSummons,
  intentStrikeTotal,
  kindLabel,
  lightNames,
  numbersIn,
  playerChips,
  promiseText,
  relationLabel,
  shadeChips,
} from './text';

// ------------------------------------------------------------------------------------------------
// Types
// ------------------------------------------------------------------------------------------------

export interface CalloutModel {
  amount: number;
  hits: number;
  relation: Relation;
  label: string;
  light: Light | null;
  blocked: number;
  flare: number;
  turnTo: Shade | null;
  gauges: string[];
}

export interface ShadePreview {
  key: TargetKey;
  loss: number;
  guardAfter: number;
  banner: LethalBannerProps | null;
  callout: CalloutModel | null;
  intentAfter: IntentView | null;
  trace: { label: string; value: string }[][];
}

export interface ShadeModel {
  uid: Uid;
  defId: string;
  def: EnemyDef;
  name: string;
  family: ShadeFamily;
  scale: number;
  ornament: ShadeOrnament | null;
  face: Shade | null;
  innerFace: Shade | null;
  beneath: Shade | null;
  nextFace: Shade | null;
  hp: number;
  maxHp: number;
  guard: number;
  flare: number;
  gauge: number | undefined;
  intent: IntentView | null;
  order: number | null;
  chips: StatusChipProps[];
  matchups: MatchupChipProps[];
  wavering: boolean;
  promises: { text: string; lights: Light[] }[];
  surfaced: boolean;
  targetable: boolean;
  focused: boolean;
  preview: ShadePreview | null;
  reaction: 'flinch' | 'swell' | null;
  tall: boolean;
  feltCracks: [Light, Light][];
}

export interface CardModel {
  uid: Uid;
  def: CardDef;
  props: CardFaceProps;
  hint: HandHint | null;
  /** Suppress preview: this card could Resolve the target instead. */
  resolveWith: boolean;
}

export interface PlayerModel {
  hp: number;
  maxHp: number;
  guard: number;
  guardAfter: number | null;
  previewLoss: number;
  previewGain: number;
  lethal: boolean;
  incoming: string;
  chips: StatusChipProps[];
  companions: { slots: (CompanionSlot | null)[]; isolated: boolean } | null;
  promises: string[];
  note: Light[];
  compass: boolean;
  lowHeart: boolean;
}

export interface CombatModel {
  turn: number;
  turnLimit: number;
  energy: number;
  maxEnergy: number;
  player: PlayerModel;
  shades: ShadeModel[];
  hand: CardModel[];
  compass: CompassProps;
  drawCount: number;
  discardCount: number;
  spiritUnused: number;
  nothingPlayable: boolean;
  canUndo: boolean;
  undoReason: string;
  pending: { purpose: 'toHand' | 'tend'; options: { uid: Uid; props: CardFaceProps }[] } | null;
  selected: Uid | null;
  focus: TargetKey | null;
  inward: { text: string; focused: boolean } | null;
  thread: { from: Uid; to: Uid; light: Light } | null;
  playLine: string;
  resolved: number;
}

export interface ModelExtras {
  sel: Selection | null;
  /** Hovered hand card (hover reactions) and End Turn hover (companion and Promise previews). */
  hoverCard: Uid | null;
  endTurnHover: boolean;
  feltCracks: Map<Uid, [Light, Light][]>;
  /** The fight was reloaded (Continue) mid-turn and nothing has been played since: the undo history is gone. */
  resumed?: boolean;
}

/** Why Undo is unavailable when the stack came back empty from a reload. */
export const UNDO_AFTER_RELOAD = "Can't undo across a reload.";

// ------------------------------------------------------------------------------------------------
// Builders
// ------------------------------------------------------------------------------------------------

const COMPANION_ICON: Record<string, CompanionSlot['icon']> = {
  'comp.lantern_moth': 'moth',
  'comp.burrow_hare': 'hare',
  'comp.old_dog': 'dog',
};

/** Hand sort key (16.2): mono Light i -> 2i, Blend (i, i+1) -> 2i+1, Insight -> its Light, neutral 12, Buried 13. */
export function handSortKey(def: CardDef): number {
  if (def.buried || def.kind === 'buried') return 13;
  if (def.insightOf) return 2 * lightIndex(cureOf(def.insightOf));
  if (def.lights.length === 2) {
    const [a, b] = def.lights as [Light, Light];
    const lo = (lightIndex(a) + 1) % 6 === lightIndex(b) ? lightIndex(a) : lightIndex(b);
    return 2 * lo + 1;
  }
  if (def.lights.length === 1) return 2 * lightIndex(def.lights[0]!);
  return 12;
}

export function hasCompass(app: App, s: GameState): boolean {
  return s.run.keepsakes.some((k) => app.engine.pack.keepsakes[k.id]?.flags?.includes('harmony'));
}

export function maxEnergyOf(app: App, s: GameState): number {
  let n = app.engine.rules.energyPerTurn;
  for (const k of s.run.keepsakes) n += app.engine.pack.keepsakes[k.id]?.energyPerTurn ?? 0;
  return n;
}

function showingFace(e: EnemyState): Shade | null {
  return e.faces.length ? (e.faces[e.faceIndex] ?? null) : null;
}

/** Banner sub-lines for a lethal preview (16.2), from the preview target and the engine's Play Line. */
function bannerFor(app: App, t: PreviewTarget, line: string, e: EnemyState, resolveWith: string | null): LethalBannerProps | null {
  const pack = app.engine.pack;
  const o = t.outcome;
  if (!o) return null;
  const surfaced = e.surfacedFrom !== null;
  if (o === 'resolve' || o === 'deepResolve') {
    const sub: string[] = [];
    if (t.glimmers > 0) sub.push(`+${t.glimmers} Glimmers`);
    if (surfaced) {
      const m = /Insight: [^,.]+ joins your hand|Buried \w+ is released/.exec(line);
      if (m) sub.push(m[0]);
    }
    for (const sh of t.afterglows) {
      const ag = pack.afterglows[sh];
      if (ag) sub.push(`${ag.name}: ${ag.text.replace(/\.$/, '')}`);
    }
    const last = t.hits[t.hits.length - 1];
    const lights = o === 'deepResolve' ? (e.faces.map(cureOf) as Light[]) : (last?.lights.slice(0, 1) ?? []);
    const finishing = o === 'resolve' && last ? (last.lights.find((l) => e.faces.some((f) => cureOf(f) === l)) ?? last.lights[0]) : null;
    return { kind: o, lights: finishing ? [finishing] : lights, sub };
  }
  if (o === 'suppress') {
    const sub: string[] = [];
    const b = t.buried;
    if (b) {
      const name = SHADE_NAME[b.shade];
      if (b.overflow) sub.push(BANNERS.buriedFull.replace('{Shade}', name).replace(/\d+/, String(app.engine.rules.buriedOverflowMaxHeart)));
      else if (b.weightAfter === 1) sub.push(BANNERS.buriedJoins.replace('{Shade}', name));
      else if (b.weightAfter) sub.push(BANNERS.buriedWeight.replace('{Shade}', name).replace('{from}', String(b.weightAfter - 1)).replace('{to}', String(b.weightAfter)));
    } else if (surfaced) {
      const m = /([A-Z][\w ]+) \+(\d+) Intensity/.exec(line);
      if (m) sub.push(m[0]);
    }
    return { kind: 'suppress', sub, ...(resolveWith ? { resolveWith } : {}) };
  }
  if (o === 'fade') return { kind: 'fade' };
  return { kind: 'wavering' };
}

function previewFor(app: App, key: TargetKey, p: Preview, e: EnemyState, s: GameState): ShadePreview | null {
  const t = p.targets.find((x) => x.uid === e.uid);
  if (!t) return null;
  const loss = Math.max(0, t.hpBefore - t.hpAfter);
  const first = t.hits[0];
  const resolveWith =
    t.outcome === 'suppress' && p.resolveWith.length
      ? cardName(app.engine.pack.cards[s.combat!.cards[p.resolveWith[0]!]?.defId ?? ''], !!s.combat!.cards[p.resolveWith[0]!]?.upgraded)
      : null;
  const banner = t.outcome ? bannerFor(app, t, p.line, e, resolveWith) : null;
  const face = showingFace(e);
  const gauges: string[] = [];
  for (const [id, [a, b]] of Object.entries(t.gauges)) {
    if (a === b) continue;
    let g = `${app.engine.pack.statuses[id]?.name ?? id} ${a} -> ${b}`;
    if (t.intentAfter && e.intent && t.intentAfter.moveId !== e.intent.moveId) g += `: next move ${t.intentAfter.name.toUpperCase()}`;
    gauges.push(g);
  }
  const amount = t.hits.reduce((n, h) => n + h.damage, 0);
  const callout: CalloutModel | null =
    first || t.flareDelta || gauges.length || (t.faceAfter && t.faceAfter !== face)
      ? {
          amount,
          hits: t.hits.length,
          relation: first?.relation ?? 'neutral',
          label: first ? relationLabel(first) : '',
          light: first?.lights[0] ?? null,
          blocked: t.hits.reduce((n, h) => n + h.blocked, 0),
          flare: t.flareDelta,
          turnTo: t.faceAfter && t.faceAfter !== face ? t.faceAfter : null,
          gauges,
        }
      : null;
  if (!callout && !banner && loss === 0) return null;
  const intentAfter =
    t.intentAfter && e.intent && (t.intentAfter.moveId !== e.intent.moveId || t.intentAfter.text !== '') ? t.intentAfter : null;
  return { key, loss, guardAfter: t.guardAfter, banner, callout, intentAfter, trace: t.hits.map((h) => h.trace) };
}

function incomingLine(intents: IntentView[], guard: number, seething: number, loss: number, uncertain: boolean): string {
  const strikes = intents.reduce((n, iv) => n + intentStrikeTotal(iv), 0);
  const parts: string[] = [];
  if (strikes > 0) parts.push(`strikes ${strikes}`);
  if (strikes > 0 && guard > 0) parts.push(`Guard ${guard}`);
  if (seething > 0) parts.push(`Seething ${seething}`);
  if (!parts.length && loss === 0) return 'Incoming: nothing this turn.';
  return `Incoming: ${parts.join(', ') || 'nothing'}. You lose ${loss}${uncertain ? ' or more' : ''}.`;
}

function companionSlots(app: App, s: GameState): PlayerModel['companions'] {
  const c = s.combat!;
  const pack = app.engine.pack;
  const owns = c.companions.length > 0 || s.run.deck.some((d) => cardSummons(pack.cards[d.defId]));
  if (!owns) return null;
  const slots = c.companions.slice(0, 3).map((cs): CompanionSlot => {
    const def = pack.companions[cs.defId];
    const act = def?.act[0];
    const amount = act && (act.op === 'hit' || act.op === 'guard') && typeof act.amount === 'number' ? act.amount : 0;
    return {
      icon: COMPANION_ICON[cs.defId] ?? 'moth',
      name: def?.name ?? 'Companion',
      value: amount,
      action: act?.op === 'guard' ? 'guard' : 'ease',
      title: `${def?.name ?? 'Companion'}: ${def?.text ?? ''}`,
    };
  });
  return { slots, isolated: (c.player.statuses.isolated ?? 0) > 0 };
}

export function buildCardProps(
  app: App,
  s: GameState,
  uid: Uid,
  hint: HandHint | null,
  opts: { selected?: boolean; target?: Uid | null; line?: string } = {},
): CardFaceProps {
  const c = s.combat!;
  const card = c.cards[uid]!;
  const def = app.engine.pack.cards[card.defId]!;
  const name = cardName(def, card.upgraded);
  const base = app.engine.cardText(s, uid);
  const text = opts.target !== undefined && opts.target !== null ? app.engine.cardText(s, uid, opts.target) : base;
  let trends: ('up' | 'down' | null)[] | undefined;
  if (text !== base) {
    const a = numbersIn(base);
    const b = numbersIn(text);
    trends = b.map((v, i) => (a[i] === undefined || a[i] === v ? null : v > a[i]! ? 'up' : 'down'));
  }
  const printed = def.upgrade?.cost !== undefined && card.upgraded ? def.upgrade.cost : def.cost;
  const buried = def.buried && card.weight ? { weight: card.weight, shade: def.buried.shade } : undefined;
  const cost = printed === 'unplayable' || buried ? null : (hint?.cost ?? printed);
  const unaffordable = cost !== null && cost > c.energy;
  const costState =
    cost === null ? 'normal' : unaffordable ? 'unaffordable' : typeof printed === 'number' && cost > printed ? 'raised' : typeof printed === 'number' && cost < printed ? 'lowered' : 'normal';
  const state = opts.selected
    ? 'selected'
    : hint?.numbed
      ? 'numbed'
      : unaffordable
        ? 'unaffordable'
        : hint?.playable
          ? 'playable'
          : 'idle';
  const kind = kindLabel(def);
  const chips = hint?.chips ?? [];
  const lightWord = def.lights.length ? lightNames(def.lights) : buried ? 'Buried' : 'no Light';
  const aria = buried
    ? `${name}, Weight ${buried.weight}, unplayable. ${text}`
    : `${name}, ${lightWord}, cost ${cost ?? 'none'}. ${text}${chips.length ? ` ${chips.join('. ')}.` : ''}${hint?.numbed ? ' Numb: no Light.' : ''}${unaffordable ? ' Not enough Spirit.' : ''}${opts.line ? ` ${opts.line}` : ''}`;
  return {
    name,
    lights: hint?.numbed ? [] : def.lights,
    cost,
    costState,
    kindLabel: kind,
    text,
    rarity: def.rarity,
    upgraded: card.upgraded,
    ...(buried ? { buried } : {}),
    ...(def.insightOf ? { insight: true } : {}),
    chips,
    state,
    ...(trends ? { numberTrends: trends } : {}),
    tag: 'button',
    ariaLabel: aria,
    seed: uid,
  };
}

/** The whole view model of a combat state. */
export function buildModel(app: App, s: GameState, x: ModelExtras): CombatModel {
  const eng = app.engine;
  const pack = eng.pack;
  const c = s.combat!;
  const sel = x.sel && x.sel.card && c.piles.hand.includes(x.sel.card) ? x.sel : null;
  const intents = eng.intents(s);
  const hints = eng.handHints(s);
  const hintOf = new Map(hints.map((hh) => [hh.uid, hh]));
  const endPreview = c.pending ? null : eng.preview(s, { t: 'endTurn' });
  const compass = hasCompass(app, s);
  const focusOpt = focusedOption(sel);

  // Hover reactions: OPPOSITE flinches, DISSONANT swells (16.7).
  const reactCard = sel?.card ?? x.hoverCard;
  const relations = new Map<Uid, Relation>();
  for (const r of (reactCard !== null ? hintOf.get(reactCard)?.relations : undefined) ?? []) relations.set(r.enemy, r.relation);

  const resolveWith = new Set<Uid>();
  const acting = intents.filter((iv) => iv.kinds.length > 0).length;
  const surfacedCount = c.enemies.filter((e) => e.surfacedFrom !== null).length;
  const shades: ShadeModel[] = c.enemies.map((e, i) => {
    const def = pack.enemies[e.defId]!;
    const face = showingFace(e);
    const two = e.faces.length === 2;
    const mask = e.faces.length > 2;
    const iv = intents.find((v) => v.enemy === e.uid) ?? null;
    // Previews: a targeted card shows each target's own preview; an untargeted card previews on every Shade.
    let preview: ShadePreview | null = null;
    if (sel) {
      const own = optionFor(sel, e.uid) ?? optionFor(sel, 'none');
      if (own?.preview) preview = previewFor(app, own.key, own.preview, e, s);
      for (const u of own?.preview?.targets.find((t) => t.uid === e.uid && t.outcome === 'suppress') ? own.preview.resolveWith : []) resolveWith.add(u);
    } else if (x.endTurnHover && endPreview) {
      preview = previewFor(app, 'none', endPreview, e, s);
    }
    const rel = relations.get(e.uid);
    const ornament = ornamentFor(e.defId);
    const lone = c.enemies.length === 1;
    return {
      uid: e.uid,
      defId: e.defId,
      def,
      name: def.name,
      family: def.visual.family,
      scale: def.visual.scale,
      ornament,
      face,
      innerFace: two ? e.faces[1]! : null,
      beneath: two ? e.faces[(e.faceIndex + 1) % 2]! : null,
      nextFace: mask ? e.faces[(e.faceIndex + 1) % e.faces.length]! : null,
      hp: e.hp,
      maxHp: e.maxHp,
      guard: e.guard,
      flare: e.statuses.flare ?? 0,
      gauge: ornament === 'spiral' ? (e.statuses.coil ?? 0) : ornament === 'numbness' ? surfacedCount : undefined,
      intent: iv && iv.kinds.length ? iv : null,
      order: acting > 1 && iv && iv.kinds.length ? i + 1 : null,
      chips: shadeChips(pack, e, def),
      matchups: defaultMatchups(face, face ? BAD_ADVICE[face] : undefined),
      wavering: (e.statuses.wavering ?? 0) > 0,
      promises: c.promises
        .filter((p) => p.targetUid === e.uid)
        .map((p) => ({ text: `Promise: ${promiseText(pack, p.effects)}`, lights: p.lights })),
      surfaced: e.surfacedFrom !== null,
      targetable: !!sel && sel.options.some((o) => o.key === e.uid),
      focused: !!sel && sel.focus === e.uid,
      preview,
      reaction: rel === 'opposite' || rel === 'felt' ? 'flinch' : rel === 'dissonant' ? 'swell' : null,
      tall: lone && (def.tier === 'boss' || def.tier === 'final' || def.visual.scale > 1.1),
      feltCracks: x.feltCracks.get(e.uid) ?? [],
    };
  });

  // Hand, sorted in wheel order.
  const focusTarget = sel && typeof sel.focus === 'number' ? sel.focus : null;
  const hand: CardModel[] = c.piles.hand
    .map((uid) => {
      const def = pack.cards[c.cards[uid]!.defId]!;
      const hint = hintOf.get(uid) ?? null;
      const selected = sel?.card === uid;
      return {
        uid,
        def,
        hint,
        resolveWith: resolveWith.has(uid),
        props: buildCardProps(app, s, uid, hint, {
          selected,
          target: selected ? focusTarget : null,
          ...(selected && focusOpt?.preview ? { line: focusOpt.preview.line } : {}),
        }),
      };
    })
    .sort((a, b) => handSortKey(a.def) - handSortKey(b.def) || a.def.name.localeCompare(b.def.name) || a.uid - b.uid);

  // Player.
  const ps = c.player.statuses;
  const pOpt = focusOpt?.preview;
  const gain = pOpt ? Math.max(0, pOpt.player.hpAfter - pOpt.player.hpBefore) : 0;
  const loss = endPreview?.player.incomingLoss ?? 0;
  const player: PlayerModel = {
    hp: c.player.hp,
    maxHp: c.player.maxHp,
    guard: c.player.guard,
    guardAfter: pOpt && pOpt.player.guardAfter !== pOpt.player.guardBefore ? pOpt.player.guardAfter : null,
    previewLoss: loss,
    previewGain: gain,
    lethal: !!endPreview?.player.lethalToPlayer,
    incoming: c.pending ? 'Incoming: choose a card first.' : incomingLine(intents, c.player.guard, ps.seething ?? 0, loss, !!endPreview?.uncertain),
    chips: playerChips(pack, ps),
    companions: companionSlots(app, s),
    promises: c.promises.filter((p) => p.targetUid === null).map((p) => promiseText(pack, p.effects)),
    note: c.note,
    compass,
    lowHeart: c.player.hp < c.player.maxHp * 0.3,
  };

  // Compass.
  const summary = eng.deckSummary(s);
  const owned = LIGHTS.filter(
    (l) => summary.byLight[l] > 0 || Object.entries(summary.byBlend).some(([b, n]) => n > 0 && blendHas(b, l)),
  );
  const faces = c.enemies.map(showingFace).filter((f): f is Shade => !!f);
  const glowEdges = c.enemies
    .filter((e) => e.faces.length === 2)
    .map((e) => [cureOf(e.faces[0]!), cureOf(e.faces[1]!)] as [Light, Light])
    .filter(([a, b]) => adjacent(a, b));
  const maxEnergy = maxEnergyOf(app, s);
  const compassProps: CompassProps = {
    enabled: compass,
    note: c.note,
    harmoniesThisTurn: c.turnFlags.harmonies,
    energy: c.energy,
    maxEnergy,
    hollow: (ps.hollow ?? 0) > 0,
    isolated: (ps.isolated ?? 0) > 0,
    isolatedStacks: ps.isolated ?? 0,
    act2Unlocked: s.run.act >= 2,
    ownedLights: owned,
    activeShades: faces,
    glowEdges,
  };

  const playable = hints.filter((hh) => hh.playable);
  const inwardOpt = optionFor(sel, 'inward');
  const selHint = sel ? hintOf.get(sel.card) : undefined;
  // The thread takes the colour of the Light that Tends: the cure of the Buried card's Shade.
  const tendsDef = selHint?.tends ? pack.cards[c.cards[selHint.tends]?.defId ?? ''] : undefined;
  const threadLight = tendsDef?.buried ? cureOf(tendsDef.buried.shade) : null;

  const pending = c.pending
    ? {
        purpose: c.pending.purpose,
        options: c.pending.options.map((uid) => ({ uid, props: { ...buildCardProps(app, s, uid, null), state: 'playable' as const } })),
      }
    : null;

  return {
    turn: c.turn,
    turnLimit: eng.rules.turnLimit,
    energy: c.energy,
    maxEnergy,
    player,
    shades,
    hand,
    compass: compassProps,
    drawCount: c.piles.draw.length,
    discardCount: c.piles.discard.length,
    spiritUnused: c.energy > 0 && playable.length > 0 ? c.energy : 0,
    nothingPlayable: playable.length === 0 && !c.pending,
    canUndo: app.canUndo(),
    undoReason: app.canUndo()
      ? 'Undo the last card you played.'
      : c.turnFlags.played > 0
        ? x.resumed
          ? UNDO_AFTER_RELOAD
          : BANNERS.newCardsRevealed
        : 'Nothing to undo this turn.',
    pending,
    selected: sel?.card ?? null,
    focus: sel?.focus ?? null,
    inward: inwardOpt ? { text: inwardText(inwardOpt.preview), focused: sel!.focus === 'inward' } : null,
    thread: sel && selHint?.tends && threadLight ? { from: sel.card, to: selHint.tends, light: threadLight } : null,
    playLine: focusOpt?.preview?.line ?? (x.endTurnHover && endPreview ? endPreview.line : ''),
    resolved: c.stats.resolved + c.stats.deepResolved,
  };
}

function blendHas(blend: string, l: Light): boolean {
  return (BLENDS as readonly string[]).includes(blend) && lightsOfBlend(blend as (typeof BLENDS)[number]).includes(l);
}

/** "Kind Word -> Inward: clear 2 Seething. Tend ..." becomes "Clear 2 Seething. Tend ...". */
export function inwardText(p: Preview | null): string {
  if (!p) return '';
  const body = p.line.replace(/^.*?->\s*Inward:\s*/, '');
  return body.charAt(0).toUpperCase() + body.slice(1);
}

/** Coach mark C9 copy for an affliction. */
export function afflictionCoach(copy: string, id: string): string | null {
  const info = AFFLICTION_INFO[id as keyof typeof AFFLICTION_INFO];
  if (!info || !info.soothedBy) return null;
  const light = LIGHT_NAME[info.soothedBy];
  return copy.replace('{Affliction}', info.name).replace('{short effect}', info.short).replaceAll('{Light}', light);
}
