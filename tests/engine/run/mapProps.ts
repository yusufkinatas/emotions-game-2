// Map property checks shared by the 30-seed test and the 2000-seed slow test (DESIGN 11, 22).

import type { EngineCtx, MapNode, MapState } from '../../../src/engine/types';
import { hash32 } from '../../../src/engine/rng';

const RESTRICTED = new Set<MapNode['kind']>(['haven', 'sanctuary', 'elite']);

export interface MapCheckOpts {
  seed: number;
  act: 1 | 2;
  tutorial: boolean;
}

/** Returns human-readable violations (empty when the map is valid). */
export function mapViolations(ctx: EngineCtx, map: MapState, o: MapCheckOpts): string[] {
  const out: string[] = [];
  const nodes = map.nodes;
  const rows = new Map<number, MapNode[]>();
  for (const n of nodes) rows.set(n.row, [...(rows.get(n.row) ?? []), n]);
  const row = (r: number): MapNode[] => (rows.get(r) ?? []).sort((a, b) => a.col - b.col);

  if (rows.size !== 10) out.push(`expected 10 rows, got ${rows.size}`);
  if (row(1).length !== 3) out.push(`row 1 has ${row(1).length} nodes`);
  for (let r = 2; r <= 9; r++) if (![3, 4].includes(row(r).length)) out.push(`row ${r} has ${row(r).length} nodes`);
  if (row(10).length !== 1 || row(10)[0]!.kind !== 'boss') out.push('row 10 must be a single boss');
  nodes.forEach((n, i) => {
    if (n.id !== i) out.push(`node index ${i} has id ${n.id}`);
    if (n.seed !== hash32(o.seed, o.act, n.id)) out.push(`node ${n.id} seed mismatch`);
    row(n.row).forEach((m, c) => {
      if (m.col !== c) out.push(`row ${n.row} cols not 0..n-1`);
    });
  });

  // Edges: adjacent rows only, (0,0) and (last,last) present, no crossings, degrees 1..2 (boss excepted).
  const inDeg = new Map<number, number>();
  for (let r = 1; r <= 9; r++) {
    const lower = row(r);
    const upper = row(r + 1);
    const pairs: [number, number][] = [];
    for (const n of lower) {
      for (const c of n.next) {
        const m = nodes[c];
        if (!m || m.row !== r + 1) out.push(`edge ${n.id}->${c} not to the next row`);
        else pairs.push([n.col, m.col]);
        inDeg.set(c, (inDeg.get(c) ?? 0) + 1);
      }
      if (r < 9 && (n.next.length < 1 || n.next.length > 2)) out.push(`node ${n.id} has ${n.next.length} out-edges`);
      if (r === 9 && n.next.length !== 1) out.push(`row 9 node ${n.id} must join the boss`);
    }
    if (!pairs.some(([a, b]) => a === 0 && b === 0)) out.push(`rows ${r}-${r + 1} lack edge (0,0)`);
    if (!pairs.some(([a, b]) => a === lower.length - 1 && b === upper.length - 1)) out.push(`rows ${r}-${r + 1} lack the last edge`);
    for (const [a1, b1] of pairs) for (const [a2, b2] of pairs) if (a1 < a2 && b1 > b2) out.push(`crossing edges in rows ${r}-${r + 1}`);
  }
  for (const n of nodes) {
    if (n.row === 1 || n.row === 10) continue;
    const d = inDeg.get(n.id) ?? 0;
    if (d < 1 || d > 2) out.push(`node ${n.id} has ${d} in-edges`);
  }
  if ((inDeg.get(row(10)[0]!.id) ?? 0) !== row(9).length) out.push('boss must be joined by every row 9 node');

  // Reachability: every node is reachable from row 1 and reaches the boss.
  const reach = new Set(row(1).map((n) => n.id));
  for (const n of nodes) if (reach.has(n.id)) for (const c of n.next) reach.add(c);
  if (reach.size !== nodes.length) out.push('unreachable nodes');
  const toBoss = new Set([row(10)[0]!.id]);
  for (const n of [...nodes].reverse()) if (n.next.some((c) => toBoss.has(c))) toBoss.add(n.id);
  if (toBoss.size !== nodes.length) out.push('nodes that cannot reach the boss');

  // Kinds per row.
  const tut = o.tutorial && o.act === 1;
  for (const n of nodes) {
    const fixed: Record<number, MapNode['kind']> = { 1: 'fight', 2: 'fight', 5: 'chest', 9: 'haven', 10: 'boss' };
    if (tut) Object.assign(fixed, { 3: 'fight', 4: 'fight' });
    if (fixed[n.row] && n.kind !== fixed[n.row]) out.push(`row ${n.row} node ${n.id} is ${n.kind}`);
    const allowed: Record<number, MapNode['kind'][]> = {
      3: ['fight', 'memory', 'sanctuary'],
      4: ['fight', 'memory', 'haven', 'sanctuary'],
      6: ['fight', 'elite', 'memory', 'sanctuary'],
      7: ['fight', 'elite', 'memory', 'haven', 'sanctuary'],
      8: ['fight', 'elite', 'memory', 'sanctuary'],
    };
    if (!fixed[n.row] && allowed[n.row] && !allowed[n.row]!.includes(n.kind)) out.push(`row ${n.row} has kind ${n.kind}`);
  }

  // Repair rules.
  for (const n of nodes) {
    for (const c of n.next) {
      const m = nodes[c]!;
      if (RESTRICTED.has(n.kind) && m.kind === n.kind) out.push(`${n.kind}-${m.kind} edge ${n.id}->${c}`);
    }
  }
  const elites = nodes.filter((n) => n.kind === 'elite');
  if (elites.some((n) => n.row < 6 || n.row > 8)) out.push('elite outside rows 6-8');
  const eliteRowNodes = nodes.filter((n) => n.row >= 6 && n.row <= 8);
  const convertible = eliteRowNodes.filter((n) => n.kind === 'fight').length;
  if (elites.length < 2 && convertible > 0) {
    // Rule 2 only stops early when no Fight without an Elite neighbour is left.
    const parents = (id: number) => nodes.filter((p) => p.next.includes(id)).map((p) => p.id);
    const free = eliteRowNodes.filter(
      (n) => n.kind === 'fight' && ![...n.next, ...parents(n.id)].some((m) => nodes[m]!.kind === 'elite'),
    );
    if (free.length > 0) out.push(`only ${elites.length} elites with free fights left`);
  }
  if (!nodes.some((n) => n.row >= 3 && n.row <= 8 && n.kind === 'sanctuary')) out.push('no sanctuary in rows 3-8');

  // Encounters: pools per row, the elite row split, HP within ranges.
  const pools = o.act === 1 ? ctx.pack.pools.act1 : ctx.pack.pools.act2;
  const row6 = new Set(row(6).filter((n) => n.kind === 'elite').map((n) => n.encounter?.id));
  const row8 = new Set(row(8).filter((n) => n.kind === 'elite').map((n) => n.encounter?.id));
  if (row6.size > 1) out.push('row 6 elites differ');
  if (row8.size > 1) out.push('row 8 elites differ');
  if (row6.size === 1 && row8.size === 1 && [...row6][0] === [...row8][0] && pools.elite.length > 1) out.push('rows 6 and 8 share an elite');
  for (const n of nodes) {
    const isCombat = n.kind === 'fight' || n.kind === 'elite' || n.kind === 'boss';
    if (isCombat !== (n.encounter !== undefined)) out.push(`node ${n.id} (${n.kind}) encounter presence wrong`);
    if (!n.encounter) continue;
    const id = n.encounter.id;
    let pool: string[];
    if (n.kind === 'boss') pool = [pools.boss];
    else if (n.kind === 'elite') pool = pools.elite;
    else if (tut && n.row <= 4) pool = [ctx.pack.pools.tutorial[n.row - 1]!];
    else if (n.row <= 2) pool = pools.early;
    else if (n.row === 3) pool = pools.row3 ?? pools.early;
    else pool = pools.standard;
    if (!pool.includes(id)) out.push(`node ${n.id} row ${n.row} has ${id} outside its pool`);
    const members = ctx.pack.encounters[id]!.members;
    if (n.encounter.hps.length !== members.length) out.push(`node ${n.id} hps length`);
    members.forEach((m, i) => {
      const [lo, hi] = m.hp ?? ctx.pack.enemies[m.enemy]!.hp;
      const hp = n.encounter!.hps[i]!;
      if (hp < lo || hp > hi || !Number.isInteger(hp)) out.push(`node ${n.id} hp ${hp} outside ${lo}-${hi}`);
    });
  }
  return out;
}

/** Share of normal fight nodes whose encounter equals a parent's (allowed only after 5 failed rerolls). */
export function parentRepeatRate(map: MapState): { repeats: number; fights: number } {
  let repeats = 0;
  let fights = 0;
  for (const n of map.nodes) {
    if (n.kind !== 'fight' || !n.encounter) continue;
    const parents = map.nodes.filter((p) => p.next.includes(n.id) && p.encounter);
    if (parents.length === 0) continue;
    fights += 1;
    if (parents.some((p) => p.encounter!.id === n.encounter!.id)) repeats += 1;
  }
  return { repeats, fights };
}
