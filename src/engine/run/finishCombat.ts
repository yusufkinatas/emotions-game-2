// Applies a CombatResult to the run (DESIGN 5.8, 4.10, B3, minor-6): the only way combat changes the run.

import type { CombatResult, CombatStats, DeckMutation, EngineCtx, GameState, Light, Relation, Uid } from '../types';
import { isBuried } from './cards';
import { addBuried, buriedToInsight, findCard, removeCard } from './deck';
import { cardDef } from './state';

function mergeStats(d: GameState, cs: CombatStats): void {
  const st = d.run.stats;
  st.resolved += cs.resolved;
  st.deepResolved += cs.deepResolved;
  st.suppressed += cs.suppressed;
  st.harmonies += cs.harmonies;
  st.tends += cs.tends;
  st.insights += cs.insights;
  st.cardsPlayed += cs.cardsPlayed;
  st.heartLost += cs.heartLost;
  for (const [l, n] of Object.entries(cs.playsByLight)) st.playsByLight[l as Light] = (st.playsByLight[l as Light] ?? 0) + (n ?? 0);
  for (const [id, n] of Object.entries(cs.playsByCard)) st.playsByCard[id] = (st.playsByCard[id] ?? 0) + n;
  for (const [r, n] of Object.entries(cs.dmgByRelation)) {
    st.dmgByRelation[r as Relation] = (st.dmgByRelation[r as Relation] ?? 0) + (n ?? 0);
  }
  st.combats += 1;
}

/** True if a later mutation already decides what happens to this card at Weight 0. */
const decidedLater = (muts: readonly DeckMutation[], from: number, uid: Uid): boolean =>
  muts.slice(from + 1).some((m) => (m.k === 'transform' || m.k === 'remove') && m.uid === uid);

function applyMutations(d: GameState, ctx: EngineCtx, muts: readonly DeckMutation[]): void {
  muts.forEach((m, i) => {
    switch (m.k) {
      case 'suppress':
        addBuried(d, ctx, m.shade);
        break;
      case 'tend': {
        const card = findCard(d, m.uid);
        if (!card || !isBuried(cardDef(ctx, card.defId))) break;
        const w = card.weight ?? 1;
        if (w > 1) card.weight = (w - 1) as 1 | 2;
        else if (!decidedLater(muts, i, m.uid) && buriedToInsight(d, ctx, m.uid) === 'insight') {
          d.run.stats.insights += 1;
        }
        break;
      }
      case 'transform': {
        const card = findCard(d, m.uid);
        if (!card) break;
        // B3 guard: an Insight created earlier this run is never made again; the Buried card is released.
        if (d.run.insightsMade.includes(m.to)) removeCard(d, m.uid);
        else buriedToInsight(d, ctx, m.uid, m.to, m.upgraded);
        break;
      }
      case 'remove':
        removeCard(d, m.uid);
        break;
      case 'returnSurfaced':
        break;
    }
  });
}

export function applyCombatResult(d: GameState, ctx: EngineCtx, r: CombatResult): void {
  const run = d.run;
  run.heart = Math.max(0, Math.min(run.maxHeart, r.heartAfter));
  run.glimmers += r.glimmers;
  applyMutations(d, ctx, r.mutations);
  run.heart = Math.min(run.heart, run.maxHeart);
  for (const [id, n] of Object.entries(r.keepsakeCounters)) {
    const k = run.keepsakes.find((x) => x.id === id);
    if (k) k.counter = n;
  }
  run.paperCraneUsed = run.paperCraneUsed || r.paperCraneUsed;
  mergeStats(d, r.stats);
  if (r.outcome === 'won') run.combatsWon += 1;
}
