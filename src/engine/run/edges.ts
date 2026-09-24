// Non-crossing staircase edges between two map rows (DESIGN 11.2, minor-7).

import type { Rng } from '../rng';

type Move = 'both' | 'i' | 'j';

const MAX_REJECTIONS = 50;

function multiset(k: number, dA: number, dB: number): Move[] {
  const out: Move[] = [];
  for (let n = 0; n < k; n++) out.push('both');
  for (let n = 0; n < dA - k; n++) out.push('i');
  for (let n = 0; n < dB - k; n++) out.push('j');
  return out;
}

/** Two identical single moves in a row would give one node 3 edges. */
function valid(moves: readonly Move[]): boolean {
  for (let n = 1; n < moves.length; n++) {
    const a = moves[n - 1]!;
    if (a !== 'both' && a === moves[n]) return false;
  }
  return true;
}

/**
 * Index pairs (column in the lower row, column in the upper row) for rows of sizes a and b.
 * A monotone path from (0,0) to (a-1,b-1): edges never cross, and every node has 1 or 2 edges on this side.
 * A row of size 1 (the boss) simply joins every node of the other row.
 */
export function staircaseEdges(a: number, b: number, rng: Rng): [number, number][] {
  if (a === 1 || b === 1) {
    const all: [number, number][] = [];
    for (let i = 0; i < a; i++) for (let j = 0; j < b; j++) all.push([i, j]);
    return all;
  }
  const dA = a - 1;
  const dB = b - 1;
  const kMax = Math.min(dA, dB);
  let moves = rng.shuffle(multiset(rng.int(0, kMax), dA, dB));
  let rejections = 0;
  while (!valid(moves)) {
    rejections += 1;
    if (rejections >= MAX_REJECTIONS) {
      moves = rng.shuffle(multiset(kMax, dA, dB));
      break;
    }
    moves = rng.shuffle(moves);
  }
  const pairs: [number, number][] = [[0, 0]];
  let i = 0;
  let j = 0;
  for (const m of moves) {
    if (m !== 'j') i += 1;
    if (m !== 'i') j += 1;
    pairs.push([i, j]);
  }
  return pairs;
}
