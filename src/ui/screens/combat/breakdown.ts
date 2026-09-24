// Math breakdown (DESIGN 19, held Shift): the engine's HitBreakdown.trace rows for the focused target.

import { h } from '../../dom';

export class Breakdown {
  readonly el: HTMLElement;
  private sig = '';

  constructor() {
    this.el = h('div', { class: 'cb-breakdown', attrs: { role: 'region', 'aria-label': 'Math breakdown', 'aria-live': 'polite' } });
    this.el.hidden = true;
  }

  /** Show trace rows (one block per hit) near an anchor rect (px inside the screen), or hide with null. */
  show(traces: { label: string; value: string }[][] | null, title: string, at: { x: number; y: number } | null): void {
    if (!traces || !traces.length || !at) {
      this.el.hidden = true;
      this.sig = '';
      return;
    }
    const sig = JSON.stringify([traces, title]);
    if (sig !== this.sig) {
      const blocks = traces.map((rows, i) =>
        h(
          'dl',
          { class: 'cb-breakdown__hit' },
          traces.length > 1 ? h('dt', { class: 'cb-breakdown__n' }, `Hit ${i + 1}`) : null,
          rows.flatMap((r) => [
            h('dt', { class: r.label === '=' ? 'is-total' : '' }, r.label === '=' ? '' : r.label.replace(/->/g, '→')),
            h('dd', { class: `num${r.label === '=' ? ' is-total' : ''}` }, `${r.label === '=' ? '= ' : ''}${r.value.replace(/->/g, '→')}`),
          ]),
        ),
      );
      this.el.replaceChildren(h('div', { class: 'cb-breakdown__title caps' }, title), ...blocks);
      this.sig = sig;
    }
    this.el.hidden = false;
    this.el.style.left = `${at.x}px`;
    this.el.style.top = `${at.y}px`;
  }
}
