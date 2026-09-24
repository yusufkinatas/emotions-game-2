// The combat screen (DESIGN 16.1, 16.2, 19): layout, selection and targeting, keyboard, and the hooks the
// animation layer uses. Renders from the view model (model.ts); every rule comes from the engine.

import { SHADE_LINES } from '../../../content/index';
import type { GameEvent, GameState, Light, Uid } from '../../../engine/types';
import { animateCombat } from '../../anim/index';
import type { App, ScreenController } from '../../app';
import { createTopBar, type LiveTopBar } from '../../components/topBar';
import { h } from '../../dom';
import { cardFaceMarkup, fitCards } from '../../kit/cardFace';
import { threadMarkup } from '../../kit/thread';
import { toElement } from '../../kit/svg';
import type { synth } from '../../audio/synth';
import '../../styles/combat.css';
import { appendLog, restoreLog } from '../../overlays/log';
import { Breakdown } from './breakdown';
import { Coach } from './coach';
import { CompassView, RightColumn } from './controls';
import { Hand } from './hand';
import { buildModel, type CombatModel } from './model';
import { PlayerPanel } from './playerPanel';
import { buildSelection, cycleFocus, focusedOption, hasEnemyTargets, hasUntargeted, optionFor, type Selection, type TargetKey, type TargetOption } from './selection';
import { ShadeRow } from './shadeRow';
import { pickLine } from './text';

export type Sfx = typeof synth;

/** Engine sentences write "->"; show a real arrow. */
const arrows = (t: string): string => t.replace(/->/g, '→');

/** Everything the animation layer may touch. */
export interface CombatView {
  app: App;
  root: HTMLElement;
  stage: HTMLElement;
  fx: HTMLElement;
  vignette: HTMLElement;
  topBar: LiveTopBar;
  player: PlayerPanel;
  shades: ShadeRow;
  hand: Hand;
  compass: CompassView;
  right: RightColumn;
  live: HTMLElement;
  sfx: Sfx;
  feltCracks: Map<Uid, [Light, Light][]>;
  smudges: number[];
  barked: Set<Uid>;
  /** Render a (possibly animated, hand-edited) model into the components. */
  renderModel(m: CombatModel, opts?: { dealing?: boolean }): void;
  /** Build a model of a real state without selection or hover. */
  plainModel(s: GameState): CombatModel;
  /** Screen position (px, inside root) of an element's centre. */
  centerOf(el: Element | null | undefined): { x: number; y: number };
}

export class CombatScreen implements ScreenController {
  readonly el: HTMLElement;
  private readonly canvas: HTMLElement;
  private readonly view: CombatView;
  private readonly coach: Coach;
  private readonly breakdown = new Breakdown();
  private readonly playLine: HTMLElement;
  private readonly pendingEl: HTMLElement;
  private readonly threadHost: HTMLElement;
  private sel: Selection | null = null;
  private selState: GameState | null = null;
  private hoverCard: Uid | null = null;
  private endTurnHover = false;
  private shift = false;
  private message = '';
  private messageTimer = 0;
  private animating = false;
  private refocusIndex: number | null = null;
  private lastModel: CombatModel | null = null;
  private mountedState: GameState | null = null;
  private region: 'hand' | 'shades' = 'hand';
  private refreshing = false;
  private heartbeatTurn = -1;
  /** An input that arrived during an animation: it fast-forwards the animation, then runs (16.2: input is never held). */
  private queued: (() => void) | null = null;
  /** The last input was a key press (focus follows plays only then). */
  private keyboardMode = false;
  private dirty = false;
  private shadeFocus = 0;
  /** What the running dispatch is: an End Turn in flight must never queue another (a double-click ends one turn). */
  private inFlight: 'endTurn' | 'play' | 'other' | null = null;
  /** End Turn ignores clicks and E presses until this time (performance.now ms). */
  private endTurnReadyAt = 0;
  /** The last End Turn click or E press, accepted or not. */
  private endTurnPressAt = -Infinity;
  /** Mounted by Continue in the middle of a turn: Undo has no history back past this point. */
  private resumedAt: { turn: number; played: number } | null = null;
  private readonly onKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Shift' && this.shift) {
      this.shift = false;
      this.refresh();
    }
  };
  /** Focus can scroll the clipped stage (the fanned hand pokes past the bottom); keep it pinned. */
  private readonly onScroll = (e: Event) => {
    const t = e.target === document ? document.scrollingElement : e.target;
    if (t instanceof HTMLElement && (t === this.el || t.contains(this.el)) && t.scrollTop !== 0) t.scrollTop = 0;
  };
  private readonly onBlur = () => {
    if (this.shift) {
      this.shift = false;
      this.refresh();
    }
  };

  constructor(private readonly app: App) {
    const sfx = app.audio as unknown as Sfx;
    const topBar = createTopBar(app);
    const player = new PlayerPanel({
      onInward: () => this.target('inward'),
      onInwardHover: (on) => on && this.hoverTarget('inward'),
    });
    const shades = new ShadeRow({ onTarget: (uid) => this.target(uid), onHover: (uid) => uid !== null && this.hoverTarget(uid) });
    const hand = new Hand({
      onCard: (uid) => this.selectCard(uid),
      onHover: (uid) => this.hoverHand(uid),
      onCancel: () => this.cancel(),
    });
    const handlers = {
      onEndTurn: () => this.endTurn(),
      onEndTurnHover: (on: boolean) => {
        if (this.endTurnHover !== on) {
          this.endTurnHover = on;
          this.refresh();
        }
      },
      onUndo: () => this.undo(),
      onDraw: () => app.openOverlay('draw'),
      onDiscard: () => app.openOverlay('discard'),
      onLog: () => app.openOverlay('log'),
    };
    const compass = new CompassView(handlers);
    const right = new RightColumn(handlers);
    this.playLine = h('p', { class: 'cb-playline', attrs: { 'aria-live': 'polite', role: 'status' } });
    this.pendingEl = h('div', { class: 'cb-pending', attrs: { role: 'dialog', 'aria-label': 'Choose a card' } });
    this.pendingEl.hidden = true;
    this.threadHost = h('div', { class: 'cb-thread' });
    const fx = h('div', { class: 'cb-fx', attrs: { 'aria-hidden': 'true' } });
    const vignette = h('div', { class: 'vignette' });
    const live = h('div', { class: 'sr-only', attrs: { 'aria-live': 'polite', role: 'status' } });
    const floor = h('div', { class: 'cb-floor' });
    const stage = h('div', { class: 'cb-stage' }, floor, player.el, shades.el);
    const band = h('div', { class: 'cb-band' }, compass.el, this.playLine, hand.el, right.el);
    const canvas = h(
      'div',
      { class: 'combat__canvas' },
      topBar.el,
      stage,
      band,
      this.threadHost,
      this.pendingEl,
      this.breakdown.el,
      fx,
      live,
    );
    this.el = h(
      'div',
      { class: 'combat', on: { click: (e) => this.stageClick(e), contextmenu: (e) => this.contextMenu(e) } },
      canvas,
      vignette,
    );
    this.canvas = canvas;
    this.el.addEventListener('pointerdown', () => (this.keyboardMode = false), true);
    this.coach = new Coach(app);
    const self = this;
    this.view = {
      app,
      root: canvas,
      stage,
      fx,
      vignette,
      topBar,
      player,
      shades,
      hand,
      compass,
      right,
      live,
      sfx,
      feltCracks: new Map(),
      smudges: [],
      barked: new Set(),
      renderModel: (m, opts) => self.renderModel(m, opts?.dealing ?? true),
      plainModel: (s) => buildModel(app, s, { sel: null, hoverCard: null, endTurnHover: false, feltCracks: self.view.feltCracks }),
      centerOf: (el) => self.centerOf(el),
    };
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('scroll', this.onScroll, true);
  }

  destroy(): void {
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('scroll', this.onScroll, true);
    this.app.tips.dismiss();
    clearTimeout(this.messageTimer);
  }

  // ---------------------------------------------------------------------------------------------
  // Rendering

  centerOf(el: Element | null | undefined): { x: number; y: number } {
    const root = this.canvas.getBoundingClientRect();
    if (!el) return { x: root.width / 2, y: root.height / 2 };
    const r = el.getBoundingClientRect();
    return { x: r.left - root.left + r.width / 2, y: r.top - root.top + r.height / 2 };
  }

  update(app: App): void {
    const s = app.state;
    if (!s?.combat) return;
    this.view.topBar.update(app);
    if (this.animating) return;
    const first = this.mountedState === null;
    if (first) this.onMount(s);
    this.syncSelection(s);
    this.refresh();
    if (first) this.playIntro(s);
    if (this.queued && !app.busy) {
      const fn = this.queued;
      this.queued = null;
      fn();
    }
  }

  /** Fight start: Surfaced Shades rise from grey water (18.1 Surfacing), the Numbness veil thickens. */
  private playIntro(s: GameState): void {
    const c = s.combat!;
    if (c.turn !== 1 || c.turnFlags.played > 0) return;
    const risen = c.enemies.filter((e) => e.surfacedFrom !== null);
    risen.forEach((e, i) => {
      const slot = this.view.shades.slot(e.uid)?.root;
      if (!slot) return;
      slot.style.setProperty('--surface-delay', `${this.app.dur(i * 180)}ms`);
      slot.classList.add('cb-surfacing');
      setTimeout(() => slot.classList.remove('cb-surfacing'), this.app.dur(1300 + i * 180) || 0);
    });
    if (risen.length) {
      const boss = c.enemies.find((e) => e.faces.length === 0 && e.surfacedFrom === null);
      const bossSlot = boss ? this.view.shades.slot(boss.uid)?.root : null;
      if (bossSlot) {
        bossSlot.classList.add('cb-veiling');
        setTimeout(() => bossSlot.classList.remove('cb-veiling'), this.app.dur(1400) || 0);
      }
    }
  }

  private onMount(s: GameState): void {
    this.mountedState = s;
    const act = s.run.act === 3 ? 'deep' : s.run.act;
    this.view.sfx.ambience?.(act);
    const c = s.combat!;
    const names = c.enemies.map((e) => this.app.engine.pack.enemies[e.defId]?.name ?? 'A Shade');
    const fresh = c.turn === 1 && c.turnFlags.played === 0;
    if (fresh) appendLog(this.app, [`A new fight: ${names.join(', ')}.`]);
    else {
      // Continue in the middle of a fight: bring back the saved log lines and say where we are.
      this.resumedAt = c.turnFlags.played > 0 ? { turn: c.turn, played: c.turnFlags.played } : null;
      if (!this.app.log.length) restoreLog(this.app);
      appendLog(this.app, [`Resumed: ${names.join(', ')}, turn ${c.turn}.`]);
    }
    // Barks on arrival: each Shade says one of its lines (7.4).
    if (c.turn === 1 && c.turnFlags.played === 0) {
      c.enemies.forEach((e, i) => {
        const line = pickLine(SHADE_LINES[e.defId]?.bark ?? this.app.engine.pack.enemies[e.defId]?.lines.bark ?? [], e.uid);
        if (line) setTimeout(() => this.view.shades.bark(e.uid, line, 2400), 350 + i * 260);
        this.view.barked.add(e.uid);
      });
    }
  }

  private syncSelection(s: GameState): void {
    if (this.sel && this.selState !== s) {
      const inHand = s.combat!.piles.hand.includes(this.sel.card);
      this.sel = inHand ? buildSelection(this.app, s, this.sel.card, this.sel.focus) : null;
      this.selState = s;
    }
  }

  /** Rebuild the model from the current state and UI and render it. */
  private refresh(): void {
    // Focus and pointer events fired by DOM swaps can ask for a refresh mid-render: run it after.
    if (this.refreshing) {
      this.dirty = true;
      return;
    }
    this.refreshing = true;
    try {
      do {
        this.dirty = false;
        this.refreshOnce();
      } while (this.dirty);
    } finally {
      this.refreshing = false;
    }
  }

  private refreshOnce(): void {
    const s = this.app.state;
    if (!s?.combat || this.animating) return;
    this.syncSelection(s);
    const m = buildModel(this.app, s, {
      sel: this.sel,
      hoverCard: this.hoverCard,
      endTurnHover: this.endTurnHover,
      feltCracks: this.view.feltCracks,
      resumed: !!this.resumedAt && s.combat.turn === this.resumedAt.turn && s.combat.turnFlags.played <= this.resumedAt.played,
    });
    this.renderModel(m, true);
    this.lastModel = m;
    // Low Heart (< 30%): one heartbeat as each of your turns begins (18.2); the vignette pulses meanwhile.
    if (m.player.lowHeart && this.heartbeatTurn !== m.turn) {
      this.heartbeatTurn = m.turn;
      this.view.sfx.heartbeat?.();
    }
    this.renderPending(m);
    this.renderThread(m);
    this.renderBreakdown(m);
    this.setPlayLine(arrows(this.message || m.playLine), !!this.message);
    if (this.refocusIndex !== null) {
      const n = this.view.hand.uids().length;
      const card = n ? this.view.hand.cardAt(Math.min(this.refocusIndex, n - 1)) : undefined;
      (card ?? this.view.right.endTurn).focus({ preventScroll: true });
      this.refocusIndex = null;
    }
    this.coach.check(s, m, {
      slot: (uid) => this.view.shades.slot(uid)?.root,
      card: (uid) => this.view.hand.card(uid),
      endTurn: this.view.right.endTurn,
      inward: () => this.view.player.inwardEl(),
      playerChips: this.view.player.chipsEl,
    });
  }

  renderModel(m: CombatModel, dealing: boolean): void {
    const v = this.view;
    v.player.update(m);
    v.shades.update(m.shades);
    v.hand.update(m.hand, m.selected, dealing);
    v.compass.update(m.compass, m.drawCount);
    v.right.update(m, this.app.busy);
    this.canvas.dataset.selecting = m.selected !== null ? 'true' : 'false';
    this.el.style.setProperty('--brighten', String(Math.min(4, m.resolved)));
    v.vignette.classList.toggle('is-low-heart', m.player.lowHeart);
  }

  /** While End Turn is hovered, dotted lines show where each Companion will Ease (its last target). */
  private renderCompanionLines(m: CombatModel): void {
    const s = this.app.state?.combat;
    const target = s?.lastTarget;
    if (!this.endTurnHover || !m.player.companions || m.player.companions.isolated || target == null) return;
    const slot = this.view.shades.slot(target);
    if (!slot) return;
    const to = this.centerOf(slot.svg);
    const els = [...this.view.player.companionsEl.querySelectorAll('.companion-slot[data-action="ease"]')];
    const lines = els
      .map((el) => {
        const a = this.centerOf(el);
        return `<line x1="${a.x}" y1="${a.y}" x2="${to.x}" y2="${to.y}"/>`;
      })
      .join('');
    if (lines) this.threadHost.append(toElement(`<svg class="cb-dotline" width="100%" height="100%" aria-hidden="true">${lines}</svg>`));
  }

  private renderThread(m: CombatModel): void {
    this.threadHost.replaceChildren();
    this.renderCompanionLines(m);
    if (!m.thread) return;
    const a = this.view.hand.card(m.thread.from);
    const b = this.view.hand.card(m.thread.to);
    if (!a || !b) return;
    // Measure after the selected card's lift transition settles.
    requestAnimationFrame(() => {
      const ca = this.centerOf(a);
      const cb = this.centerOf(b);
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      this.threadHost.querySelector('.light-thread')?.remove();
      this.threadHost.append(
        toElement(threadMarkup({ from: [ca.x, ca.y - ra.height * 0.42], to: [cb.x, cb.y - rb.height * 0.42], light: m.thread!.light, lift: 70 })),
      );
    });
  }

  private renderBreakdown(m: CombatModel): void {
    if (!this.shift || !this.sel) return this.breakdown.show(null, '', null);
    const opt = focusedOption(this.sel);
    const key = opt?.key;
    const sh = typeof key === 'number' ? m.shades.find((x) => x.uid === key) : m.shades.find((x) => x.preview);
    const traces = sh?.preview?.trace ?? null;
    const anchor = sh ? this.view.shades.slot(sh.uid)?.root : null;
    const c = anchor ? this.centerOf(anchor) : null;
    const rootW = this.canvas.getBoundingClientRect().width;
    const at = c ? { x: Math.min(c.x + 70, rootW - 260), y: Math.max(60, c.y - 150) } : null;
    this.breakdown.show(traces, sh ? `${m.hand.find((x) => x.uid === this.sel!.card)?.props.name ?? ''} → ${sh.name}` : '', at);
  }

  private renderPending(m: CombatModel): void {
    const p = m.pending;
    this.pendingEl.hidden = !p;
    if (!p) {
      this.pendingEl.replaceChildren();
      return;
    }
    const title = p.purpose === 'tend' ? 'Choose a Buried card to Tend' : 'Choose a card to take into your hand';
    const list = h(
      'div',
      { class: 'cb-pending__list' },
      p.options.map((o, i) => {
        const btn = toElement<HTMLButtonElement>(cardFaceMarkup({ ...o.props, ariaLabel: `${i + 1}. ${o.props.ariaLabel ?? o.props.name}` }));
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          void this.run('other', { t: 'choose', uid: o.uid });
        });
        return h('div', { class: 'cb-pending__opt' }, btn, h('span', { class: 'kbd' }, String((i + 1) % 10)));
      }),
    );
    this.pendingEl.replaceChildren(h('h2', { class: 'cb-pending__title serif' }, title), list);
    fitCards(this.pendingEl);
    if (!this.pendingEl.contains(document.activeElement)) this.pendingEl.querySelector('button')?.focus({ preventScroll: true });
  }

  /** Fast-forward the running animation and run `fn` once the new state is on screen. */
  private queue(fn: () => void): void {
    this.queued = fn;
    this.app.root.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  }

  private say(msg: string): void {
    this.message = msg;
    clearTimeout(this.messageTimer);
    this.messageTimer = window.setTimeout(() => {
      this.message = '';
      this.setPlayLine(arrows(this.lastModel?.playLine ?? ''), false);
    }, 2600);
    this.setPlayLine(msg, true);
  }

  /** Set the Play Line and keep it to one line: step the font down to 12px (the text floor, 19) before a long sentence wraps (max 2 lines). */
  private setPlayLine(text: string, message: boolean): void {
    const el = this.playLine;
    el.dataset.message = message ? 'true' : 'false';
    if (el.textContent === text && el.dataset.fitFor === text) return;
    el.textContent = text;
    el.dataset.fitFor = text;
    el.style.removeProperty('--pl-size');
    el.dataset.lines = '1';
    if (!text || !el.isConnected) return;
    const lines = (): number => {
      const cs = getComputedStyle(el);
      const lh = parseFloat(cs.lineHeight) || 1;
      const inner = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      return Math.round(inner / lh);
    };
    el.dataset.wide = 'false';
    if (lines() > 1) el.style.setProperty('--pl-size', '12');
    // The very longest sentences (two targets, each with a Finish) get a wider strip rather than a third line.
    if (lines() > 2) el.dataset.wide = 'true';
    el.dataset.lines = String(Math.min(2, lines()));
  }

  // ---------------------------------------------------------------------------------------------
  // Selection and targeting

  private selectCard(uid: Uid): void {
    const s = this.app.state;
    if (this.app.busy) return this.queue(() => this.selectCard(uid));
    if (!s?.combat || s.combat.pending) return;
    if (this.sel?.card === uid) {
      if (hasUntargeted(this.sel) && !hasEnemyTargets(this.sel)) {
        const opt = optionFor(this.sel, 'none');
        if (opt) return this.play(opt);
      }
      return this.cancel();
    }
    const sel = buildSelection(this.app, s, uid, this.sel?.focus ?? null);
    if (!sel) {
      const m = this.lastModel?.hand.find((x) => x.uid === uid);
      if (m?.def.buried) this.say(`${m.props.name}: ${m.props.text}`);
      else if (m && m.props.cost !== null && m.props.cost > s.combat.energy) {
        this.say(`Not enough Spirit for ${m.props.name}.`);
        this.view.sfx.ui?.('notEnough');
        const card = this.view.hand.card(uid);
        card?.classList.remove('cb-shake');
        void card?.offsetWidth;
        card?.classList.add('cb-shake');
      } else if (m) this.say(`${m.props.name} can't be played right now.`);
      return;
    }
    this.message = '';
    this.sel = sel;
    this.selState = s;
    this.view.sfx.ui?.('hover');
    this.refresh();
  }

  private cancel(): void {
    if (!this.sel) return;
    this.sel = null;
    this.view.sfx.ui?.('cancel');
    this.refresh();
  }

  private hoverTarget(key: TargetKey): void {
    if (!this.sel || this.sel.focus === key || !optionFor(this.sel, key)) return;
    this.sel.focus = key;
    this.refresh();
  }

  private hoverHand(uid: Uid | null): void {
    if (this.hoverCard === uid) return;
    this.hoverCard = uid;
    this.view.hand.setHover(uid);
    if (uid !== null) this.view.sfx.ui?.('hover');
    this.refresh();
  }

  private target(key: TargetKey): void {
    if (this.app.busy) return;
    if (!this.sel) {
      if (typeof key === 'number') this.say(this.view.shades.slot(key)?.hit.getAttribute('aria-label') ?? '');
      return;
    }
    const opt = optionFor(this.sel, key);
    if (opt) this.play(opt);
    else if (typeof key === 'number') this.say("That card can't reach this Shade.");
  }

  private play(opt: TargetOption): void {
    const idx = this.view.hand.uids().indexOf(this.sel?.card ?? -1);
    this.sel = null;
    this.hoverCard = null;
    this.endTurnHover = false;
    // After a keyboard play, focus moves to the next card (19); a mouse play leaves focus alone.
    this.refocusIndex = this.keyboardMode ? Math.max(0, idx) : null;
    this.view.sfx.ui?.('play');
    this.run('play', opt.action);
  }

  /** Dispatch an action and remember what kind of step is animating until it settles. */
  private run(kind: 'endTurn' | 'play' | 'other', a: Parameters<App['dispatch']>[0]): Promise<void> {
    this.inFlight = kind;
    return this.app.dispatch(a).finally(() => {
      if (this.inFlight === kind) this.inFlight = null;
    });
  }

  private stageClick(e: MouseEvent): void {
    if (!this.sel || this.app.busy) return;
    const t = e.target as Element;
    if (t.closest('button, .has-tip, .cb-card')) return;
    const none = optionFor(this.sel, 'none');
    if (none && !hasEnemyTargets(this.sel)) this.play(none);
    else this.cancel();
  }

  private contextMenu(e: MouseEvent): void {
    if (this.sel) {
      e.preventDefault();
      this.cancel();
    }
  }

  /**
   * End Turn. Pressed during the Shades' phase it only fast-forwards (never ends the next turn too); pressed
   * during a card's animation it runs once that settles, but only if it is still that same turn. A short
   * debounce after each use swallows double-clicks and key repeat.
   */
  private endTurn(queued = false): void {
    const now = performance.now();
    if (!queued) {
      // A burst of presses is one intent: each press inside the window extends it.
      const burst = now - this.endTurnPressAt < 500;
      this.endTurnPressAt = now;
      if (burst || now < this.endTurnReadyAt) return;
    }
    if (this.app.busy) {
      if (this.inFlight === 'endTurn') return;
      const turn = this.app.state?.combat?.turn;
      this.queue(() => {
        if (this.app.state?.combat?.turn === turn) this.endTurn(true);
      });
      return;
    }
    if (!this.app.isLegal({ t: 'endTurn' })) return;
    this.sel = null;
    this.endTurnHover = false;
    this.view.sfx.ui?.('confirm');
    this.endTurnReadyAt = now + 500;
    void this.run('endTurn', { t: 'endTurn' }).then(() => {
      this.endTurnReadyAt = Math.max(this.endTurnReadyAt, performance.now() + 350);
    });
  }

  private undo(): void {
    if (this.app.canUndo()) {
      this.sel = null;
      this.view.sfx.ui?.('cancel');
      this.app.undo();
    } else {
      this.say(this.lastModel?.undoReason ?? 'Nothing to undo.');
      this.view.sfx.ui?.('notEnough');
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Keyboard (19)

  onKey(e: KeyboardEvent, app: App): boolean {
    const s = app.state;
    if (!s?.combat) return false;
    if ((e.key === 'e' || e.key === 'E') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Held E (key repeat) never ends more than one turn; during the Shades' phase E only fast-forwards.
      if (e.repeat) return true;
      if (app.busy && this.inFlight === 'endTurn') this.app.root.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      if (!s.combat.pending) this.endTurn();
      return true;
    }
    if (app.busy) {
      // Card and undo keys pressed during an animation skip it and then act.
      if (/^[0-9zZ]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const key = e.key;
        this.queue(() => this.onKey(new KeyboardEvent('keydown', { key }), app));
        return true;
      }
      return false;
    }
    const c = s.combat;
    if (e.key === 'Shift') {
      if (!this.shift) {
        this.shift = true;
        this.refresh();
      }
      return false;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    this.keyboardMode = true;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;

    if (c.pending) {
      const n = /^[0-9]$/.test(k) ? (Number(k) + 9) % 10 : -1;
      const opt = n >= 0 ? c.pending.options[n] : undefined;
      if (opt !== undefined) {
        void this.run('other', { t: 'choose', uid: opt });
        return true;
      }
      return false;
    }

    if (/^[0-9]$/.test(k)) {
      const i = (Number(k) + 9) % 10;
      const uid = this.view.hand.uids()[i];
      if (uid === undefined) return true;
      this.region = 'hand';
      this.selectCard(uid);
      this.view.hand.card(uid)?.focus({ preventScroll: true });
      return true;
    }
    switch (k) {
      case 'ArrowLeft':
      case 'ArrowRight': {
        const dir = k === 'ArrowLeft' ? -1 : 1;
        if (this.sel) {
          this.sel.focus = cycleFocus(this.sel, dir);
          this.refresh();
          this.focusTargetEl(this.sel.focus);
        } else if (this.region === 'shades') {
          const slots = this.view.shades.all();
          if (slots.length) {
            this.shadeFocus = (this.shadeFocus + dir + slots.length) % slots.length;
            slots[this.shadeFocus]!.hit.focus({ preventScroll: true });
          }
        } else {
          const uids = this.view.hand.uids();
          if (!uids.length) return true;
          const cur = uids.findIndex((u) => this.view.hand.card(u) === document.activeElement);
          const next = cur < 0 ? (dir > 0 ? 0 : uids.length - 1) : (cur + dir + uids.length) % uids.length;
          this.view.hand.cardAt(next)?.focus({ preventScroll: true });
        }
        return true;
      }
      case 'ArrowUp':
      case 'ArrowDown': {
        if (this.sel) {
          if (k === 'ArrowDown') this.view.hand.card(this.sel.card)?.focus({ preventScroll: true });
          else this.focusTargetEl(this.sel.focus);
          return true;
        }
        this.region = k === 'ArrowUp' ? 'shades' : 'hand';
        if (this.region === 'shades') {
          const slots = this.view.shades.all();
          slots[Math.min(this.shadeFocus, slots.length - 1)]?.hit.focus({ preventScroll: true });
        } else (this.view.hand.cardAt(0) ?? this.view.right.endTurn).focus({ preventScroll: true });
        return true;
      }
      case 'Enter':
      case ' ': {
        const active = document.activeElement;
        if (this.sel) {
          const onOther = active instanceof HTMLButtonElement && !active.closest('.cb-card, .cb-slot, .inward-target');
          if (onOther) return false;
          const opt = focusedOption(this.sel);
          if (opt) this.play(opt);
          return true;
        }
        const card = active?.closest('.cb-card') as HTMLElement | null;
        if (card?.dataset.uid) {
          this.selectCard(Number(card.dataset.uid));
          return true;
        }
        return false;
      }
      case 'Escape':
        if (this.sel) {
          const card = this.sel.card;
          this.cancel();
          this.view.hand.card(card)?.focus({ preventScroll: true });
          return true;
        }
        return false;
      case 'z':
        this.undo();
        return true;
      case 'd':
        app.openOverlay('draw');
        return true;
      case 'f':
        app.openOverlay('discard');
        return true;
      case 'l':
        app.openOverlay('log');
        return true;
      default:
        return false;
    }
  }

  private focusTargetEl(key: TargetKey): void {
    if (key === 'inward') this.view.player.inwardEl()?.focus({ preventScroll: true });
    else if (typeof key === 'number') this.view.shades.slot(key)?.hit.focus({ preventScroll: true });
    else if (this.sel) this.view.hand.card(this.sel.card)?.focus({ preventScroll: true });
  }

  // ---------------------------------------------------------------------------------------------
  // Animation

  async animate(events: GameEvent[], prev: GameState, next: GameState, app: App): Promise<void> {
    this.animating = true;
    this.sel = null;
    this.hoverCard = null;
    this.endTurnHover = false;
    this.breakdown.show(null, '', null);
    this.threadHost.replaceChildren();
    this.message = '';
    this.setPlayLine('', false);
    try {
      await animateCombat(this.view, events, prev, next, app);
    } finally {
      this.animating = false;
    }
  }
}
