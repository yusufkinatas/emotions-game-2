import { describe, expect, it } from 'vitest';
import { cardChipMarkup, cardFaceMarkup, defaultFooter, formatCardText } from '../../../src/ui/kit/cardFace';
import type { CardFaceProps } from '../../../src/ui/kit/cardFace';

const kindWord: CardFaceProps = { name: 'Kind Word', lights: ['love'], cost: 1, kindLabel: 'Ease', text: 'Ease 6.', rarity: 'starter' };

/** Visible text of some markup (tags stripped). */
const textOf = (m: string): string => m.replace(/<[^>]+>/g, '');

describe('card text', () => {
  it('bolds every number and escapes the rest', () => {
    expect(formatCardText('Ease 6. Draw 1.')).toBe('Ease <b class="n">6</b>. Draw <b class="n">1</b>.');
    expect(formatCardText("It's <b>5</b>")).toBe('It&#39;s &lt;b&gt;<b class="n">5</b>&lt;/b&gt;');
  });

  it('adds trend triangles in order and marks keywords', () => {
    const t = formatCardText('Ease 12. Mend 2.', ['up', null]);
    expect(t).toContain('<b class="n n--up">12');
    expect(t).toContain('trend--up');
    expect(t).toContain('<b class="n">2</b>');
    expect(formatCardText('Harmony: draw 1 more. Linger.')).toContain('<span class="kw kw--harmony">Harmony:</span>');
    expect(formatCardText('Linger.')).toContain('<span class="kw">Linger</span>');
    expect(formatCardText('each turn it has Lingered')).not.toContain('class="kw"');
  });
});

describe('card face', () => {
  it('shows cost, badge, name, text and a Light footer', () => {
    const m = cardFaceMarkup(kindWord);
    expect(m).toContain('data-light="love"');
    expect(m).toContain('<span class="gem__n">1</span>');
    expect(m).toContain('Kind Word');
    // The footer's kind word is its own span so it can drop when space is tight.
    expect(textOf(m)).toContain('LOVE · EASE');
    expect(m).toContain('<span class="card-face__footer-main">LOVE</span><span class="card-face__footer-rest"> · EASE</span>');
    expect(m).toContain('aria-label="Kind Word, Love, cost 1. Ease 6."');
  });

  it('builds default footers for every kind', () => {
    // Every Blend is an Ease card (6.8), so a Blend footer is just the Blend's name.
    expect(defaultFooter({ lights: ['love', 'joy'], kindLabel: 'Ease' })).toBe('DELIGHT');
    expect(defaultFooter({ lights: ['calm', 'love'], kindLabel: 'Ease' })).toBe('COMPASSION');
    expect(defaultFooter({ lights: [], kindLabel: 'Skill' })).toBe('NEUTRAL · SKILL');
    expect(defaultFooter({ lights: [], kindLabel: 'Buried', buried: { weight: 2, shade: 'fear' } })).toBe('BURIED · FEAR');
    // Insight follows the "LIGHT · KIND" pattern of every other card.
    expect(defaultFooter({ lights: ['calm'], kindLabel: 'Skill', insight: true })).toBe('CALM · INSIGHT');
  });

  it('splits Blends and marks neutral cards', () => {
    const blend = cardFaceMarkup({ ...kindWord, name: 'Sunbeam', lights: ['love', 'joy'], rarity: 'blend' });
    expect(blend).toContain('data-light2="joy"');
    expect(blend).toContain('data-kind="blend"');
    expect(blend).toContain('card-face__badge--blend');
    expect(cardFaceMarkup({ ...kindWord, lights: [] })).toContain('data-kind="neutral"');
  });

  it('draws Buried cards with Weight pips, cure-colour cracks and no cost gem', () => {
    const m = cardFaceMarkup({ ...kindWord, name: 'Buried Fear', lights: [], cost: null, kindLabel: 'Buried', rarity: 'special', buried: { weight: 2, shade: 'fear' } });
    expect(m).toContain('data-kind="buried"');
    expect(m).toContain('data-face="fear"');
    expect((m.match(/pip pip--on/g) ?? []).length).toBe(2);
    expect((m.match(/class="pip"/g) ?? []).length).toBe(1);
    expect(m).toContain('card-face__cracks');
    expect(m).not.toContain('card-face__gem');
    expect(m).toContain('unplayable');
  });

  it('labels Insight cards', () => {
    const m = cardFaceMarkup({ ...kindWord, name: 'Passion', insight: true, rarity: 'special' });
    expect(m).toContain('data-kind="insight"');
    expect(m).toContain('INSIGHT');
  });

  it('shows states, cost states and the NO LIGHT footer when numbed', () => {
    expect(cardFaceMarkup({ ...kindWord, state: 'selected' })).toContain('data-state="selected"');
    expect(cardFaceMarkup({ ...kindWord, costState: 'raised' })).toContain('gem__tick');
    expect(cardFaceMarkup({ ...kindWord, costState: 'unaffordable' })).toContain('data-cost-state="unaffordable"');
    expect(cardFaceMarkup({ ...kindWord, state: 'numbed' })).toContain('NO LIGHT');
  });

  it('adds the upgrade plus once', () => {
    expect(cardFaceMarkup({ ...kindWord, upgraded: true })).toContain('Kind Word+</span>');
    expect(cardFaceMarkup({ ...kindWord, name: 'Kind Word+', upgraded: true })).not.toContain('Kind Word++');
  });

  it('keeps at most two chips and styles them by meaning', () => {
    const m = cardFaceMarkup({ ...kindWord, chips: ['Tends Buried Fear', 'HARMONY -> Delight', 'Soothes Heavy'] });
    expect((m.match(/class="card-chip[ "]/g) ?? []).length).toBe(2);
    expect(m).not.toContain('Soothes Heavy');
    expect(cardChipMarkup('HARMONY -> Delight')).toContain('data-light="love" data-light2="joy"');
    expect(cardChipMarkup('HARMONY -> Delight')).toContain('→');
    expect(cardChipMarkup('Tends Buried Fear')).toContain('data-face="fear"');
    expect(cardChipMarkup('Soothes Heavy')).toContain('data-face="sadness"');
    expect(cardChipMarkup('Something else')).toBe(
      '<span class="card-chip"><span class="card-chip__short" aria-hidden="true">Something</span><span class="card-chip__full">Something else</span></span>',
    );
  });

  it('draws chips compact (icon and one word) with the full sentence for hover, focus and selection', () => {
    const chip = cardChipMarkup('HARMONY -> Playfulness');
    expect(chip).toContain('<span class="card-chip__short" aria-hidden="true">Playfulness</span>');
    expect(chip).toContain('<span class="card-chip__full">HARMONY → Playfulness</span>');
    expect(cardChipMarkup('Tends Buried Anger')).toContain('card-chip__short" aria-hidden="true">Tends<');
    // The Soothes short form keeps its verb (a bare "Seething" read as "this card gives Seething").
    expect(cardChipMarkup('Soothes Seething')).toContain('card-chip__short" aria-hidden="true">Soothes<');
    expect(cardChipMarkup('Soothes Seething')).toContain('<span class="card-chip__full">Soothes Seething</span>');
  });

  it('speaks its chips in the default label, since the drawn chips are aria-hidden', () => {
    const m = cardFaceMarkup({ ...kindWord, chips: ['Tends Buried Anger', 'HARMONY -> Delight'] });
    expect(m).toContain('<div class="card-face__chips" aria-hidden="true">');
    expect(m).toContain('aria-label="Kind Word, Love, cost 1. Ease 6. Tends Buried Anger. Harmony: Delight."');
  });

  it('fits long names and rules by wrapping and giving up art height, never by shrinking below 12px', () => {
    const long = cardFaceMarkup({ ...kindWord, name: 'Shoulder to Shoulder', text: 'Ease 6 and gain 6 Guard, +2 each per Companion. Reaches Shy.' });
    expect(long).toContain('data-name-lines="2"');
    expect(long).toContain('style="--name-size:12"');
    expect(long).toContain('data-fit="sm"');
    const short = cardFaceMarkup(kindWord);
    expect(short).toContain('data-fit="md"');
    expect(short).toContain('data-name-lines="1"');
    expect(short).not.toContain('--name-size');
  });

  it('labels Buried Weight in text and in the spoken label', () => {
    const m = cardFaceMarkup({ ...kindWord, name: 'Buried Anger', lights: [], cost: null, kindLabel: 'Buried', rarity: 'special', buried: { weight: 2, shade: 'anger' } });
    expect(m).toContain('<b class="card-face__weight-n">W2</b>');
    expect(m).toContain('aria-label="Buried Anger, Weight 2, unplayable.');
  });

  it('can be a button', () => {
    const m = cardFaceMarkup({ ...kindWord, tag: 'button' });
    expect(m).toMatch(/^<button[^>]*type="button"/);
    expect(m.endsWith('</button>')).toBe(true);
  });
});
