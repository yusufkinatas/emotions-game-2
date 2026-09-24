// Map pathing (DESIGN 21.1): prefer Havens below 50% Heart, Sanctuaries with 120+ Glimmers, elites above
// 70% Heart, and (map hints) fights whose Shades the deck answers. A DP over the rest of the act picks the
// reachable node on the best path; it is re-run at every move.

import type { ContentPack, GameState, MapNode, Shade } from '../../src/engine/index';
import type { Belief } from './belief';
import { believedAnswers } from './draft';

function answeredShare(node: MapNode, s: GameState, pack: ContentPack, b: Belief): number {
  const faces = new Set<Shade>();
  let numb = false;
  for (const m of node.encounter ? (pack.encounters[node.encounter.id]?.members ?? []) : []) {
    const def = pack.enemies[m.enemy];
    if (!def) continue;
    if (def.faces.length === 0) numb = true;
    for (const f of def.faces) faces.add(f);
  }
  if (faces.size === 0) return numb ? 0.5 : 1;
  let ok = 0;
  for (const f of faces) if (believedAnswers(s, pack, b, f) >= 2) ok += 1;
  return ok / faces.size;
}

export function nodeValue(node: MapNode, s: GameState, pack: ContentPack, b: Belief): number {
  const heartPct = s.run.heart / Math.max(1, s.run.maxHeart);
  const g = s.run.glimmers;
  switch (node.kind) {
    case 'fight': {
      let v = 1.5 + (heartPct < 0.35 ? -1.5 : 0);
      if (b.usesMapHints) v += 2 * answeredShare(node, s, pack, b) - 1;
      return v;
    }
    case 'elite': {
      let v = heartPct > 0.7 ? 4 : heartPct >= 0.5 ? 0.5 : -5;
      if (b.usesMapHints) v += 2 * answeredShare(node, s, pack, b) - 1;
      return v;
    }
    case 'haven':
      return heartPct < 0.5 ? 5 : 1.5;
    case 'sanctuary':
      return g >= 120 ? 4 : g >= 80 ? 1.5 : 0.3;
    case 'memory':
      return 1.5;
    case 'chest':
      return 3;
    case 'boss':
      return 0;
  }
}

/** Reachable node id on the best-valued path to the boss. */
export function pickPath(s: GameState, reachable: readonly number[], pack: ContentPack, b: Belief): number {
  const nodes = s.run.map.nodes;
  const best = new Map<number, number>();
  const byRow = [...nodes].sort((a, c) => c.row - a.row);
  for (const n of byRow) {
    let down = 0;
    let any = false;
    for (const nx of n.next) {
      const v = best.get(nx);
      if (v === undefined) continue;
      down = any ? Math.max(down, v) : v;
      any = true;
    }
    best.set(n.id, nodeValue(n, s, pack, b) + down);
  }
  let pick = reachable[0]!;
  let top = Number.NEGATIVE_INFINITY;
  for (const id of reachable) {
    const v = best.get(id) ?? 0;
    if (v > top) {
      top = v;
      pick = id;
    }
  }
  return pick;
}
