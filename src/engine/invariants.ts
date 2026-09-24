// State invariants (DESIGN 22, B3). Used by tests and sim --strict. Returns violations instead of throwing.

import { isBuried, isInsight } from './run/cards';
import type { Action, EngineCtx, GameState, StatusBag } from './types';

function negativeStacks(bag: StatusBag, who: string, out: string[]): void {
  for (const [id, n] of Object.entries(bag)) {
    if (n !== undefined && (n < 0 || !Number.isFinite(n))) out.push(`${who} has ${n} ${id}`);
  }
}

function checkRun(s: GameState, ctx: EngineCtx, out: string[]): void {
  const run = s.run;
  if (run.maxHeart < 1) out.push(`maxHeart ${run.maxHeart} < 1`);
  if (run.heart < 0 || run.heart > run.maxHeart) out.push(`heart ${run.heart} outside 0..${run.maxHeart}`);
  if (run.glimmers < 0) out.push(`glimmers ${run.glimmers} < 0`);
  if (run.act !== run.map.act) out.push(`run.act ${run.act} != map.act ${run.map.act}`);

  const uids = new Set<number>();
  const insights = new Map<string, number>();
  for (const c of run.deck) {
    if (uids.has(c.uid)) out.push(`duplicate deck uid ${c.uid}`);
    uids.add(c.uid);
    if (c.uid >= s.nextUid) out.push(`deck uid ${c.uid} >= nextUid ${s.nextUid}`);
    const def = ctx.pack.cards[c.defId];
    if (!def) {
      out.push(`unknown card ${c.defId}`);
      continue;
    }
    if (isBuried(def)) {
      const w = c.weight ?? 0;
      if (w < 1 || w > ctx.rules.buriedMaxWeight) out.push(`${c.defId} has Weight ${w}`);
      if ((c.peakWeight ?? 0) < w) out.push(`${c.defId} peakWeight ${c.peakWeight} < Weight ${w}`);
    } else if (c.weight !== undefined) out.push(`${c.defId} is not Buried but has Weight`);
    if (isInsight(def)) {
      insights.set(c.defId, (insights.get(c.defId) ?? 0) + 1);
      if (!run.insightsMade.includes(c.defId)) out.push(`${c.defId} in deck but not in insightsMade`);
    }
  }
  for (const [id, n] of insights) if (n > 1) out.push(`${n} copies of ${id} (B3: at most one)`);
  if (new Set(run.insightsMade).size !== run.insightsMade.length) out.push('insightsMade has duplicates');
  const buriedIds = run.deck.map((c) => c.defId).filter((id) => ctx.pack.cards[id]?.kind === 'buried');
  if (new Set(buriedIds).size !== buriedIds.length) out.push('two Buried cards of the same type');

  const ks = run.keepsakes.map((k) => k.id);
  if (new Set(ks).size !== ks.length) out.push('duplicate Keepsakes');
  for (const id of ks) if (!ctx.pack.keepsakes[id]) out.push(`unknown Keepsake ${id}`);

  const nodes = run.map.nodes;
  nodes.forEach((n, i) => {
    if (n.id !== i) out.push(`map node at ${i} has id ${n.id}`);
    for (const c of n.next) {
      const child = nodes[c];
      if (!child) out.push(`node ${n.id} links to missing ${c}`);
      else if (child.row !== n.row + 1) out.push(`edge ${n.id}->${c} skips a row`);
    }
  });
  if (run.map.current !== null && !nodes[run.map.current]) out.push(`map.current ${run.map.current} missing`);
  for (const v of run.map.visited) if (!nodes[v]) out.push(`visited node ${v} missing`);
}

function checkPhase(s: GameState, ctx: EngineCtx, out: string[]): void {
  const ph = s.phase;
  if ((ph.kind === 'combat') !== (s.combat !== null)) out.push(`combat is ${s.combat ? 'set' : 'null'} in phase ${ph.kind}`);
  if (ph.kind === 'deckSelect') {
    for (const uid of ph.options) if (!s.run.deck.some((c) => c.uid === uid)) out.push(`deckSelect option ${uid} not in deck`);
  }
  if (ph.kind === 'event' && !ctx.pack.events[ph.eventId]) out.push(`unknown event ${ph.eventId}`);
  if (ph.kind === 'reward') {
    for (const id of ph.offer.cards) if (!ctx.pack.cards[id]) out.push(`reward offers unknown card ${id}`);
    for (const id of ph.offer.keepsakes) if (!ctx.pack.keepsakes[id]) out.push(`reward offers unknown Keepsake ${id}`);
  }
}

function checkCombat(s: GameState, out: string[]): void {
  const c = s.combat;
  if (!c) return;
  const p = c.player;
  if (p.hp < 0 || p.hp > p.maxHp) out.push(`player hp ${p.hp} outside 0..${p.maxHp}`);
  if (p.guard < 0) out.push(`player guard ${p.guard} < 0`);
  if (c.energy < 0) out.push(`energy ${c.energy} < 0`);
  negativeStacks(p.statuses, 'player', out);
  for (const e of c.enemies) {
    if (e.hp < 0 || e.hp > e.maxHp) out.push(`${e.defId}#${e.uid} hp ${e.hp} outside 0..${e.maxHp}`);
    // R-8: a Shade brought to 0 leaves (or Wavers at 1) within the same hit, so none stays on the field at 0.
    else if (c.outcome === null && e.hp < 1) out.push(`${e.defId}#${e.uid} is on the field at ${e.hp} Intensity`);
    if (e.guard < 0) out.push(`${e.defId}#${e.uid} guard ${e.guard} < 0`);
    negativeStacks(e.statuses, `${e.defId}#${e.uid}`, out);
  }
  const seen = new Map<number, string>();
  for (const [name, pile] of Object.entries(c.piles)) {
    for (const uid of pile ?? []) {
      if (!c.cards[uid]) out.push(`pile ${name} holds unknown card ${uid}`);
      const prev = seen.get(uid);
      if (prev) out.push(`card ${uid} is in both ${prev} and ${name}`);
      seen.set(uid, name);
    }
  }
  for (const uid of Object.keys(c.cards)) if (!seen.has(Number(uid))) out.push(`card ${uid} is in no pile`);
}

/**
 * DESIGN 22 property list plus B3: Heart and Intensity within max (and no Shade left at 0 Intensity, R-8),
 * no negative stacks, piles partition the combat cards, combat non-null iff combat phase, legal actions
 * non-empty unless terminal, at most one of each Insight in the deck (and only Insights in insightsMade).
 */
export function checkInvariants(s: GameState, ctx: EngineCtx, legal?: readonly Action[] | Error): string[] {
  const out: string[] = [];
  if (s.v !== 1) out.push(`state version ${String(s.v)}`);
  checkRun(s, ctx, out);
  checkPhase(s, ctx, out);
  checkCombat(s, out);
  const terminal = s.phase.kind === 'victory' || s.phase.kind === 'defeat';
  if (legal instanceof Error) out.push(`legalActions threw: ${legal.message}`);
  else if (legal && !terminal && legal.length === 0) out.push(`no legal actions in phase ${s.phase.kind}`);
  else if (legal && terminal && legal.length > 0) out.push(`legal actions in terminal phase ${s.phase.kind}`);
  return out;
}

export function assertInvariants(s: GameState, ctx: EngineCtx, legal?: readonly Action[] | Error): void {
  const v = checkInvariants(s, ctx, legal);
  if (v.length > 0) throw new Error(`Invariant violations:\n${v.join('\n')}`);
}
