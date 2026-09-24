// The Shade row (DESIGN 16.1, 16.2): one 205px slot per Shade, keyed by uid and updated in place so hover,
// focus and running animations survive re-renders.

import type { Uid } from '../../../engine/types';
import { h } from '../../dom';
import { barkMarkup, promiseChipMarkup, waveringChipMarkup } from '../../kit/callouts';
import { renderShade, setShadeFace, setShadeGauge, setShadeReaction } from '../../kit/shadeArt';
import { toElement } from '../../kit/svg';
import { intentPillMarkup, nameplateMarkup, setBarValue } from '../../kit/widgets';
import { SHADE_NAME } from '../../kit/names';
import type { ShadeModel } from './model';
import { previewOverlayMarkup } from './previewOverlay';
import { intentItems, intentTitle } from './text';

export interface SlotView {
  uid: Uid;
  root: HTMLElement;
  art: HTMLElement;
  svg: SVGSVGElement;
  hit: HTMLButtonElement;
  intent: HTMLElement;
  plate: HTMLElement;
  overlay: HTMLElement;
  feet: HTMLElement;
  bark: HTMLElement;
  /** Render signatures, so unchanged parts are left alone. */
  sig: { art: string; face: string; gauge: string; reaction: string; pill: string; plate: string; hp: string; overlay: string; feet: string; label: string };
  model: ShadeModel;
}

export interface ShadeRowHandlers {
  onTarget(uid: Uid): void;
  onHover(uid: Uid | null): void;
}

function slotLabel(m: ShadeModel): string {
  const type = m.face ? SHADE_NAME[m.face] : 'Numb';
  const bits = [`${m.name}, ${type}. Intensity ${m.hp} of ${m.maxHp}.`];
  if (m.guard > 0) bits.push(`Guard ${m.guard}.`);
  if (m.beneath) bits.push(`Beneath: ${SHADE_NAME[m.beneath]}.`);
  if (m.intent) bits.push(`Next: ${intentTitle(m.intent)}`);
  for (const ch of m.chips) bits.push(`${ch.title ?? ch.label + (ch.value !== undefined ? ` ${ch.value}` : '')}`);
  if (m.wavering) bits.push('Wavering: finish it yourself.');
  if (m.preview?.banner) bits.push(`Preview: ${m.preview.banner.kind === 'deepResolve' ? 'DEEP RESOLVE' : m.preview.banner.kind.toUpperCase()}.`);
  else if (m.preview?.callout) bits.push(`Preview: minus ${m.preview.callout.amount}, ${m.preview.callout.label}.`);
  return bits.join(' ');
}

export class ShadeRow {
  readonly el: HTMLElement;
  private slots = new Map<Uid, SlotView>();

  constructor(private readonly handlers: ShadeRowHandlers) {
    this.el = h('div', { class: 'cb-shades', attrs: { role: 'group', 'aria-label': 'Shades' } });
  }

  slot(uid: Uid): SlotView | undefined {
    return this.slots.get(uid);
  }

  all(): SlotView[] {
    return [...this.slots.values()];
  }

  /** Remove a slot at once (its leave animation plays on a detached copy). */
  drop(uid: Uid): void {
    this.slots.get(uid)?.root.remove();
    this.slots.delete(uid);
  }

  update(models: readonly ShadeModel[]): void {
    const keep = new Set(models.map((m) => m.uid));
    for (const [uid, v] of this.slots) {
      if (!keep.has(uid)) {
        v.root.remove();
        this.slots.delete(uid);
      }
    }
    const anger = models.filter((m) => m.family === 'anger').length;
    this.el.dataset.count = String(models.length);
    models.forEach((m, i) => {
      let v = this.slots.get(m.uid);
      if (!v) {
        v = this.create(m);
        this.slots.set(m.uid, v);
      }
      this.patch(v, m, anger > 1);
      if (this.el.children[i] !== v.root) this.el.insertBefore(v.root, this.el.children[i] ?? null);
    });
    // Roving focus (19): one Shade is a Tab stop (the focused target, else the first).
    const active = models.find((m) => this.slots.get(m.uid)?.hit === document.activeElement);
    const current = active?.uid ?? models.find((m) => m.focused)?.uid ?? models[0]?.uid;
    for (const v of this.slots.values()) v.hit.tabIndex = v.uid === current ? 0 : -1;
  }

  private create(m: ShadeModel): SlotView {
    const intent = h('div', { class: 'shade-slot__intent' });
    const overlay = h('div', { class: 'cb-slot__overlay' });
    const feet = h('div', { class: 'shade-slot__feet' });
    const bark = h('div', { class: 'cb-slot__bark' });
    const svg = renderShade({ family: m.family, seed: m.uid, face: m.face });
    const art = h('div', { class: 'shade-slot__art' }, svg, feet, bark, overlay);
    const plate = h('div', { class: 'cb-slot__plate' });
    const hit = h('button', { class: 'cb-slot__hit', type: 'button' });
    // The target button comes first so Tab reaches the Shade before its chips.
    const root = h('div', { class: 'shade-slot cb-slot', dataset: { uid: String(m.uid) } }, hit, intent, art, plate);
    const uid = m.uid;
    hit.addEventListener('click', () => this.handlers.onTarget(uid));
    root.addEventListener('pointerenter', () => this.handlers.onHover(uid));
    root.addEventListener('pointerleave', () => this.handlers.onHover(null));
    root.addEventListener('click', (e) => {
      if (e.target === hit || (e.target as Element).closest('.has-tip, .chip--more')) return;
      this.handlers.onTarget(uid);
    });
    hit.addEventListener('focus', () => {
      for (const v of this.slots.values()) v.hit.tabIndex = v.uid === uid ? 0 : -1;
      this.handlers.onHover(uid);
    });
    return {
      uid,
      root,
      art,
      svg,
      hit,
      intent,
      plate,
      overlay,
      feet,
      bark,
      sig: { art: '', face: '', gauge: '', reaction: '', pill: '', plate: '', hp: '', overlay: '', feet: '', label: '' },
      model: m,
    };
  }

  private patch(v: SlotView, m: ShadeModel, manyAnger: boolean): void {
    v.model = m;
    const root = v.root;
    root.dataset.face = m.face ?? 'none';
    root.classList.toggle('shade-slot--tall', m.tall);
    root.dataset.targetable = String(m.targetable);
    root.dataset.focused = String(m.focused);
    root.dataset.previewing = m.preview ? 'true' : 'false';

    // Silhouette: geometry depends on family, Flare and felt cracks; face and gauge update in place.
    const artSig = JSON.stringify([m.family, m.flare, m.ornament, m.innerFace, m.feltCracks, m.scale, manyAnger, m.name]);
    if (artSig !== v.sig.art) {
      const svg = renderShade({
        family: m.family,
        seed: m.uid,
        face: m.face,
        innerFace: m.innerFace,
        nextFace: m.nextFace,
        flare: m.flare,
        scale: m.scale,
        ornament: m.ornament,
        ...(m.gauge !== undefined ? { gauge: m.gauge } : {}),
        ...(m.ornament === 'mask' ? { faces: m.def.faces } : {}),
        feltCracks: m.feltCracks,
        slouched: m.ornament === 'apathy',
        shimmer: !manyAnger,
        label: `${m.name}, ${m.face ? SHADE_NAME[m.face] : 'Numb'}`,
      });
      v.svg.replaceWith(svg);
      v.svg = svg;
      v.sig.art = artSig;
      v.sig.face = String(m.face);
      v.sig.gauge = String(m.gauge);
      v.sig.reaction = '';
    }
    if (String(m.face) !== v.sig.face && m.face) {
      setShadeFace(v.svg, m.face, m.nextFace);
      v.sig.face = String(m.face);
    }
    if (String(m.gauge) !== v.sig.gauge && m.gauge !== undefined) {
      setShadeGauge(v.svg, m.gauge);
      v.sig.gauge = String(m.gauge);
    }
    if (String(m.reaction) !== v.sig.reaction) {
      setShadeReaction(v.svg, m.reaction);
      v.sig.reaction = String(m.reaction);
    }

    // Intent pill (+ "-> 9" when the selected card changes the next move).
    const pillSig = JSON.stringify([m.intent, m.order]);
    if (pillSig !== v.sig.pill) {
      v.intent.innerHTML = m.intent
        ? intentPillMarkup({
            items: intentItems(m.intent),
            ...(m.order ? { order: m.order } : {}),
            projected: m.intent.projected,
            title: intentTitle(m.intent),
          })
        : '';
      v.sig.pill = pillSig;
    }

    // Nameplate: full re-render unless only the Intensity changed (then the bar's lag chunk drains).
    const plateSig = JSON.stringify([m.face, m.name, m.beneath, m.nextFace, m.maxHp, m.guard, m.preview?.loss, m.preview?.guardAfter, m.matchups, m.chips]);
    const hpSig = `${m.hp}/${m.maxHp}`;
    if (plateSig !== v.sig.plate) {
      v.plate.innerHTML = nameplateMarkup({
        face: m.face,
        name: m.name,
        beneath: m.beneath,
        nextFace: m.nextFace,
        hp: m.hp,
        maxHp: m.maxHp,
        guard: m.guard,
        ...(m.preview && m.preview.loss > 0 ? { previewLoss: m.preview.loss } : {}),
        matchups: m.matchups,
        chips: m.chips,
      });
      v.sig.plate = plateSig;
      v.sig.hp = hpSig;
    } else if (hpSig !== v.sig.hp) {
      const bar = v.plate.querySelector<HTMLElement>('.bar--intensity');
      if (bar) setBarValue(bar, m.hp, m.maxHp);
      v.sig.hp = hpSig;
    }

    const overlaySig = JSON.stringify(m.preview ? [m.preview.banner, m.preview.callout, m.preview.intentAfter?.moveId, m.preview.intentAfter?.strikes, m.intent?.strikes] : null);
    if (overlaySig !== v.sig.overlay) {
      v.overlay.innerHTML = previewOverlayMarkup(m);
      v.sig.overlay = overlaySig;
    }

    const feetSig = JSON.stringify([m.wavering, m.promises]);
    if (feetSig !== v.sig.feet) {
      v.feet.innerHTML =
        (m.wavering ? waveringChipMarkup() : '') + m.promises.map((p) => promiseChipMarkup({ text: p.text, lights: p.lights })).join('');
      v.sig.feet = feetSig;
    }

    const label = slotLabel(m);
    if (label !== v.sig.label) {
      v.hit.setAttribute('aria-label', m.targetable ? `Target ${label}` : label);
      v.sig.label = label;
    }
    v.hit.dataset.targetable = String(m.targetable);
  }

  /** Show a speech bubble over a Shade for a moment (barks and farewells). */
  bark(uid: Uid, text: string, ms: number, farewell = false): void {
    const v = this.slots.get(uid);
    if (!v) return;
    const el = toElement<HTMLElement>(barkMarkup({ text, farewell }));
    v.bark.replaceChildren(el);
    setTimeout(() => el.remove(), ms);
  }
}
