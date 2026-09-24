// Bottom-band controls (DESIGN 16.1, 16.2): the Compass HUD with the draw pile, and the right column with
// End Turn, Undo, the discard pile and the log.

import { h } from '../../dom';
import { renderCompass, type CompassProps } from '../../kit/compass';
import { markIcon } from '../../kit/sigils';
import type { CombatModel } from './model';

export interface ControlHandlers {
  onEndTurn(): void;
  onEndTurnHover(on: boolean): void;
  onUndo(): void;
  onDraw(): void;
  onDiscard(): void;
  onLog(): void;
}

const kbd = (k: string): HTMLElement => h('span', { class: 'kbd', attrs: { 'aria-hidden': 'true' } }, k);

function pileButton(kind: 'draw' | 'discard', key: string, onClick: () => void): { btn: HTMLButtonElement; count: HTMLElement } {
  const count = h('b', { class: 'cb-pile__n num' }, '0');
  const btn = h(
    'button',
    { class: `cb-pile cb-pile--${kind}`, type: 'button', on: { click: (e) => (e.stopPropagation(), onClick()) } },
    h('span', { class: 'cb-pile__stack', html: markIcon(kind), attrs: { 'aria-hidden': 'true' } }),
    count,
    h('span', { class: 'cb-pile__label caps' }, kind === 'draw' ? 'Draw' : 'Discard'),
    kbd(key),
  );
  return { btn, count };
}

export class CompassView {
  readonly el: HTMLElement;
  readonly draw: { btn: HTMLButtonElement; count: HTMLElement };
  private readonly host: HTMLElement;
  private sig = '';
  private enabled: boolean | null = null;

  constructor(handlers: ControlHandlers) {
    this.host = h('div', { class: 'cb-compass__ring' });
    this.draw = pileButton('draw', 'D', handlers.onDraw);
    this.el = h('div', { class: 'cb-compass' }, this.host, this.draw.btn);
  }

  hud(): HTMLElement | null {
    return this.host.querySelector('.compass-hud');
  }

  update(p: CompassProps, drawCount: number, extra: Partial<CompassProps> = {}): void {
    const props: CompassProps = { ...p, ...extra, size: 'calc(var(--u) * 172)' };
    // The ring grows out of the orb the first time The Compass shows up in this fight.
    if (this.enabled === false && props.enabled) props.granting = true;
    const sig = JSON.stringify(props);
    if (sig !== this.sig) {
      this.host.replaceChildren(renderCompass(props));
      this.sig = sig;
    }
    this.enabled = props.enabled;
    this.draw.count.textContent = String(drawCount);
    this.draw.btn.setAttribute('aria-label', `Draw pile, ${drawCount} card${drawCount === 1 ? '' : 's'}. Press D to look.`);
  }

  /** "HARMONY" pops beside the Compass (18.1). */
  harmonyPop(ms: number): void {
    const hud = this.hud();
    if (!hud) return;
    hud.classList.remove('is-harmony');
    void hud.offsetWidth;
    hud.classList.add('is-harmony');
    setTimeout(() => hud.classList.remove('is-harmony'), Math.max(ms, 400));
  }

  /** Friendship blows the Isolated fog away. */
  clearFog(): void {
    this.hud()?.classList.add('is-fog-clearing');
  }
}

export class RightColumn {
  readonly el: HTMLElement;
  readonly endTurn: HTMLButtonElement;
  readonly undo: HTMLButtonElement;
  readonly discard: { btn: HTMLButtonElement; count: HTMLElement };
  private readonly endSub: HTMLElement;
  private readonly turnEl: HTMLElement;
  private readonly undoTip: HTMLElement;

  constructor(hs: ControlHandlers) {
    this.endSub = h('span', { class: 'btn__sub' });
    this.endTurn = h(
      'button',
      {
        class: 'btn btn--primary btn--stack cb-endturn',
        type: 'button',
        on: {
          click: (e) => (e.stopPropagation(), hs.onEndTurn()),
          pointerenter: () => hs.onEndTurnHover(true),
          pointerleave: () => hs.onEndTurnHover(false),
          focus: () => hs.onEndTurnHover(true),
          blur: () => hs.onEndTurnHover(false),
        },
      },
      h('span', { class: 'cb-endturn__main' }, 'End Turn ', kbd('E')),
      this.endSub,
    );
    this.turnEl = h('div', { class: 'cb-turn num', attrs: { 'aria-live': 'polite' } });
    this.undoTip = h('span', { class: 'cb-undo__tip', attrs: { role: 'tooltip' } });
    this.undo = h(
      'button',
      { class: 'btn cb-undo', type: 'button', on: { click: (e) => (e.stopPropagation(), hs.onUndo()) } },
      h('span', { html: markIcon('undo'), attrs: { 'aria-hidden': 'true' } }),
      'Undo ',
      kbd('Z'),
      this.undoTip,
    );
    this.discard = pileButton('discard', 'F', hs.onDiscard);
    const log = h(
      'button',
      { class: 'btn cb-log', type: 'button', attrs: { 'aria-label': 'Log (L)' }, on: { click: (e) => (e.stopPropagation(), hs.onLog()) } },
      h('span', { html: markIcon('log'), attrs: { 'aria-hidden': 'true' } }),
      'Log ',
      kbd('L'),
    );
    this.el = h('div', { class: 'cb-right' }, this.turnEl, this.endTurn, this.undo, h('div', { class: 'cb-right__row' }, this.discard.btn, log));
  }

  update(m: CombatModel, busy: boolean): void {
    const sub = m.spiritUnused > 0 ? `${m.spiritUnused} Spirit unused` : '';
    this.endSub.textContent = sub;
    this.endSub.hidden = !sub;
    this.endTurn.classList.toggle('btn--pulse', m.nothingPlayable && !busy);
    this.endTurn.setAttribute('aria-label', `End Turn (E).${sub ? ` ${sub}.` : ''} ${m.player.incoming}`);
    this.endTurn.toggleAttribute('disabled', !!m.pending);
    const late = m.turn >= m.turnLimit - 10;
    this.turnEl.textContent = late ? `Turn ${m.turn}/${m.turnLimit}` : '';
    this.turnEl.hidden = !late;
    this.undo.setAttribute('aria-disabled', String(!m.canUndo));
    this.undo.setAttribute('aria-label', m.canUndo ? 'Undo (Z): take back the last card you played.' : `Undo unavailable: ${m.undoReason}`);
    this.undoTip.textContent = m.undoReason;
    this.discard.count.textContent = String(m.discardCount);
    this.discard.btn.setAttribute('aria-label', `Discard pile, ${m.discardCount} card${m.discardCount === 1 ? '' : 's'}. Press F to look.`);
  }
}
