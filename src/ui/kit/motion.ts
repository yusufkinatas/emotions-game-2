// Motion helpers (DESIGN 18.1, 19): reduced-motion detection and hit-stop.

/** True when reduced motion is on: data-motion="reduced" on <html>, or the OS setting unless "full" is forced. */
export function prefersReducedMotion(root: Element | null = globalThis.document?.documentElement ?? null): boolean {
  const forced = root?.getAttribute('data-motion');
  if (forced === 'reduced') return true;
  if (forced === 'full') return false;
  try {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

/**
 * Hit-stop: pause every stage animation under `el` for `ms` (60 for an OPPOSITE hit, 110 for a Resolve).
 * Pauses CSS animations through the `is-hitstop` class and the SVG heat shimmer (SMIL) of every Shade
 * inside. Does nothing under reduced motion (18.1: hit-stop off). Returns a function that ends it early.
 */
export function hitStop(el: Element, ms: number): () => void {
  if (prefersReducedMotion() || ms <= 0) return () => undefined;
  const svgs = [...el.querySelectorAll<SVGSVGElement>('svg.shade-art')];
  if (typeof SVGSVGElement !== 'undefined' && el instanceof SVGSVGElement && el.classList.contains('shade-art')) svgs.push(el);
  el.classList.add('is-hitstop');
  for (const s of svgs) s.pauseAnimations?.();
  let done = false;
  const end = () => {
    if (done) return;
    done = true;
    el.classList.remove('is-hitstop');
    for (const s of svgs) s.unpauseAnimations?.();
  };
  setTimeout(end, ms);
  return end;
}
