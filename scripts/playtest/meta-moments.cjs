// Moments: the first-run tutorial start (time from Begin to the first combat), the wheel closes cinematic,
// The Deep title card, both victory endings and the coach mark C13 on a first map.
// Needs saved states from meta-tour.cjs (TAG s5 by default).
// Usage: PORT=5432 NODE_PATH="$(npm root -g)" node scripts/playtest/meta-moments.cjs
const L = require('./meta-lib.cjs');
const W = Number(process.env.W || 1280);
const H = Number(process.env.H || 720);
const TAG = process.env.TAG || 's5';

(async () => {
  const browser = await L.launch();
  const report = {};

  // 1. Fresh profile: the title offers Begin with the tutorial on; Begin drops straight into combat.
  {
    const { page, errors } = await L.openPage(browser, { width: W, height: H, query: '' });
    report.titleButtons = await page.$$eval('.title-menu button', (b) => b.map((x) => x.textContent.trim()));
    const t0 = Date.now();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.heartward.state?.phase.kind === 'combat');
    report.beginToCombatMs = Date.now() - t0;
    report.tutorial = await page.evaluate(() => window.heartward.state.run.tutorial);
    await L.shot(page, `mo-${W}x${H}-tutorial-start`);
    report.tutorialErrors = errors;
  }

  // 2. The wheel closes: from the Act 1 boss reward, Continue, and catch the cinematic mid-way.
  {
    const { page, errors } = await L.openPage(browser, { width: W, height: H, query: '?tutorial=0' });
    await L.loadState(page, `${TAG}-reward-boss`);
    await page.evaluate(() => void window.heartward.dispatch({ t: 'continue' }));
    await page.waitForTimeout(700);
    await L.shot(page, `mo-${W}x${H}-wheel-cinematic`);
    await page.waitForTimeout(2200);
    await L.shot(page, `mo-${W}x${H}-wheel-choice`);
    // 3. The Deep title card, raised the way the hook sees it (a step whose events carry act -> 3).
    await L.loadState(page, `${TAG}-shop-act1`);
    await page.evaluate(() => {
      const app = window.heartward;
      for (const fn of app.listeners) fn([{ e: 'run', what: 'act', after: 3 }], app.state, app.state);
    });
    await page.waitForTimeout(1200);
    await L.shot(page, `mo-${W}x${H}-deep-card`);
    await page.mouse.click(640, 360);
    await page.waitForTimeout(600);
    report.deepCardGone = await page.$('.title-card').then((x) => !x);
    // 4. Both endings and both defeat causes, on the stats of a finished run.
    const finished = L.listStates().find((n) => n === `${TAG}-victory` || n === `${TAG}-defeat`);
    const ends = [
      ['victory-resolved', { kind: 'victory', ending: 'resolved' }],
      ['victory-suppressed', { kind: 'victory', ending: 'suppressed' }],
      ['defeat-heart', { kind: 'defeat', cause: 'heart' }],
      ['defeat-turnlimit', { kind: 'defeat', cause: 'turnLimit' }],
    ];
    for (const [name, phase] of ends) {
      await L.loadState(page, finished);
      await page.evaluate((ph) => {
        const app = window.heartward;
        app.state = { ...app.state, phase: ph };
        app.render();
      }, phase);
      await page.waitForTimeout(1500);
      await L.shot(page, `mo-${W}x${H}-${name}`);
    }
    report.errors = errors;
  }

  // 5. Coach mark C13 on the first map of a fresh profile (first run, tutorial skipped).
  {
    const { page, errors } = await L.openPage(browser, { width: W, height: H, query: '?tutorial=0' });
    await page.click('.title-menu .btn--primary');
    await L.idle(page);
    await page.keyboard.press('1');
    await page.keyboard.press('Enter');
    await L.idle(page);
    await page.waitForTimeout(900);
    report.c13 = await page.$eval('.tips-layer .coach-mark', (x) => x.textContent.trim()).catch(() => null);
    await L.shot(page, `mo-${W}x${H}-c13`);
    await page.mouse.click(20, 400);
    await page.waitForTimeout(400);
    report.c13AfterClick = await page.$('.tips-layer .coach-mark').then((x) => !!x);
    report.seenTips = await page.evaluate(() => window.heartward.profile.seenTips);
    report.c13Errors = errors;
  }
  console.log(JSON.stringify(report, null, 1));
  await browser.close();
})();
