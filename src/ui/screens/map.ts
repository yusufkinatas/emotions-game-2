// Map screen (DESIGN 16.4, 11.4): the act's rows scroll vertically with the start at the bottom and the
// boss at the top. Left: Heart, Glimmers, Keepsakes, Buried cards and the Numbness meter. Right: the legend
// and the engine's detail card for the hovered or focused node. Bottom: the Light Mix bar (opens the deck).
// Keys: 1-4 or Left/Right pick a reachable node, Enter travels, Up/Down scroll, D deck, C Codex.

import type { GameState, MapNode } from '../../engine/index';
import { ACT_NAMES, COACH_MARKS, NODE_KIND_LABEL } from '../../content/index';
import type { App, ScreenController } from '../app';
import { h, replaceChildren } from '../dom';
import { mapEdgesMarkup, mapLegendMarkup, mapNodeMarkup, numbnessMeterMarkup, lightMixMarkup } from '../kit/runHud';
import type { MapEdge, MapNodeProps, MapNodeState } from '../kit/runHud';
import { ornamentFor } from '../kit/shadeOrnaments';
import { nodeIcon, resourceIcon, sigil } from '../kit/sigils';
import { SHADE_NAME } from '../kit/names';
import { toElement } from '../kit/svg';
import { createTopBar } from '../components/topBar';
import { keepsakeRow } from '../components/keepsakes';
import { focusedControl, lightMixSegments } from '../components/cardGrid';
import { ambienceFor, fadeIn, uiSound } from '../components/titleCard';
import '../styles/screens.css';

/** Reference px between rows (acts) and in The Deep's short line. */
const ROW_H = 86;
const DEEP_ROW_H = 150;
const COL_GAP = 170;

interface Placed {
  node: MapNode;
  x: number;
  y: number;
  el: HTMLElement;
  button: HTMLButtonElement;
}

const unit = (): number => Math.min(window.innerWidth / 1280, window.innerHeight / 720);

function reachableIds(app: App, s: GameState): number[] {
  const ids = app.engine
    .legalActions(s)
    .filter((a): a is { t: 'move'; node: number } => a.t === 'move')
    .map((a) => a.node);
  const byId = new Map(s.run.map.nodes.map((n) => [n.id, n]));
  return ids.sort((a, b) => (byId.get(a)?.col ?? 0) - (byId.get(b)?.col ?? 0));
}

/** Nodes on some path from where you stand to `target` (including both ends). */
function routeTo(s: GameState, target: number): Set<number> {
  const nodes = s.run.map.nodes;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const forward = new Set<number>();
  const cur = s.run.map.current;
  const firstRow = Math.min(...nodes.map((n) => n.row));
  const stack = cur === null ? nodes.filter((n) => n.row === firstRow).map((n) => n.id) : [cur];
  while (stack.length) {
    const id = stack.pop()!;
    if (forward.has(id)) continue;
    forward.add(id);
    for (const nx of byId.get(id)?.next ?? []) stack.push(nx);
  }
  if (!forward.has(target)) return new Set();
  const parents = new Map<number, number[]>();
  for (const n of nodes) for (const nx of n.next) parents.set(nx, [...(parents.get(nx) ?? []), n.id]);
  const back = new Set<number>();
  const st = [target];
  while (st.length) {
    const id = st.pop()!;
    if (back.has(id) || !forward.has(id)) continue;
    back.add(id);
    for (const p of parents.get(id) ?? []) st.push(p);
  }
  return back;
}

function nodeState(s: GameState, id: number, reachable: number[]): MapNodeState {
  if (s.run.map.current === id) return 'current';
  if (s.run.map.visited.includes(id)) return 'visited';
  if (reachable.includes(id)) return 'reachable';
  return 'unreachable';
}

function nodeProps(app: App, s: GameState, node: MapNode, state: MapNodeState, key: number | undefined): MapNodeProps {
  const detail = app.engine.nodeDetail(s, node.id);
  const stateWord = { current: 'You are here.', visited: 'Visited.', reachable: `Reachable, key ${key ?? ''}.`, unreachable: 'Not reachable from here.' }[state];
  const label = `${detail.text} ${stateWord}`.trim();
  const shades = detail.shades.map((faces) => (faces.length === 0 ? ['numb' as const] : faces));
  const p: MapNodeProps = { kind: node.kind, state, label, shades, ...(key !== undefined ? { key } : {}) };
  if (node.kind === 'boss' && node.encounter) {
    const enemyId = app.engine.pack.encounters[node.encounter.id]?.members[0]?.enemy;
    const def = enemyId ? app.engine.pack.enemies[enemyId] : undefined;
    if (def) {
      p.silhouette = {
        family: def.visual.family,
        seed: node.seed,
        face: def.faces[0] ?? null,
        innerFace: def.faces.length === 2 ? def.faces[1]! : null,
        nextFace: def.faces.length > 2 ? def.faces[1]! : null,
        ornament: ornamentFor(def.id),
        ...(def.faces.length > 2 ? { faces: def.faces } : {}),
      };
    }
  }
  return p;
}

/** The left panel: Heart, Glimmers, Keepsakes, Buried cards with Weight, Numbness meter. */
function sidePanel(app: App, s: GameState): HTMLElement {
  const run = s.run;
  const summary = app.engine.deckSummary(s);
  const buried = run.deck.filter((c) => app.engine.pack.cards[c.defId]?.buried);
  const panel = h(
    'aside',
    { class: 'map-side panel', attrs: { 'aria-label': 'Your run' } },
    h(
      'div',
      { class: 'map-side__stats' },
      h('span', { class: 'stat-pill stat-pill--heart', html: resourceIcon('heart'), attrs: { 'aria-label': `Heart ${run.heart} of ${run.maxHeart}` } }, h('span', { class: 'num' }, `${run.heart}/${run.maxHeart}`)),
      h('span', { class: 'stat-pill stat-pill--glimmer', html: resourceIcon('glimmer'), attrs: { 'aria-label': `${run.glimmers} Glimmers` } }, h('span', { class: 'num' }, String(run.glimmers))),
    ),
    h('h2', { class: 'eyebrow' }, 'Keepsakes'),
    keepsakeRow(app.engine, run.keepsakes),
    h('h2', { class: 'eyebrow' }, 'Buried'),
    buried.length === 0
      ? h('p', { class: 'muted map-side__none' }, 'Nothing Buried. Resolve Shades with their opposite.')
      : h(
          'ul',
          { class: 'buried-list' },
          buried.map((c) => {
            const def = app.engine.pack.cards[c.defId]!;
            const shade = def.buried!.shade;
            const w = c.weight ?? 1;
            const tip = `${def.name}, Weight ${w}. ${app.engine.describeCard(c.defId, c.upgraded, w)}`;
            return h(
              'li',
              { class: 'buried-item has-tip', dataset: { face: shade }, attrs: { tabindex: 0, 'data-tip': tip, 'aria-label': tip } },
              h('span', { class: 'buried-item__sigil', html: sigil(shade) }),
              h('span', { class: 'buried-item__name' }, SHADE_NAME[shade]),
              h('span', { class: 'buried-item__pips', attrs: { 'aria-hidden': 'true' } }, [1, 2, 3].map((i) => h('i', { class: i <= w ? 'is-on' : '' }))),
              h('span', { class: 'buried-item__w num' }, `W${w}`),
            );
          }),
        ),
    summary.numbness ? numbnessMeter(app, s) : null,
  );
  return panel;
}

function numbnessMeter(app: App, s: GameState): HTMLElement {
  const n = app.engine.deckSummary(s).numbness!;
  const names = n.willSurface.map((uid) => {
    const c = s.run.deck.find((d) => d.uid === uid);
    const def = c ? app.engine.pack.cards[c.defId] : undefined;
    return def ? `${def.name} (W${c!.weight ?? 1})` : '';
  });
  const list = names.filter(Boolean).join(', ');
  const rest = n.hiddenWeight > 0 ? ` The rest add +${n.hiddenIntensity} Intensity.` : '';
  const title = `${list} will surface first in the final fight.${rest}`;
  return toElement<HTMLElement>(numbnessMeterMarkup({ count: n.willSurface.length, title }));
}

/** The node detail card (16.4): the engine's sentence, with the Shades' sigils above it. */
function detailCard(app: App, s: GameState, node: MapNode | null): HTMLElement {
  if (!node) return h('div', { class: 'map-detail map-detail--empty muted' }, 'Hover or focus a node to see what waits there.');
  const d = app.engine.nodeDetail(s, node.id);
  const title = d.names.length ? `${NODE_KIND_LABEL[node.kind]}: ${d.names.join(', ')}` : NODE_KIND_LABEL[node.kind];
  return h(
    'div',
    { class: 'map-detail', dataset: { kind: node.kind }, attrs: { 'aria-live': 'polite' } },
    h('div', { class: 'map-detail__head' }, h('span', { class: 'map-detail__icon', html: nodeIcon(node.kind) }), h('h3', null, title)),
    d.shades.length
      ? h(
          'div',
          { class: 'map-detail__shades' },
          d.shades.map((faces, i) =>
            h(
              'span',
              { class: 'map-detail__shade', dataset: { face: faces[0] ?? 'none' } },
              faces.length ? faces.map((f) => h('span', { class: 'map-detail__sigil', dataset: { face: f }, html: sigil(f) })) : h('span', { class: 'map-detail__sigil', dataset: { face: 'none' }, html: sigil('numb') }),
              h('span', null, d.names[i] ?? ''),
            ),
          ),
        )
      : null,
    h('p', { class: 'map-detail__text' }, d.text),
  );
}

export function mapScreen(app: App): ScreenController {
  const top = createTopBar(app);
  const scroll = h('div', { class: 'map-scroll scroll', attrs: { tabindex: -1 } });
  const canvas = h('div', { class: 'map-canvas' });
  scroll.append(canvas);
  const header = h('div', { class: 'map-header' });
  const mixHost = h('div', { class: 'map-mix' });
  const left = h('div', { class: 'map-left' });
  const legend = h('div', { class: 'map-legend-panel panel', html: `<h2 class="eyebrow">Legend</h2>${mapLegendMarkup()}` });
  const detailHost = h('div', { class: 'map-detail-host panel' });
  const el = h(
    'div',
    { class: 'screen map-screen' },
    top.el,
    h(
      'div',
      { class: 'map-layout' },
      left,
      h('main', { class: 'map-center', attrs: { 'aria-label': 'Map' } }, header, scroll, mixHost),
      h('aside', { class: 'map-right' }, legend, detailHost),
    ),
  );

  let placed: Placed[] = [];
  let reachable: number[] = [];
  let selected: number | null = null;
  let hovered: number | null = null;
  let signature = '';
  let edgesHost: HTMLElement | null = null;
  let firstLayout = true;

  const state = (): GameState | null => (app.state && app.state.phase.kind === 'map' ? app.state : null);

  function travel(id: number): void {
    if (!reachable.includes(id)) return;
    uiSound(app, 'confirm');
    selected = id;
    void app.dispatch({ t: 'move', node: id });
  }

  function focusNode(id: number): void {
    const p = placed.find((x) => x.node.id === id);
    if (!p) return;
    p.button.focus({ preventScroll: true });
    p.el.scrollIntoView?.({ block: 'nearest' });
    showDetail(id);
  }

  function showDetail(id: number | null): void {
    const s = state();
    if (!s) return;
    const node = id === null ? null : (s.run.map.nodes.find((n) => n.id === id) ?? null);
    replaceChildren(detailHost, detailCard(app, s, node));
    drawEdges(id);
    for (const p of placed) p.el.classList.toggle('is-picked', p.node.id === selected);
  }

  function drawEdges(routeTarget: number | null): void {
    const s = state();
    if (!s || !edgesHost) return;
    const route = routeTarget === null ? new Set<number>() : routeTo(s, routeTarget);
    const visited = s.run.map.visited;
    const pos = new Map(placed.map((p) => [p.node.id, p]));
    const edges: MapEdge[] = [];
    for (const p of placed) {
      for (const nx of p.node.next) {
        const q = pos.get(nx);
        if (!q) continue;
        const vi = visited.indexOf(p.node.id);
        const travelled = vi >= 0 && visited[vi + 1] === nx;
        const onRoute = route.has(p.node.id) && route.has(nx);
        edges.push({ from: [p.x, p.y], to: [q.x, q.y], state: travelled ? 'travelled' : onRoute ? 'route' : 'future' });
      }
    }
    const u = unit();
    edgesHost.innerHTML = mapEdgesMarkup({ width: canvas.clientWidth, height: canvas.clientHeight, edges, inset: 34 * u });
  }

  function layout(): void {
    const s = state();
    if (!s) return;
    const u = unit();
    const nodes = s.run.map.nodes;
    const deep = s.run.map.act === 3;
    const rows = [...new Set(nodes.map((n) => n.row))].sort((a, b) => a - b);
    const maxRow = rows[rows.length - 1] ?? 1;
    const rowH = (deep ? DEEP_ROW_H : ROW_H) * u;
    const padTop = 70 * u;
    const padBottom = 60 * u;
    const height = padTop + (rows.length - 1) * rowH + padBottom;
    const width = scroll.clientWidth || 800 * u;
    canvas.style.height = `${Math.max(height, scroll.clientHeight)}px`;
    const offset = Math.max(0, scroll.clientHeight - height) / 2;
    const perRow = new Map<number, number>();
    for (const n of nodes) perRow.set(n.row, (perRow.get(n.row) ?? 0) + 1);
    reachable = reachableIds(app, s);
    canvas.replaceChildren();
    edgesHost = h('div', { class: 'map-edges-host' });
    canvas.append(edgesHost);
    placed = nodes.map((node) => {
      const count = perRow.get(node.row) ?? 1;
      const x = width / 2 + (node.col - (count - 1) / 2) * COL_GAP * u;
      const y = offset + padTop + (maxRow - node.row) * rowH;
      const st = nodeState(s, node.id, reachable);
      const key = st === 'reachable' ? reachable.indexOf(node.id) + 1 : undefined;
      const wrap = h('div', {
        class: ['map-node-wrap', `map-node-wrap--${node.kind}`],
        style: { left: `${x}px`, top: `${y}px` },
        html: mapNodeMarkup(nodeProps(app, s, node, st, key)),
      });
      const button = wrap.querySelector('button')!;
      button.dataset.node = String(node.id);
      // Only reachable nodes take Tab focus (roving focus, 19); the rest still show their detail on hover.
      if (st === 'unreachable') {
        button.disabled = false;
        button.setAttribute('aria-disabled', 'true');
      }
      if (st !== 'reachable') button.tabIndex = -1;
      if (node.kind === 'boss' && node.encounter) {
        const d = app.engine.nodeDetail(s, node.id);
        wrap.append(h('span', { class: 'map-node-wrap__name' }, d.names.join(', ')));
      }
      button.addEventListener('pointerenter', () => {
        hovered = node.id;
        showDetail(node.id);
        if (st === 'reachable') uiSound(app, 'hover');
      });
      button.addEventListener('pointerleave', () => {
        hovered = null;
        showDetail(selected);
      });
      button.addEventListener('focus', () => {
        if (st === 'reachable') selected = node.id;
        showDetail(node.id);
      });
      button.addEventListener('click', (e) => {
        if (st !== 'reachable') return;
        // Touch: the first tap picks (detail and route), the second travels (16.0 tap-to-select).
        if ((e as PointerEvent).pointerType === 'touch' && selected !== node.id) {
          selected = node.id;
          showDetail(node.id);
          return;
        }
        travel(node.id);
      });
      canvas.append(wrap);
      return { node, x, y, el: wrap, button };
    });
    drawEdges(hovered ?? selected);
    if (firstLayout) {
      firstLayout = false;
      const anchor = placed.find((p) => p.node.id === (reachable[0] ?? s.run.map.current));
      if (anchor) scroll.scrollTop = Math.max(0, anchor.y - scroll.clientHeight * 0.62);
      else scroll.scrollTop = scroll.scrollHeight;
    }
  }

  function build(s: GameState): void {
    const act = s.run.map.act;
    replaceChildren(
      header,
      h('h1', { class: 'map-header__act' }, act === 3 ? ACT_NAMES[3] : `Act ${act}: ${ACT_NAMES[act]}`),
      h('span', { class: 'map-header__floor muted' }, `Floor ${s.run.floor}`),
    );
    replaceChildren(left, sidePanel(app, s));
    const summary = app.engine.deckSummary(s);
    mixHost.innerHTML = lightMixMarkup({ segments: lightMixSegments(app.engine, s.run.deck, summary), button: true, width: '100%' });
    mixHost.querySelector('button')?.addEventListener('click', () => app.openOverlay('deck'));
    requestAnimationFrame(() => {
      layout();
      selected = reachable[0] ?? null;
      showDetail(selected);
      const legendEl = legend.querySelector('.map-legend');
      const c13 = COACH_MARKS.find((c) => c.id === 'C13');
      if (c13) app.tips.show('C13', legendEl, c13.copy);
    });
  }

  const onResize = (): void => layout();
  window.addEventListener('resize', onResize);
  fadeIn(el, app);

  return {
    el,
    update(a) {
      top.update(a);
      const s = state();
      if (!s) return;
      const sig = `${s.run.map.act}:${s.run.map.current}:${s.run.map.visited.length}:${s.run.deck.length}:${s.run.heart}:${s.run.glimmers}`;
      if (sig !== signature) {
        const actChanged = signature.split(':')[0] !== String(s.run.map.act);
        signature = sig;
        if (actChanged) ambienceFor(a, s.run.map.act);
        build(s);
      }
    },
    async animate(_events, prev, next, a) {
      const id = next.run.map.current;
      if (id === null || id === prev.run.map.current) return;
      a.tips.dismiss('C13');
      const p = placed.find((x) => x.node.id === id);
      if (!p) return;
      selected = id;
      drawEdges(id);
      p.el.classList.add('is-travel');
      await new Promise((r) => setTimeout(r, a.dur(400)));
    },
    onKey(e, a) {
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= reachable.length) {
        const id = reachable[n - 1]!;
        if (selected === id && document.activeElement === placed.find((p) => p.node.id === id)?.button) travel(id);
        else {
          selected = id;
          focusNode(id);
          uiSound(a, 'hover');
        }
        return true;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (reachable.length === 0) return true;
        const i = selected === null ? -1 : reachable.indexOf(selected);
        const next = e.key === 'ArrowRight' ? (i + 1) % reachable.length : (i - 1 + reachable.length) % reachable.length;
        selected = reachable[next]!;
        focusNode(selected);
        return true;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        scroll.scrollBy({ top: (e.key === 'ArrowUp' ? -1 : 1) * 140 * unit(), behavior: a.reducedMotion() ? 'auto' : 'smooth' });
        return true;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        const f = focusedControl(el);
        const id = Number(f?.dataset.node);
        if (f && Number.isInteger(id)) {
          if (reachable.includes(id)) travel(id);
          return true;
        }
        // Any other focused control (Light Mix, a Keepsake) activates natively.
        if (f) return false;
        if (selected !== null) travel(selected);
        return true;
      }
      return false;
    },
    destroy() {
      window.removeEventListener('resize', onResize);
    },
  };
}
