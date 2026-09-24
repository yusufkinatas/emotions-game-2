// Map generation (DESIGN 11, 8, 17.1): shape, staircase edges, node kinds, repair pass, encounters, seeds.

import { hash32, rngFrom, type Rng } from '../rng';
import type { EncounterId, EngineCtx, MapNode, MapState, RowPools } from '../types';
import { staircaseEdges } from './edges';

type NodeKind = MapNode['kind'];
type Weighted = { item: NodeKind; weight: number }[];

export const ACT_ROWS = 9;
export const BOSS_ROW = 10;

/** Node kinds per row of a normal act (11.3). A string is a fixed kind. */
const ROW_KINDS: Record<number, NodeKind | Weighted> = {
  1: 'fight',
  2: 'fight',
  3: [
    { item: 'fight', weight: 50 },
    { item: 'memory', weight: 30 },
    { item: 'sanctuary', weight: 20 },
  ],
  4: [
    { item: 'fight', weight: 45 },
    { item: 'memory', weight: 25 },
    { item: 'haven', weight: 15 },
    { item: 'sanctuary', weight: 15 },
  ],
  5: 'chest',
  6: [
    { item: 'fight', weight: 40 },
    { item: 'elite', weight: 30 },
    { item: 'memory', weight: 20 },
    { item: 'sanctuary', weight: 10 },
  ],
  7: [
    { item: 'fight', weight: 45 },
    { item: 'elite', weight: 25 },
    { item: 'memory', weight: 20 },
    { item: 'haven', weight: 10 },
  ],
  8: [
    { item: 'fight', weight: 40 },
    { item: 'elite', weight: 25 },
    { item: 'memory', weight: 20 },
    { item: 'sanctuary', weight: 15 },
  ],
  9: 'haven',
  10: 'boss',
};

/** Tutorial run (17.1): rows 1 to 4 are fixed fights with the tutorial encounters. */
const TUTORIAL_ROWS = 4;
/** Kinds that may never be joined by an edge to the same kind (repair rule 1). */
const NO_PAIRS: ReadonlySet<NodeKind> = new Set<NodeKind>(['haven', 'sanctuary', 'elite']);
const MAX_KIND_REROLLS = 10;
const MAX_ENCOUNTER_REROLLS = 5;
const ELITE_ROWS = [6, 7, 8];
const MIN_ELITES = 2;

const isFixedRow = (row: number, tutorial: boolean): boolean =>
  typeof ROW_KINDS[row] === 'string' || (tutorial && row <= TUTORIAL_ROWS);

function rollKind(row: number, rng: Rng): NodeKind {
  const k = ROW_KINDS[row]!;
  return typeof k === 'string' ? k : rng.weighted(k);
}

export const nodeSeed = (runSeed: number, act: number, id: number): number => hash32(runSeed, act, id);

/** Parent ids of every node (nodes whose `next` contains it). */
export function parentsOf(nodes: readonly MapNode[]): number[][] {
  const out: number[][] = nodes.map(() => []);
  for (const n of nodes) for (const c of n.next) out[c]!.push(n.id);
  return out;
}

export function rollEncounterHps(ctx: EngineCtx, id: EncounterId, rng: Rng): number[] {
  const enc = ctx.pack.encounters[id];
  if (!enc) throw new Error(`Unknown encounter ${id}`);
  return enc.members.map((m) => {
    const def = ctx.pack.enemies[m.enemy];
    if (!def) throw new Error(`Unknown enemy ${m.enemy} in ${id}`);
    const [lo, hi] = m.hp ?? def.hp;
    return rng.int(lo, hi);
  });
}

function fightPool(pools: RowPools, row: number): EncounterId[] {
  if (row <= 2) return pools.early;
  if (row === 3) return pools.row3 ?? pools.early;
  return pools.standard;
}

/** Repair rule 1: reroll nodes joined to a node of the same restricted kind; after 10 rerolls, Fight. */
function repairPairs(nodes: MapNode[], parents: number[][], tutorial: boolean, rng: Rng): void {
  const clashes = (n: MapNode): boolean =>
    NO_PAIRS.has(n.kind) && [...n.next, ...parents[n.id]!].some((m) => nodes[m]!.kind === n.kind);
  for (const n of nodes) {
    if (isFixedRow(n.row, tutorial) || !clashes(n)) continue;
    for (let t = 0; t < MAX_KIND_REROLLS && clashes(n); t++) n.kind = rollKind(n.row, rng);
    if (clashes(n)) n.kind = 'fight';
  }
}

/** Repair rule 2: at least 2 Elites in rows 6 to 8, converting Fights with no Elite neighbour. */
function repairElites(nodes: MapNode[], parents: number[][], rng: Rng): void {
  const inRows = (n: MapNode): boolean => ELITE_ROWS.includes(n.row);
  const eliteNear = (n: MapNode): boolean => [...n.next, ...parents[n.id]!].some((m) => nodes[m]!.kind === 'elite');
  while (nodes.filter((n) => inRows(n) && n.kind === 'elite').length < MIN_ELITES) {
    const cands = nodes.filter((n) => inRows(n) && n.kind === 'fight' && !eliteNear(n));
    if (cands.length === 0) return;
    rng.pick(cands).kind = 'elite';
  }
}

/** Repair rule 3: at least 1 Sanctuary in rows 3 to 8 (never in the tutorial's fixed rows). */
function repairSanctuary(nodes: MapNode[], tutorial: boolean, rng: Rng): void {
  const inRows = (n: MapNode): boolean => n.row >= 3 && n.row <= 8 && !(tutorial && n.row <= TUTORIAL_ROWS);
  if (nodes.some((n) => n.row >= 3 && n.row <= 8 && n.kind === 'sanctuary')) return;
  const cands = nodes.filter((n) => inRows(n) && (n.kind === 'fight' || n.kind === 'memory'));
  if (cands.length > 0) rng.pick(cands).kind = 'sanctuary';
}

/** Repair rule 4: encounters and pre-rolled Intensity, differing from parents; Elites follow the row split. */
function rollEncounters(
  ctx: EngineCtx,
  nodes: MapNode[],
  parents: number[][],
  act: 1 | 2,
  tutorial: boolean,
  rng: Rng,
): void {
  const pools = act === 1 ? ctx.pack.pools.act1 : ctx.pack.pools.act2;
  const eliteOrder = rng.shuffle(pools.elite);
  for (const n of nodes) {
    if (n.kind !== 'fight' && n.kind !== 'elite' && n.kind !== 'boss') continue;
    const erng = rngFrom(n.seed, 'enc');
    let id: EncounterId;
    if (n.kind === 'boss') {
      id = pools.boss;
    } else if (n.kind === 'elite') {
      if (eliteOrder.length === 0) throw new Error(`Act ${act} has no elite encounters`);
      if (n.row === 7) id = rng.pick(eliteOrder);
      else id = n.row >= 8 ? eliteOrder[Math.min(1, eliteOrder.length - 1)]! : eliteOrder[0]!;
    } else if (tutorial && n.row <= TUTORIAL_ROWS) {
      id = ctx.pack.pools.tutorial[n.row - 1]!;
    } else {
      const pool = fightPool(pools, n.row);
      if (pool.length === 0) throw new Error(`Act ${act} row ${n.row} has no encounters`);
      const parentEncs = parents[n.id]!.map((p) => nodes[p]!.encounter?.id);
      id = erng.pick(pool);
      for (let t = 0; t < MAX_ENCOUNTER_REROLLS && parentEncs.includes(id); t++) id = erng.pick(pool);
    }
    n.encounter = { id, hps: rollEncounterHps(ctx, id, erng) };
  }
}

/** Acts 1 and 2: rows 1 to 9 of 3 or 4 nodes (row 1 has 3) plus the boss row. Node id = array index. */
export function generateActMap(ctx: EngineCtx, runSeed: number, act: 1 | 2, tutorial: boolean): MapState {
  const rng = rngFrom(runSeed, 'map', act);
  const tut = tutorial && act === 1;
  const sizes: number[] = [3];
  for (let r = 2; r <= ACT_ROWS; r++) sizes.push(rng.float() < 0.5 ? 3 : 4);
  sizes.push(1);

  const nodes: MapNode[] = [];
  const rowStart: number[] = [];
  sizes.forEach((size, idx) => {
    rowStart.push(nodes.length);
    for (let col = 0; col < size; col++) {
      const id = nodes.length;
      nodes.push({ id, row: idx + 1, col, next: [], kind: 'fight', seed: nodeSeed(runSeed, act, id) });
    }
  });

  for (let r = 0; r < sizes.length - 1; r++) {
    for (const [i, j] of staircaseEdges(sizes[r]!, sizes[r + 1]!, rng)) {
      nodes[rowStart[r]! + i]!.next.push(rowStart[r + 1]! + j);
    }
  }

  for (const n of nodes) n.kind = tut && n.row <= TUTORIAL_ROWS ? 'fight' : rollKind(n.row, rng);

  const parents = parentsOf(nodes);
  repairPairs(nodes, parents, tut, rng);
  repairElites(nodes, parents, rng);
  repairPairs(nodes, parents, tut, rng);
  repairSanctuary(nodes, tut, rng);
  rollEncounters(ctx, nodes, parents, act, tut, rng);

  return { act, nodes, current: null, visited: [] };
}

/** The Deep (3.1): Sanctuary -> Haven -> The Numbness. */
export function generateDeepMap(ctx: EngineCtx, runSeed: number): MapState {
  const kinds: NodeKind[] = ['sanctuary', 'haven', 'boss'];
  const nodes: MapNode[] = kinds.map((kind, id) => ({
    id,
    row: id + 1,
    col: 0,
    next: id < kinds.length - 1 ? [id + 1] : [],
    kind,
    seed: nodeSeed(runSeed, 3, id),
  }));
  const boss = nodes[2]!;
  boss.encounter = { id: ctx.pack.pools.deep, hps: rollEncounterHps(ctx, ctx.pack.pools.deep, rngFrom(boss.seed, 'enc')) };
  return { act: 3, nodes, current: null, visited: [] };
}

/** Nodes you may move to: row 1 before the first move of an act, else the current node's children. */
export function reachableNodes(map: MapState): number[] {
  if (map.current === null) {
    const firstRow = Math.min(...map.nodes.map((n) => n.row));
    return map.nodes.filter((n) => n.row === firstRow).map((n) => n.id);
  }
  const cur = map.nodes.find((n) => n.id === map.current);
  return cur ? [...cur.next].sort((a, b) => a - b) : [];
}
