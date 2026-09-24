import { describe, expect, it } from 'vitest';
import { defaultPack } from '../../../src/content/index';
import { TEXT_FLOOR, TIERS, fitCard, footerFits, nameLayout, textWidth } from '../../../src/ui/kit/cardFit';
import { cardFaceMarkup, defaultFooter } from '../../../src/ui/kit/cardFace';

/** Fill a content text template with worst-case numbers: two digits for {n}, Weight 3 for {w}. */
const fill = (t: string): string => t.replace(/\{w\}/g, '3').replace(/\{\d+\}/g, '12');

/** Every card face the game can show: each card's text, and its upgraded text when it has one. */
function everyFace(): { name: string; text: string }[] {
  const out: { name: string; text: string }[] = [];
  for (const def of Object.values(defaultPack.cards)) {
    out.push({ name: def.name, text: fill(def.text) });
    if (def.upgrade?.text) out.push({ name: `${def.name}+`, text: fill(def.upgrade.text) });
  }
  return out;
}

describe('card text fitting (DESIGN 16.2, 19)', () => {
  it('never sets rules text or names below the 12px floor', () => {
    expect(TEXT_FLOOR).toBe(12);
    for (const t of TIERS) expect(t.text, t.id).toBeGreaterThanOrEqual(TEXT_FLOOR);
    expect(TIERS[0]).toMatchObject({ art: 70, text: 13, num: 16, maxLines: 3 });
  });

  it('fits every 6.x card text, upgraded or not, at the floor with two-digit numbers', () => {
    const faces = everyFace();
    expect(faces.length).toBeGreaterThan(60);
    for (const f of faces) {
      const fit = fitCard(f.name, f.text);
      expect(fit.fits, `${f.name}: "${f.text}"`).toBe(true);
      expect(fit.name.size, f.name).toBeGreaterThanOrEqual(TEXT_FLOOR);
    }
  });

  it('keeps names at 14px when they fit and wraps long ones to two lines at 12px', () => {
    expect(nameLayout('Kind Word')).toEqual({ size: 14, lines: 1 });
    expect(nameLayout('Shoulder to Shoulder')).toEqual({ size: 12, lines: 2 });
  });

  it('fits every default footer on one line, dropping only the kind word when needed', () => {
    for (const def of Object.values(defaultPack.cards)) {
      const footer = defaultFooter({
        lights: def.lights,
        kindLabel: def.kind === 'ease' ? 'Ease' : def.kind === 'skill' ? 'Skill' : def.kind === 'mood' ? 'Mood' : 'Buried',
        ...(def.buried ? { buried: { weight: 3, shade: def.buried.shade } } : {}),
        ...(def.id.startsWith('insight.') ? { insight: true } : {}),
      });
      const main = footer.split(' · ')[0]!;
      expect(footerFits(main), `${def.name}: ${footer}`).toBe(true);
    }
  });

  it('measures with the widest fallback font, so bold text is wider than regular', () => {
    expect(textWidth('Ease 12', 13, true)).toBeGreaterThan(textWidth('Ease 12', 13));
    expect(textWidth('', 13)).toBe(0);
  });

  it('draws no line-clamp: overflowing text is a fitting bug, never hidden', () => {
    const m = cardFaceMarkup({ name: 'Grand Finale', lights: ['joy'], cost: 2, kindLabel: 'Ease', text: fill('Ease {0} to ALL Shades once for each card you played earlier this turn (at least once). Let Go.'), rarity: 'rare' });
    expect(m).not.toContain('line-clamp');
    expect(m).toContain('data-fit=');
  });
});
