// Reward screen (DESIGN 16.5, 12): outcome strip, Glimmers count-up (already added by the engine), The
// Compass with a short ring demo, Keepsakes, the card choice with wheel lines and a Light Mix "+1" ghost,
// Skip (S) and Continue (Enter). Boss rewards reuse it with a rare card choice and a Keepsake choice.

import type { CardDef, GameState, GoneEnemy, RewardOffer } from '../../engine/index';
import { COACH_MARKS } from '../../content/index';
import { cureOf, LIGHTS } from '../../engine/index';
import type { App, ScreenController } from '../app';
import { h, replaceChildren } from '../dom';
import { fitCards } from '../kit/cardFace';
import { renderCompass } from '../kit/compass';
import { resolvedFormMarkup } from '../kit/shadeArt';
import { markIcon, resourceIcon } from '../kit/sigils';
import { createTopBar } from '../components/topBar';
import { cardChoiceRow, cardMarkup } from '../components/cards';
import { focusedControl, arrowFocus, lightMixFor } from '../components/cardGrid';
import { keepsakeFace } from '../components/keepsakes';
import { audioOf, fadeIn, uiSound } from '../components/titleCard';
import '../styles/screens.css';

const TITLES: Record<RewardOffer['source'], string> = {
  fight: 'Rewards',
  elite: 'Rewards',
  boss: 'Boss rewards',
  chest: 'A Chest',
  event: 'Rewards',
};

function outcomeTile(app: App, s: GameState, g: GoneEnemy, i: number): HTMLElement | null {
  const def = app.engine.pack.enemies[g.defId];
  if (!def || def.fleeting || g.outcome === 'fade' || g.outcome === 'wavering') return null;
  const name = def.name;
  const tile = h('div', { class: ['outcome-tile', `outcome-tile--${g.outcome}`], style: { '--i': String(i) } as Record<string, string> });
  if (g.outcome === 'resolve' || g.outcome === 'deepResolve') {
    const deep = g.outcome === 'deepResolve';
    const faces = deep ? def.faces.slice(0, 2) : g.face ? [g.face] : [];
    const forms = faces.length
      ? faces.map((f) => resolvedFormMarkup(cureOf(f), { size: 'calc(var(--u) * 40)' })).join('')
      : markIcon('sunburst');
    tile.append(
      h('div', { class: 'outcome-tile__art', html: forms, dataset: faces[0] ? { light: cureOf(faces[0]) } : {} }),
      h('span', { class: 'outcome-tile__word caps' }, deep ? 'Deep Resolved' : 'Resolved'),
      h('span', { class: 'outcome-tile__name' }, name),
    );
    tile.setAttribute('aria-label', `${name}: ${deep ? 'Deep Resolved' : 'Resolved'}`);
    return tile;
  }
  // Suppressed: a sealed ink tile. A normal Shade's face is now a Buried card in the deck.
  const buriedCard =
    g.face && def.tier !== 'surfaced'
      ? s.run.deck.find((c) => app.engine.pack.cards[c.defId]?.buried?.shade === g.face)
      : undefined;
  const tip = buriedCard
    ? `${name} was Suppressed. ${app.engine.pack.cards[buriedCard.defId]?.name ?? 'Buried'} (Weight ${buriedCard.weight ?? 1}): ${app.engine.describeCard(buriedCard.defId, buriedCard.upgraded, buriedCard.weight)}`
    : `${name} was Suppressed.`;
  tile.classList.add('has-tip');
  tile.setAttribute('tabindex', '0');
  tile.dataset.tip = tip;
  tile.setAttribute('aria-label', tip);
  if (g.face) tile.dataset.face = g.face;
  tile.append(
    h(
      'div',
      { class: 'outcome-tile__art outcome-tile__seal' },
      h('span', { class: 'outcome-tile__sealmark', html: markIcon('seal') }),
      buriedCard ? h('span', { class: 'outcome-tile__mini', html: cardMarkup(app.engine, { defId: buriedCard.defId, upgraded: false, weight: buriedCard.weight }, { className: 'card-face--mini' }) }) : null,
    ),
    h('span', { class: 'outcome-tile__word caps' }, 'Suppressed'),
    h('span', { class: 'outcome-tile__name' }, name),
  );
  return tile;
}

export function rewardScreen(app: App): ScreenController {
  const top = createTopBar(app);
  const title = h('h1', { class: 'screen__title reward-title' });
  const strip = h('div', { class: 'outcome-strip', attrs: { 'aria-label': 'How the Shades left' } });
  const stack = h('div', { class: 'reward-stack' });
  const cardsHead = h('h2', { class: 'eyebrow reward-cards-head' });
  const cardsHost = h('div', { class: 'reward-cards' });
  const mixHost = h('div', { class: 'reward-mix' });
  const notice = h('p', { class: 'reward-notice', attrs: { 'aria-live': 'polite' } });
  const skipBtn = h('button', { class: 'btn btn--ghost', attrs: { type: 'button' } }, 'Skip card', h('span', { class: 'kbd' }, 'S'));
  const contBtn = h('button', { class: 'btn btn--primary', attrs: { type: 'button' } }, h('span', { class: 'reward-continue__label' }, 'Continue'), h('span', { class: 'kbd' }, 'Enter'));
  const body = h(
    'div',
    { class: 'screen__body reward-body' },
    title,
    h('div', { class: 'reward-top' }, strip, stack),
    cardsHead,
    cardsHost,
    h('div', { class: 'reward-footer' }, mixHost, h('div', { class: 'reward-footer__actions' }, notice, skipBtn, contBtn)),
  );
  const el = h('div', { class: 'screen reward-screen' }, top.el, body);

  let takenCard: number | null = null;
  let skipped = false;
  let hoverDef: CardDef | null = null;
  let warned = false;
  let glimmerEl: HTMLElement | null = null;
  const timers: number[] = [];
  let built = false;

  const offerOf = (): RewardOffer | null => (app.state?.phase.kind === 'reward' ? app.state.phase.offer : null);

  const later = (ms: number, fn: () => void): void => {
    timers.push(window.setTimeout(fn, app.dur(ms)));
  };

  function renderMix(): void {
    const s = app.state;
    if (!s) return;
    mixHost.innerHTML = lightMixFor(app.engine, s, hoverDef ?? undefined, true);
    mixHost.querySelector('button')?.addEventListener('click', () => app.openOverlay('deck'));
  }

  function countUp(total: number): void {
    if (!glimmerEl) return;
    const target = glimmerEl;
    const dur = app.dur(Math.min(900, 200 + total * 25));
    if (dur === 0 || total <= 0) {
      target.textContent = `+${total}`;
      return;
    }
    audioOf(app).glimmers?.(total);
    const t0 = performance.now();
    const tick = (): void => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      target.textContent = `+${Math.round(total * k)}`;
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function compassTile(s: GameState): HTMLElement {
    const owned = LIGHTS.filter((l) => s.run.deck.some((c) => app.engine.pack.cards[c.defId]?.lights.includes(l)));
    const base = {
      enabled: true,
      harmoniesThisTurn: 0,
      energy: 3,
      maxEnergy: 3,
      hollow: false,
      isolated: false,
      act2Unlocked: s.run.act >= 2,
      ownedLights: owned,
      activeShades: [],
      size: 'calc(var(--u) * 120)',
    } as const;
    const host = h('div', { class: 'reward-compass__ring' }, renderCompass({ ...base, note: [], granting: true }));
    // The ring demo (16.5): Love sets the Note, then Joy Harmonizes with it.
    if (!app.reducedMotion()) {
      later(1300, () => replaceChildren(host, renderCompass({ ...base, note: ['love'] })));
      later(2300, () => replaceChildren(host, renderCompass({ ...base, note: ['joy'], harmonyArc: ['love', 'joy'], harmoniesThisTurn: 1 })));
    } else {
      replaceChildren(host, renderCompass({ ...base, note: ['love'] }));
    }
    const def = app.engine.pack.keepsakes['ks.compass'];
    return h(
      'div',
      { class: 'reward-tile reward-compass' },
      host,
      h('div', { class: 'reward-compass__text' }, h('span', { class: 'eyebrow' }, 'Granted'), h('strong', null, def?.name ?? 'The Compass'), h('span', null, def?.text ?? '')),
    );
  }

  function keepsakeTiles(offer: RewardOffer): HTMLElement[] {
    if (offer.keepsakes.length === 0) return [];
    const taken = offer.taken.keepsake;
    if (!offer.keepsakeChoice) {
      const names = offer.keepsakes.map((id) => app.engine.pack.keepsakes[id]?.name ?? id).join(', ');
      const btn = h(
        'button',
        {
          class: ['btn', taken ? 'btn--ghost' : 'btn--primary btn--pulse', 'reward-take'],
          attrs: { type: 'button', disabled: taken, 'aria-label': taken ? `${names} taken` : `Take ${names}` },
          on: { click: () => take(0) },
        },
        taken ? 'Taken' : 'Take',
        taken ? null : h('span', { class: 'kbd' }, 'K'),
      );
      return [
        h(
          'div',
          { class: ['reward-tile reward-keepsake', taken && 'is-taken', warned && !taken && 'is-warned'] },
          ...offer.keepsakes.map((id) => keepsakeFace(app.engine, id)),
          btn,
        ),
      ];
    }
    return [
      h(
        'div',
        { class: 'reward-keepsake-choice' },
        h('span', { class: 'eyebrow' }, taken ? 'Keepsake chosen' : 'Choose a Keepsake'),
        h(
          'div',
          { class: 'reward-keepsake-choice__row' },
          offer.keepsakes.map((id, i) => {
            const legal = app.isLegal({ t: 'takeKeepsake', i });
            const has = app.state?.run.keepsakes.some((k) => k.id === id);
            const def = app.engine.pack.keepsakes[id];
            return h(
              'button',
              {
                class: ['reward-tile reward-keepsake reward-keepsake--pick', has && 'is-taken', taken && !has && 'is-passed', warned && !taken && 'is-warned'],
                attrs: { type: 'button', disabled: !legal, 'aria-label': `${has ? 'Chosen: ' : 'Choose '}${def?.name ?? id}. ${def?.text ?? ''}` },
                on: { click: () => take(i) },
              },
              keepsakeFace(app.engine, id),
              h('span', { class: 'caps reward-keepsake__cta' }, has ? 'Chosen' : taken ? '' : 'Choose'),
            );
          }),
        ),
      ),
    ];
  }

  function take(i: number): void {
    uiSound(app, 'confirm');
    warned = false;
    void app.dispatch({ t: 'takeKeepsake', i });
  }

  function renderStack(offer: RewardOffer, s: GameState): void {
    const parts: HTMLElement[] = [];
    if (offer.glimmers > 0) {
      glimmerEl = h('span', { class: 'num reward-glimmers__n' }, built ? `+${offer.glimmers}` : '+0');
      parts.push(
        h(
          'div',
          { class: 'reward-tile reward-glimmers', attrs: { 'aria-label': `${offer.glimmers} Glimmers added. You have ${s.run.glimmers}.` } },
          h('span', { class: 'reward-glimmers__icon', html: resourceIcon('glimmer') }),
          glimmerEl,
          h('span', { class: 'muted' }, 'Glimmers'),
          h('span', { class: 'reward-glimmers__total muted num' }, `You have ${s.run.glimmers}`),
        ),
      );
    }
    if (offer.compass && !built) parts.push(compassTile(s));
    else if (offer.compass) {
      const existing = stack.querySelector('.reward-compass');
      if (existing) parts.push(existing as HTMLElement);
    }
    parts.push(...keepsakeTiles(offer));
    replaceChildren(stack, parts);
  }

  function renderCards(offer: RewardOffer, s: GameState): void {
    if (offer.cards.length === 0) {
      cardsHead.hidden = true;
      cardsHost.replaceChildren();
      skipBtn.hidden = true;
      body.classList.add('is-compact');
      return;
    }
    cardsHead.hidden = false;
    const locked = offer.taken.card || skipped;
    // The engine marks both a take and a skip as taken; which one it was is only known on this screen.
    cardsHead.textContent =
      takenCard !== null
        ? 'Card added'
        : locked
          ? 'Card skipped'
          : offer.source === 'boss'
            ? 'Choose a rare card'
            : offer.fullBloom
              ? 'Full Bloom: choose a card'
              : 'Choose a card';
    const row = cardChoiceRow({
      engine: app.engine,
      cards: offer.cards,
      deck: s.run.deck,
      takenIndex: takenCard,
      locked,
      onTake: (i) => {
        uiSound(app, 'confirm');
        takenCard = i;
        hoverDef = null;
        void app.dispatch({ t: 'takeCard', i });
      },
      onHover: (def) => {
        hoverDef = locked ? null : def;
        renderMix();
      },
    });
    cardsHost.replaceChildren(row);
    skipBtn.hidden = locked;
    requestAnimationFrame(() => fitCards(row));
  }

  function renderButtons(offer: RewardOffer): void {
    const pendingKeepsake = offer.keepsakes.length > 0 && !offer.taken.keepsake;
    const label = contBtn.querySelector('.reward-continue__label')!;
    label.textContent = warned && pendingKeepsake ? (offer.keepsakeChoice ? 'Continue without one' : 'Leave it behind') : 'Continue';
    notice.textContent =
      warned && pendingKeepsake
        ? offer.keepsakeChoice
          ? 'You have not chosen a Keepsake yet.'
          : 'You have not taken the Keepsake yet.'
        : '';
  }

  function onContinue(): void {
    const offer = offerOf();
    if (!offer) return;
    if (offer.keepsakes.length > 0 && !offer.taken.keepsake && !warned) {
      // Nobody should lose a Keepsake by pressing Continue: the first press only points at it.
      warned = true;
      uiSound(app, 'notEnough');
      update();
      // A free Keepsake: offer its Take button. A boss choice has downsides, so keep focus on Continue
      // (now "Continue without one") and let the highlight do the pointing.
      (offer.keepsakeChoice ? contBtn : (stack.querySelector('.reward-take') as HTMLElement | null) ?? contBtn).focus();
      return;
    }
    uiSound(app, 'confirm');
    app.tips.dismiss('C6');
    void app.dispatch({ t: 'continue' });
  }

  function onSkip(): void {
    if (!app.isLegal({ t: 'skip' })) return;
    uiSound(app, 'cancel');
    skipped = true;
    hoverDef = null;
    void app.dispatch({ t: 'skip' });
  }

  skipBtn.addEventListener('click', onSkip);
  contBtn.addEventListener('click', onContinue);

  let offerKey = '';

  function update(): void {
    const s = app.state;
    const offer = offerOf();
    if (!s || !offer) return;
    top.update(app);
    // A different offer (a loaded save, or a reward straight after another) starts the screen afresh.
    const key = `${offer.source}|${offer.cards.join(',')}|${offer.keepsakes.join(',')}|${offer.outcomes.map((g) => g.uid).join(',')}|${s.run.floor}`;
    if (key !== offerKey) {
      offerKey = key;
      built = false;
      takenCard = null;
      skipped = false;
      warned = false;
      hoverDef = null;
      timers.splice(0).forEach((t) => clearTimeout(t));
      body.classList.remove('is-compact');
      stack.replaceChildren();
    }
    if (!built) {
      title.textContent = TITLES[offer.source];
      body.classList.toggle('reward-body--boss', offer.keepsakeChoice && offer.cards.length > 0);
      strip.replaceChildren(...offer.outcomes.map((g, i) => outcomeTile(app, s, g, i)).filter((x): x is HTMLElement => !!x));
      strip.hidden = strip.childElementCount === 0;
      strip.style.setProperty('--stagger', `${app.dur(160)}ms`);
    }
    renderStack(offer, s);
    renderCards(offer, s);
    renderMix();
    renderButtons(offer);
    if (!built) {
      built = true;
      fadeIn(el, app);
      countUp(offer.glimmers);
      if (offer.compass) {
        const c6 = COACH_MARKS.find((c) => c.id === 'C6');
        requestAnimationFrame(() => {
          if (c6) app.tips.show('C6', stack.querySelector('.reward-compass__ring'), c6.copy);
        });
      }
      // Enter means Continue here (16.5); cards are picked with 1-4 first, so nothing is taken by accident.
      requestAnimationFrame(() => contBtn.focus({ preventScroll: true }));
    }
  }

  return {
    el,
    update,
    onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      const offer = offerOf();
      if (!offer) return false;
      const n = Number(e.key);
      const cards = [...cardsHost.querySelectorAll<HTMLElement>('button.card-face')];
      if (Number.isInteger(n) && n >= 1 && n <= cards.length && !offer.taken.card && !skipped) {
        cards[n - 1]!.focus();
        uiSound(app, 'hover');
        return true;
      }
      const k = e.key.toLowerCase();
      if (k === 's') {
        onSkip();
        return true;
      }
      if (k === 'k' && !offer.keepsakeChoice && app.isLegal({ t: 'takeKeepsake', i: 0 })) {
        take(0);
        return true;
      }
      if (arrowFocus(e, body)) return true;
      if (e.key === 'Enter' && !focusedControl(el)) {
        onContinue();
        return true;
      }
      return false;
    },
    destroy() {
      timers.forEach((t) => clearTimeout(t));
    },
  };
}
