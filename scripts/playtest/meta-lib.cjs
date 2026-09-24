// Shared helpers for the meta-screen playtests (run with NODE_PATH="$(npm root -g)").
// Drives the real app through window.heartward (the App instance) and saves screenshots.
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const PORT = process.env.PORT || '5431';
const BASE = `http://localhost:${PORT}/`;
const OUT = path.join(__dirname, '..', '..', 'docs', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

async function launch() {
  return chromium.launch();
}

/** A page with console error capture. `errors` collects page errors and console.error lines. */
async function openPage(browser, { width = 1280, height = 720, query = '', reducedMotion = 'no-preference', fresh = true } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  if (fresh) {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('meta-init')) {
        localStorage.clear();
        sessionStorage.setItem('meta-init', '1');
      }
    });
  }
  await page.goto(BASE + query);
  await page.waitForFunction(() => !!window.heartward);
  return { page, context, errors };
}

async function shot(page, name) {
  await page.waitForTimeout(250);
  const file = path.join(OUT, `meta-${name}.png`);
  await page.screenshot({ path: file });
  return file;
}

/** Wait until the app is idle (no dispatch in flight). */
async function idle(page) {
  await page.waitForFunction(() => !window.heartward.busy, null, { timeout: 20000 });
}

/** Dispatch a legal action matching `pred` (a function source string over action a). */
async function act(page, predSrc) {
  const ok = await page.evaluate(async (src) => {
    const app = window.heartward;
    const pred = new Function('a', 's', `return (${src});`);
    const acts = app.engine.legalActions(app.state);
    const a = acts.find((x) => pred(x, app.state));
    if (!a) return false;
    await app.dispatch(a);
    return true;
  }, predSrc);
  await idle(page);
  return ok;
}

/** Win the current combat instantly by driving the engine (not a UI test of combat). */
async function autoCombat(page, maxSteps = 400, cheat = !!process.env.CHEAT) {
  return page.evaluate(async ({ max, cheat }) => {
    const app = window.heartward;
    app.profile.settings.animSpeed = 0;
    for (let i = 0; i < max && app.state && app.state.phase.kind === 'combat'; i++) {
      // CHEAT=1 keeps the Heart topped up so a tour can reach late screens (a harness hack, not a rule).
      if (cheat && app.state.combat) {
        app.state.combat.player.hp = Math.max(app.state.combat.player.hp, 40);
        if (app.state.combat.turn > 3) for (const e of app.state.combat.enemies) e.hp = Math.min(e.hp, 4);
      }
      const s = app.state;
      const acts = app.engine.legalActions(s);
      // Prefer a play that Resolves, then any outward play, then end turn.
      let best = null;
      let bestScore = -Infinity;
      for (const a of acts) {
        if (a.t === 'play') {
          const p = app.engine.preview(s, a);
          let score = 1;
          if (p) for (const t of p.targets) {
            score += (t.hpBefore - t.hpAfter);
            if (t.outcome === 'resolve' || t.outcome === 'deepResolve') score += 100;
            if (t.outcome === 'suppress') score -= 20;
          }
          if (a.inward) score -= 5;
          if (score > bestScore) { bestScore = score; best = a; }
        } else if (a.t === 'choose' && !best) best = a;
      }
      const a = best ?? acts.find((x) => x.t === 'endTurn') ?? acts[0];
      if (!a) break;
      await app.dispatch(a);
    }
    app.profile.settings.animSpeed = 1;
    return app.state?.phase.kind;
  }, { max: maxSteps, cheat });
}

/** Walk the run (auto combats, take first options) until `stop(state)` is true. Returns the phase kind. */
async function walkUntil(page, stopSrc, maxSteps = 600) {
  for (let i = 0; i < maxSteps; i++) {
    const phase = await page.evaluate((src) => {
      const app = window.heartward;
      const s = app.state;
      if (!s) return 'none';
      const stop = new Function('s', 'app', `return (${src});`);
      return stop(s, app) ? `STOP:${s.phase.kind}` : s.phase.kind;
    }, stopSrc);
    if (phase.startsWith('STOP:')) return phase.slice(5);
    if (phase === 'victory' || phase === 'defeat' || phase === 'none') return phase;
    if (phase === 'combat') await autoCombat(page);
    else
      await page.evaluate(async () => {
        const app = window.heartward;
        const s = app.state;
        const acts = app.engine.legalActions(s);
        const pick =
          acts.find((a) => a.t === 'takeKeepsake') ??
          acts.find((a) => a.t === 'takeCard') ??
          acts.find((a) => a.t === 'rest') ??
          acts.find((a) => a.t === 'pickCharm') ??
          acts.find((a) => a.t === 'option') ??
          acts.find((a) => a.t === 'choose') ??
          acts.find((a) => a.t === 'move') ??
          acts.find((a) => a.t === 'continue') ??
          acts.find((a) => a.t === 'leave') ??
          acts[0];
        if (pick) await app.dispatch(pick);
      });
    await idle(page);
  }
  return 'timeout';
}

const STATES = path.join(OUT, 'meta-states');
fs.mkdirSync(STATES, { recursive: true });

function saveState(name, json) {
  fs.writeFileSync(path.join(STATES, `${name}.json`), json);
}

function listStates() {
  return fs.readdirSync(STATES).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
}

/** Put a saved state on screen (no step, so no animation) and wait for it to settle. */
async function loadState(page, name) {
  const json = fs.readFileSync(path.join(STATES, `${name}.json`), 'utf8');
  const ok = await page.evaluate((j) => {
    const app = window.heartward;
    const s = app.engine.deserialize(j);
    if (!s) return false;
    app.state = s;
    app.screen = 'run';
    app.ui = {};
    app.overlay = null;
    app.render();
    return true;
  }, json);
  await page.waitForTimeout(700);
  return ok;
}

module.exports = { saveState, listStates, loadState, STATES, BASE, OUT, launch, openPage, shot, idle, act, autoCombat, walkUntil };
