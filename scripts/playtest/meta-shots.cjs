// Re-render saved states (from meta-tour.cjs) at one viewport and palette and screenshot each.
// Usage: PORT=5432 W=1920 H=1080 QUERY='&gray=1' ONLY=reward NODE_PATH="$(npm root -g)" node scripts/playtest/meta-shots.cjs
const L = require('./meta-lib.cjs');

const W = Number(process.env.W || 1280);
const H = Number(process.env.H || 720);
const QUERY = process.env.QUERY || '';
const ONLY = process.env.ONLY || '';
const SUFFIX = process.env.SUFFIX || `${W}x${H}`;
const PALETTE = process.env.PALETTE || '';
const MOTION = process.env.MOTION || '';

(async () => {
  const browser = await L.launch();
  const { page, errors } = await L.openPage(browser, { width: W, height: H, query: `?tutorial=0${QUERY}`, reducedMotion: MOTION === 'reduced' ? 'reduce' : 'no-preference' });
  if (PALETTE || MOTION) {
    await page.evaluate(({ p, m }) => {
      const patch = {};
      if (p) patch.palette = p;
      if (m) patch.motion = m;
      window.heartward.setSettings(patch);
    }, { p: PALETTE, m: MOTION });
  }
  const out = [];
  for (const name of L.listStates()) {
    if (ONLY && !name.includes(ONLY)) continue;
    if (!(await L.loadState(page, name))) continue;
    out.push(await L.shot(page, `${name}-${SUFFIX}`));
  }
  console.log(JSON.stringify({ shots: out.length, errors }, null, 1));
  await browser.close();
})();
