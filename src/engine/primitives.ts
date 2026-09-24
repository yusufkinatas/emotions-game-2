// The ONLY mutators of combat hp, guard, energy, maxHp, statuses, faces, intents and piles (DESIGN 20.1.7).
// Each mutation emits exactly one GameEvent carrying absolute after-values. Informational events that
// accompany no mutation (resolved banners, harmony, keepsake flashes) go through emit().

import { SEALED_STOP, statusMax, statusMin, type Rt } from './combat/runtime';
import { Rng } from './rng';
import type {
  AfflictionId,
  CombatCard,
  CompanionId,
  EnemyState,
  EntityRef,
  GameEvent,
  HitBreakdown,
  Light,
  PromiseState,
  StatusBag,
  StatusId,
  Uid,
} from './types';

export type StatusOwner = 'player' | EnemyState;
export type PileName = 'draw' | 'hand' | 'discard' | 'letGo' | 'moods' | 'removed' | 'play';

export function emit(rt: Rt, ev: GameEvent): void {
  rt.events.push(ev);
}

// ---------------------------------------------------------------------------------------------------
// Energy (Spirit)
// ---------------------------------------------------------------------------------------------------

export function setEnergy(rt: Rt, n: number): void {
  const before = rt.c.energy;
  const after = Math.max(0, Math.floor(n));
  if (after === before) return;
  rt.c.energy = after;
  emit(rt, { e: 'energy', after, delta: after - before });
}

export function addEnergy(rt: Rt, delta: number): void {
  setEnergy(rt, rt.c.energy + delta);
}

// ---------------------------------------------------------------------------------------------------
// Player Heart and Guard
// ---------------------------------------------------------------------------------------------------

const PLAYER: EntityRef = { side: 'player' };

export function addPlayerGuard(rt: Rt, amount: number): number {
  const n = Math.max(0, Math.floor(amount));
  if (n === 0) return 0;
  const p = rt.c.player;
  p.guard += n;
  emit(rt, { e: 'guard', to: PLAYER, amount: n, after: p.guard });
  return n;
}

export function clearPlayerGuard(rt: Rt): void {
  const p = rt.c.player;
  if (p.guard === 0) return;
  const lost = p.guard;
  p.guard = 0;
  emit(rt, { e: 'guard', to: PLAYER, amount: -lost, after: 0 });
}

/** Mend never exceeds missing Heart. Returns the Heart restored. */
export function mendPlayer(rt: Rt, amount: number): number {
  const p = rt.c.player;
  const n = Math.max(0, Math.min(Math.floor(amount), p.maxHp - p.hp));
  if (n === 0) return 0;
  p.hp += n;
  emit(rt, { e: 'mend', to: PLAYER, amount: n, after: p.hp });
  return n;
}

/** Heart lost that ignores Guard (Seething). */
export function losePlayerHp(rt: Rt, amount: number, cause: 'seething' | 'other'): number {
  const p = rt.c.player;
  const n = Math.min(p.hp, Math.max(0, Math.floor(amount)));
  if (n === 0) return 0;
  p.hp -= n;
  rt.c.stats.heartLost += n;
  emit(rt, { e: 'hpLoss', to: PLAYER, amount: n, after: p.hp, cause });
  return n;
}

/** One Shade strike: Guard absorbs, the rest is lost Heart (never below 0). */
export function strikePlayer(rt: Rt, enemyUid: Uid, perStrike: number): { blocked: number; hpLoss: number } {
  const p = rt.c.player;
  const amount = Math.max(0, Math.floor(perStrike));
  const blocked = Math.min(p.guard, amount);
  const hpLoss = Math.min(p.hp, amount - blocked);
  p.guard -= blocked;
  p.hp -= hpLoss;
  rt.c.stats.heartLost += hpLoss;
  emit(rt, { e: 'strike', enemy: enemyUid, amount, blocked, hpAfter: p.hp, guardAfter: p.guard });
  return { blocked, hpLoss };
}

/** Paper Crane: set Heart to a value (never above max). Emitted as a Mend. */
export function restorePlayerHpTo(rt: Rt, hp: number): void {
  const p = rt.c.player;
  const target = Math.min(p.maxHp, hp);
  const amount = target - p.hp;
  p.hp = target;
  emit(rt, { e: 'mend', to: PLAYER, amount, after: p.hp });
}

// ---------------------------------------------------------------------------------------------------
// Shades
// ---------------------------------------------------------------------------------------------------

/** Writes exactly the breakdown computed by damage.computeHit (5.4 step 6/7). */
export function applyHit(rt: Rt, from: EntityRef, e: EnemyState, b: HitBreakdown): void {
  e.guard = b.guardAfter;
  e.hp = b.hpAfter;
  emit(rt, { e: 'hit', from, to: { side: 'enemy', uid: e.uid }, b });
}

export function addEnemyGuard(rt: Rt, e: EnemyState, amount: number): void {
  const n = Math.max(0, Math.floor(amount));
  if (n === 0) return;
  e.guard += n;
  emit(rt, { e: 'guard', to: { side: 'enemy', uid: e.uid }, amount: n, after: e.guard });
}

export function clearEnemyGuard(rt: Rt, e: EnemyState): void {
  if (e.guard === 0) return;
  const lost = e.guard;
  e.guard = 0;
  emit(rt, { e: 'guard', to: { side: 'enemy', uid: e.uid }, amount: -lost, after: 0 });
}

export function mendEnemy(rt: Rt, e: EnemyState, amount: number): number {
  const n = Math.max(0, Math.min(Math.floor(amount), e.maxHp - e.hp));
  if (n === 0) return 0;
  e.hp += n;
  emit(rt, { e: 'mend', to: { side: 'enemy', uid: e.uid }, amount: n, after: e.hp });
  return n;
}

/** B2 growth: +amount max Intensity and Intensity. */
export function growEnemy(rt: Rt, e: EnemyState, amount: number): void {
  const n = Math.max(0, Math.floor(amount));
  if (n === 0) return;
  e.maxHp += n;
  e.hp += n;
  emit(rt, { e: 'grow', enemy: e.uid, amount: n, hpAfter: e.hp, maxHpAfter: e.maxHp });
}

export function setFaceIndex(rt: Rt, e: EnemyState, index: number): void {
  if (e.faces.length === 0) return;
  const i = ((index % e.faces.length) + e.faces.length) % e.faces.length;
  if (i === e.faceIndex) return;
  e.faceIndex = i;
  emit(rt, { e: 'face', enemy: e.uid, face: e.faces[i]! });
}

export function setIntent(rt: Rt, e: EnemyState, moveId: string): void {
  if (e.intent && e.intent.moveId === moveId) return;
  e.intent = { moveId };
  emit(rt, { e: 'intent', enemy: e.uid, moveId });
}

/** Adds a Shade to the field at `index` (a spawn). */
export function insertEnemy(rt: Rt, e: EnemyState, index: number): void {
  const list = rt.c.enemies;
  const i = Math.max(0, Math.min(index, list.length));
  list.splice(i, 0, e);
  emit(rt, { e: 'spawn', enemy: e.uid, defId: e.defId });
}

/** Surfacing: a Buried card rises as a Shade; the card leaves its pile for this combat. */
export function surfaceShade(rt: Rt, e: EnemyState, index: number, cardUid: Uid): void {
  const list = rt.c.enemies;
  const i = Math.max(0, Math.min(index, list.length));
  list.splice(i, 0, e);
  detachCard(rt, cardUid);
  rt.c.piles.removed.push(cardUid);
  emit(rt, { e: 'surfaced', enemy: e.uid, fromBuried: cardUid });
}

/** Removes a Shade from the field. `ev` is its leaving event (resolved / suppressed / faded). */
export function removeEnemy(rt: Rt, uid: Uid, ev: GameEvent): void {
  const list = rt.c.enemies;
  const i = list.findIndex((x) => x.uid === uid);
  if (i < 0) return;
  list.splice(i, 1);
  emit(rt, ev);
}

// ---------------------------------------------------------------------------------------------------
// Statuses
// ---------------------------------------------------------------------------------------------------

function bagOf(rt: Rt, owner: StatusOwner): StatusBag {
  return owner === 'player' ? rt.c.player.statuses : owner.statuses;
}

function refOf(owner: StatusOwner): EntityRef {
  return owner === 'player' ? PLAYER : { side: 'enemy', uid: owner.uid };
}

function writeStatus(rt: Rt, owner: StatusOwner, id: StatusId, value: number): number {
  const bag = bagOf(rt, owner);
  const before = bag[id] ?? 0;
  const after = Math.max(statusMin(rt, id), Math.min(statusMax(rt, id), Math.floor(value)));
  if (after === before) return 0;
  if (after === 0) delete bag[id];
  else bag[id] = after;
  emit(rt, { e: 'status', to: refOf(owner), id, delta: after - before, after });
  return after - before;
}

/** Adds (or removes, if negative) stacks, clamped by the StatusDef. Returns the actual change. */
export function addStatus(rt: Rt, owner: StatusOwner, id: StatusId, delta: number): number {
  if (delta === 0) return 0;
  return writeStatus(rt, owner, id, (bagOf(rt, owner)[id] ?? 0) + delta);
}

export function setStatusValue(rt: Rt, owner: StatusOwner, id: StatusId, n: number): number {
  return writeStatus(rt, owner, id, n);
}

/** R-6a / R-7 soothing: removes up to n stacks of a player affliction. */
export function cleanse(rt: Rt, id: StatusId, n: number, byLight: Light, inward: boolean): number {
  const bag = rt.c.player.statuses;
  const before = bag[id] ?? 0;
  const removed = Math.min(before, Math.max(0, n));
  if (removed === 0) return 0;
  const after = before - removed;
  if (after === 0) delete bag[id];
  else bag[id] = after;
  emit(rt, { e: 'cleanse', id: id as AfflictionId, removed, byLight, inward });
  return removed;
}

// ---------------------------------------------------------------------------------------------------
// Piles
// ---------------------------------------------------------------------------------------------------

function pile(rt: Rt, name: PileName): Uid[] {
  const p = rt.c.piles;
  if (name === 'play') {
    if (!p.play) p.play = [];
    return p.play;
  }
  return p[name];
}

/** Removes a card uid from whichever pile holds it. Returns that pile's name. */
function detachCard(rt: Rt, uid: Uid): PileName | null {
  const names: PileName[] = ['hand', 'draw', 'discard', 'play', 'moods', 'letGo', 'removed'];
  for (const n of names) {
    const list = pile(rt, n);
    const i = list.indexOf(uid);
    if (i >= 0) {
      list.splice(i, 1);
      return n;
    }
  }
  return null;
}

/** Shuffles the discard pile into the draw pile with the combat's shuffle stream. */
export function reshuffle(rt: Rt): void {
  const p = rt.c.piles;
  if (p.discard.length === 0) return;
  if (rt.sealed) throw SEALED_STOP;
  rt.revealed = true;
  const rng = new Rng(rt.c.rng.shuffle);
  const order = rng.shuffle([...p.draw, ...p.discard]);
  rt.c.rng.shuffle = rng.state;
  p.draw = order;
  p.discard = [];
  emit(rt, { e: 'shuffle', count: order.length });
}

/** Draws n cards (DESIGN 4.15 hand limit: cards drawn with a full hand go to the discard pile). */
export function drawCards(rt: Rt, n: number): Uid[] {
  const p = rt.c.piles;
  const drawn: Uid[] = [];
  let seg: Uid[] = [];
  let burned: Uid[] = [];
  const flush = () => {
    if (seg.length) emit(rt, { e: 'draw', uids: seg });
    if (burned.length) emit(rt, { e: 'burn', uids: burned });
    seg = [];
    burned = [];
  };
  for (let i = 0; i < n; i++) {
    if (p.draw.length === 0) {
      if (p.discard.length === 0) break;
      flush();
      reshuffle(rt);
    }
    if (rt.sealed) throw SEALED_STOP;
    rt.revealed = true;
    const uid = p.draw.shift()!;
    if (p.hand.length >= rt.rules.maxHand) {
      p.discard.push(uid);
      burned.push(uid);
    } else {
      p.hand.push(uid);
      seg.push(uid);
      drawn.push(uid);
    }
  }
  flush();
  return drawn;
}

/** 5.3 step 4: the card leaves the hand and is in play until cleanup. */
export function beginPlay(rt: Rt, uid: Uid, ev: GameEvent): void {
  const hand = rt.c.piles.hand;
  const i = hand.indexOf(uid);
  if (i >= 0) hand.splice(i, 1);
  pile(rt, 'play').push(uid);
  emit(rt, ev);
}

/** 5.3 step 8: the played card goes to discard, Let Go, or (outward Mood) into play for the combat. */
export function endPlay(rt: Rt, uid: Uid, to: 'discard' | 'letGo' | 'moods'): void {
  const play = pile(rt, 'play');
  const i = play.indexOf(uid);
  if (i < 0) return;
  play.splice(i, 1);
  pile(rt, to).push(uid);
  if (to === 'discard') emit(rt, { e: 'discard', uids: [uid] });
  else if (to === 'letGo') emit(rt, { e: 'letGo', uid });
  else emit(rt, { e: 'moodActive', uid });
}

/** End of turn: the listed hand cards go to the discard pile. */
export function discardFromHand(rt: Rt, uids: Uid[]): void {
  if (uids.length === 0) return;
  const set = new Set(uids);
  const p = rt.c.piles;
  p.hand = p.hand.filter((u) => !set.has(u));
  for (const u of uids) p.discard.push(u);
  emit(rt, { e: 'discard', uids: uids.slice() });
}

/** Moves a card into the hand from another pile (Look Inward). A full hand sends it to discard instead. */
export function cardToHand(rt: Rt, uid: Uid): void {
  const from = detachCard(rt, uid);
  if (rt.c.piles.hand.length >= rt.rules.maxHand) {
    rt.c.piles.discard.push(uid);
    emit(rt, { e: 'burn', uids: [uid] });
    return;
  }
  rt.c.piles.hand.push(uid);
  const src = from === 'draw' || from === 'discard' || from === 'removed' ? from : 'discard';
  emit(rt, { e: 'toHand', uid, from: src });
}

/** Opening-hand and fixture helper: puts a card straight into a pile (no draw). */
export function placeCard(rt: Rt, uid: Uid, to: PileName): void {
  detachCard(rt, uid);
  pile(rt, to).push(uid);
}

/** A Surfaced Shade was Suppressed: its card returns to the discard pile unchanged. */
export function returnSurfacedCard(rt: Rt, uid: Uid): void {
  detachCard(rt, uid);
  rt.c.piles.discard.push(uid);
  emit(rt, { e: 'discard', uids: [uid] });
}

// ---------------------------------------------------------------------------------------------------
// Card instances (Buried Weight, Insight)
// ---------------------------------------------------------------------------------------------------

/** Tend: Weight -1, once per combat. Returns the Weight after. */
export function tendWeight(rt: Rt, card: CombatCard): number {
  const after = Math.max(0, (card.weight ?? 1) - 1);
  if (after > 0) card.weight = after as 1 | 2 | 3;
  else delete card.weight;
  card.mem.tended = true;
  emit(rt, { e: 'tended', uid: card.uid, weightAfter: after });
  return after;
}

/** Buried -> Insight. With toHand the card also moves into the hand (Surfaced Resolve). */
export function transformCard(rt: Rt, card: CombatCard, to: string, upgraded: boolean, toHand: boolean): void {
  card.defId = to;
  card.upgraded = upgraded;
  delete card.weight;
  delete card.peakWeight;
  if (toHand) {
    const hand = rt.c.piles.hand;
    detachCard(rt, card.uid);
    if (hand.length >= rt.rules.maxHand) rt.c.piles.discard.push(card.uid);
    else hand.push(card.uid);
  }
  emit(rt, { e: 'insight', uid: card.uid, to, upgraded });
}

/** B3: the Insight already exists this run, so the Buried card is released (removed for this combat). */
export function releaseCard(rt: Rt, card: CombatCard): void {
  detachCard(rt, card.uid);
  rt.c.piles.removed.push(card.uid);
  emit(rt, { e: 'peace', uid: card.uid });
}

// ---------------------------------------------------------------------------------------------------
// Companions, Promises, Note
// ---------------------------------------------------------------------------------------------------

export function addCompanion(rt: Rt, uid: Uid, defId: CompanionId): void {
  rt.c.companions.push({ uid, defId });
  emit(rt, { e: 'summon', companion: uid, defId });
}

export function removeCompanion(rt: Rt, uid: Uid): void {
  const i = rt.c.companions.findIndex((x) => x.uid === uid);
  if (i < 0) return;
  rt.c.companions.splice(i, 1);
  emit(rt, { e: 'companionLeft', companion: uid });
}

export function addPromise(rt: Rt, p: PromiseState): void {
  rt.c.promises.push(p);
  rt.c.promisesMade += 1;
  emit(rt, { e: 'promise', created: true, targetUid: p.targetUid });
}

/** Removes and returns the Promises due this turn (creation order). */
export function takeDuePromises(rt: Rt, turn: number): PromiseState[] {
  const due = rt.c.promises.filter((p) => p.dueTurn <= turn);
  if (due.length === 0) return due;
  rt.c.promises = rt.c.promises.filter((p) => p.dueTurn > turn);
  return due;
}

export function announcePromise(rt: Rt, p: PromiseState): void {
  emit(rt, { e: 'promise', created: false, targetUid: p.targetUid });
}

export function setNote(rt: Rt, lights: readonly Light[]): void {
  const cur = rt.c.note;
  if (cur.length === lights.length && cur.every((l, i) => l === lights[i])) return;
  rt.c.note = [...lights];
  emit(rt, { e: 'note', lights: [...lights] });
}

/** Combat end: Promises vanish, a card left in play goes to the discard pile, a pending choice is dropped. */
export function tidyAtCombatEnd(rt: Rt): void {
  const play = pile(rt, 'play');
  if (play.length) {
    const uids = play.splice(0, play.length);
    for (const u of uids) rt.c.piles.discard.push(u);
    emit(rt, { e: 'discard', uids });
  }
  rt.c.promises = [];
  rt.c.pending = null;
}
