// Keyboard-only checks on saved states (run meta-tour.cjs first): every non-combat screen can be finished
// with keys alone, focus is always visible, and the title handles saves and blocked storage.
// Usage: PORT=5432 TAG=s11 NODE_PATH="$(npm root -g)" node scripts/playtest/meta-keys.cjs
const L = require('./meta-lib.cjs');
const TAG = process.env.TAG || 's11';

async function phase(page) {
  await L.idle(page);
  return page.evaluate(() => window.heartward.state?.phase.kind ?? 'title');
}

async function focused(page) {
  return page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return null;
    const cs = getComputedStyle(a);
    return { tag: a.tagName, label: (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 60), outline: cs.outlineStyle !== 'none' && cs.outlineWidth !== '0px' };
  });
}

(async () => {
  const browser = await L.launch();
  const report = {};
  const { page, errors } = await L.openPage(browser, { query: '?tutorial=0' });
  const run = async (name, state, keys, expectPhase) => {
    await L.loadState(page, state);
    for (const k of keys) {
      await page.keyboard.press(k);
      await page.waitForTimeout(120);
    }
    const f = await focused(page);
    const p = await phase(page);
    report[name] = { ok: expectPhase ? p === expectPhase : true, phase: p, focus: f };
  };

  await run('map: 2 then Enter travels', `${TAG}-map-act1`, ['2', 'Enter'], null);
  await run('map: Right, Right, Enter travels', `${TAG}-map-act2`, ['ArrowRight', 'ArrowRight', 'Enter'], null);
  await run('haven: 1 then Enter rests', `${TAG}-haven`, ['1', 'Enter'], 'map');
  await run('haven: 2 then Enter opens Kindle', `${TAG}-haven`, ['2', 'Enter'], 'deckSelect');
  await run('deck select: Right, Enter picks, Enter confirms', `${TAG}-deckSelect-upgrade`, ['ArrowRight', 'Enter', 'Enter'], null);
  await run('deck select: S goes back', `${TAG}-deckSelect-upgrade`, ['s'], 'haven');
  await run('event: 3 then Enter chooses', `${TAG}-event-mem.campfire`, ['3', 'Enter'], null);
  await run('event after: Enter continues', `${TAG}-event-mem.campfire-after`, ['Enter'], 'map');
  await run('shop: 1 then Enter buys (if affordable)', `${TAG}-shop-act1`, ['1', 'Enter'], 'shop');
  await run('shop: L leaves', `${TAG}-shop-act1`, ['l'], 'map');
  await run('reward: 1, Enter takes, Enter continues', `${TAG}-reward-fight-bloom`, ['1', 'Enter', 'Enter'], 'map');
  await run('reward: S skips, Enter continues', `${TAG}-reward-fight-bloom`, ['s', 'Enter'], 'map');
  await run('chest: first Enter warns, K takes, Enter continues', `${TAG}-reward-chest`, ['Enter'], 'reward');
  report['chest warning text'] = await page.$eval('.reward-notice', (x) => x.textContent);
  await page.keyboard.press('k');
  await page.waitForTimeout(200);
  await page.keyboard.press('Enter');
  report['chest after K + Enter'] = await phase(page);
  await run('boss: Enter warns, second Enter leaves without a Keepsake', `${TAG}-reward-boss`, ['Enter', 'Enter'], 'wheelCloses');
  await run('boss: 2, Enter takes a card; click a Keepsake; Enter continues', `${TAG}-reward-boss`, ['2', 'Enter'], 'reward');
  await page.click('.reward-keepsake--pick:not(:disabled)');
  await L.idle(page);
  await page.keyboard.press('Enter');
  report['boss after picks'] = await phase(page);
  await page.waitForTimeout(300);
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  report['wheel closes: any key reveals, 1 + Enter takes'] = await phase(page);
  await run('charm: 4 then Enter', `${TAG}-charmSelect`, ['4', 'Enter'], 'map');
  await L.shot(page, 'keys-focus-map');

  // Title with a save: Continue is primary; New Run asks first; Escape backs out.
  await page.evaluate(() => window.heartward.toTitle());
  await page.waitForTimeout(300);
  report['title with save'] = await page.$$eval('.title-menu button', (b) => b.map((x) => x.textContent.trim()));
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  report['title new run confirm'] = await page.$eval('.title-menu__confirm', (x) => x.textContent).catch(() => null);
  await L.shot(page, 'keys-title-confirm');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  report['title Enter continues'] = await phase(page);
  report.errors = errors;

  // Blocked storage: Begin plus an explicit Skip tutorial.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const p2 = await ctx.newPage();
  await p2.addInitScript(() => {
    const deny = () => {
      throw new Error('blocked');
    };
    Object.defineProperty(window, 'localStorage', { get: deny });
  });
  const errs2 = [];
  p2.on('pageerror', (e) => errs2.push(e.message));
  await p2.goto(L.BASE);
  await p2.waitForFunction(() => !!window.heartward);
  report['blocked storage buttons'] = await p2.$$eval('.title-menu button', (b) => b.map((x) => x.textContent.trim()));
  await L.shot(p2, 'keys-title-blocked-storage');
  await p2.click('text=Skip tutorial');
  await p2.waitForTimeout(300);
  report['blocked storage skip'] = await p2.evaluate(() => ({ phase: window.heartward.state?.phase.kind, tutorial: window.heartward.state?.run.tutorial }));
  report.blockedErrors = errs2;
  console.log(JSON.stringify(report, null, 1));
  await browser.close();
})();
