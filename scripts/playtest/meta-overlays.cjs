// Overlays and global moments: deck view, Codex tabs, Settings, Pause (with the abandon confirm), the Deep
// title card and coach mark C13, on a saved map state (run meta-tour.cjs first).
// Usage: PORT=5432 STATE=s5-map-act2 NODE_PATH="$(npm root -g)" node scripts/playtest/meta-overlays.cjs
const L = require('./meta-lib.cjs');
const W = Number(process.env.W || 1280);
const H = Number(process.env.H || 720);
const STATE = process.env.STATE || 's5-map-act2';
const TAG = `${STATE}-${W}x${H}`;

(async () => {
  const browser = await L.launch();
  const { page, errors } = await L.openPage(browser, { width: W, height: H, query: '?tutorial=0' });
  const shots = [];
  const shot = async (n) => shots.push(await L.shot(page, `ov-${TAG}-${n}`));
  // Title overlays first (no run).
  await page.keyboard.press('c');
  await shot('title-codex');
  await page.keyboard.press('Escape');
  await page.keyboard.press('s');
  await shot('title-settings');
  await page.keyboard.press('Escape');

  await L.loadState(page, STATE);
  await page.keyboard.press('d');
  await shot('deck');
  await page.click('.deck-overlay__toggle input');
  await shot('deck-upgrades');
  await page.keyboard.press('Escape');
  await page.keyboard.press('c');
  for (const k of ['1', '2', '3', '4']) {
    await page.keyboard.press(k);
    await shot(`codex-${k}`);
  }
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await shot('pause');
  await page.click('text=Settings');
  await shot('settings');
  // Keyboard: switch to Instant speed and the colour-blind palette, then Back to Pause.
  await page.click('.settings-seg__opt:has-text("Instant")');
  await page.click('.settings-check:has-text("Colour-blind")');
  await shot('settings-changed');
  await page.click('.settings-foot .btn');
  await shot('pause-back');
  await page.click('text=Abandon run');
  await shot('pause-confirm');
  await page.click('text=Keep going');
  await page.keyboard.press('Escape');
  const state = await page.evaluate(() => ({ overlay: window.heartward.overlay, settings: window.heartward.profile.settings, root: document.documentElement.dataset.palette }));
  console.log(JSON.stringify({ shots: shots.length, state, errors }, null, 1));
  await browser.close();
})();
