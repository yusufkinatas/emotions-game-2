// The player panel (DESIGN 16.2): the Wanderer with the Note-coloured lantern, the Guard bubble, the Heart
// bar with the predicted-loss hatch, the Incoming line, afflictions, Companions, the Promise tray and the
// INWARD heart target.

import { h } from '../../dom';
import { companionSlotsMarkup, incomingLineMarkup, inwardTargetMarkup, promiseTrayMarkup, wandererMarkup } from '../../kit/player';
import { toElement } from '../../kit/svg';
import { barMarkup, chipRowMarkup, guardBadgeMarkup, guardBubbleMarkup, setBarValue } from '../../kit/widgets';
import type { CombatModel } from './model';

export interface PlayerHandlers {
  onInward(): void;
  onInwardHover(on: boolean): void;
}

export class PlayerPanel {
  readonly el: HTMLElement;
  readonly avatar: HTMLElement;
  readonly heartRow: HTMLElement;
  readonly chipsEl: HTMLElement;
  readonly companionsEl: HTMLElement;
  private readonly bubbleHost: HTMLElement;
  private readonly wandererHost: HTMLElement;
  private readonly inwardHost: HTMLElement;
  private readonly incomingEl: HTMLElement;
  private readonly promiseEl: HTMLElement;
  private sig = { wanderer: '', bubble: '', heart: '', hp: '', incoming: '', chips: '', comp: '', promise: '', inward: '' };

  constructor(private readonly handlers: PlayerHandlers) {
    this.bubbleHost = h('div', { class: 'cb-avatar__bubble' });
    this.wandererHost = h('div', { class: 'cb-avatar__wanderer' });
    this.inwardHost = h('div', { class: 'cb-avatar__inward' });
    this.avatar = h('div', { class: 'cb-avatar' }, this.bubbleHost, this.wandererHost, this.inwardHost);
    this.companionsEl = h('div', { class: 'cb-player__companions' });
    this.heartRow = h('div', { class: 'cb-player__heart' });
    this.incomingEl = h('div', { class: 'cb-player__incoming' });
    this.chipsEl = h('div', { class: 'cb-player__chips', attrs: { 'aria-label': 'Your feelings', role: 'group' } });
    this.promiseEl = h('div', { class: 'cb-player__promises' });
    this.el = h(
      'section',
      { class: 'cb-player', attrs: { 'aria-label': 'You' } },
      this.avatar,
      this.companionsEl,
      this.heartRow,
      this.incomingEl,
      this.chipsEl,
      this.promiseEl,
    );
  }

  /** The Wanderer's SVG (for the Inward fly and the hit flicker). */
  wanderer(): SVGSVGElement | null {
    return this.wandererHost.querySelector('svg.wanderer');
  }

  heartBar(): HTMLElement | null {
    return this.heartRow.querySelector('.bar--heart');
  }

  bubble(): SVGSVGElement | null {
    return this.bubbleHost.querySelector('svg.guard-bubble');
  }

  inwardEl(): HTMLElement | null {
    return this.inwardHost.querySelector('.inward-target');
  }

  update(m: CombatModel): void {
    const p = m.player;
    const wSig = JSON.stringify([p.note, p.compass]);
    if (wSig !== this.sig.wanderer) {
      this.wandererHost.innerHTML = wandererMarkup({ note: p.note, compass: p.compass, size: 'calc(var(--u) * 160)' });
      this.sig.wanderer = wSig;
    }

    const bSig = p.guard > 0 ? 'on' : 'off';
    if (bSig !== this.sig.bubble) {
      this.bubbleHost.innerHTML = p.guard > 0 ? guardBubbleMarkup({ size: 'calc(var(--u) * 178)' }) : '';
      this.sig.bubble = bSig;
    }

    const heartSig = JSON.stringify([p.maxHp, p.guard, p.guardAfter, p.previewLoss, p.previewGain, p.lethal]);
    const hpSig = `${p.hp}/${p.maxHp}`;
    if (heartSig !== this.sig.heart) {
      const guardTip = `Guard ${p.guard}: blocks Shade strikes until your next turn.`;
      this.heartRow.innerHTML =
        guardBadgeMarkup(p.guard, { reserve: true, title: guardTip, ...(p.guardAfter !== null ? { after: p.guardAfter } : {}) }) +
        barMarkup({
          kind: 'heart',
          value: p.hp,
          max: p.maxHp,
          ...(p.previewLoss > 0 ? { previewLoss: p.previewLoss } : {}),
          ...(p.previewGain > 0 ? { previewGain: p.previewGain } : {}),
          lethal: p.lethal,
        }) +
        (p.previewGain > 0 ? `<span class="cb-heart__gain num">+${p.previewGain}</span>` : '');
      this.sig.heart = heartSig;
      this.sig.hp = hpSig;
    } else if (hpSig !== this.sig.hp) {
      const bar = this.heartBar();
      if (bar) setBarValue(bar, p.hp, p.maxHp);
      this.sig.hp = hpSig;
    }

    const incSig = `${p.incoming}|${p.lethal}`;
    if (incSig !== this.sig.incoming) {
      this.incomingEl.innerHTML = incomingLineMarkup({ text: p.incoming, lethal: p.lethal });
      this.sig.incoming = incSig;
    }

    const chipSig = JSON.stringify(p.chips);
    if (chipSig !== this.sig.chips) {
      this.chipsEl.innerHTML = p.chips.length ? chipRowMarkup(p.chips, 4) : '';
      this.sig.chips = chipSig;
    }

    const compSig = JSON.stringify(p.companions);
    if (compSig !== this.sig.comp) {
      this.companionsEl.innerHTML = p.companions ? companionSlotsMarkup(p.companions) : '';
      this.sig.comp = compSig;
    }

    const promSig = JSON.stringify(p.promises);
    if (promSig !== this.sig.promise) {
      this.promiseEl.innerHTML = promiseTrayMarkup(p.promises);
      this.sig.promise = promSig;
    }

    const inSig = JSON.stringify(m.inward);
    if (inSig !== this.sig.inward) {
      const hadFocus = this.inwardHost.contains(document.activeElement);
      this.inwardHost.replaceChildren();
      if (m.inward) {
        const btn = toElement<HTMLButtonElement>(inwardTargetMarkup({ preview: m.inward.text, focused: m.inward.focused, size: 'calc(var(--u) * 212)', tag: 'button' }));
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.handlers.onInward();
        });
        btn.addEventListener('pointerenter', () => this.handlers.onInwardHover(true));
        btn.addEventListener('focus', () => this.handlers.onInwardHover(true));
        this.inwardHost.append(btn);
        if (hadFocus) btn.focus();
      }
      this.sig.inward = inSig;
    }
    this.el.dataset.inward = m.inward ? 'true' : 'false';
  }
}
