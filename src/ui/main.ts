// Boot: create the engine with the default content pack and mount the app.
// URL switches: ?seed=123, ?debug=1 (raw action inspector), ?encounter=<id> (debug fight), ?gray=1,
// ?tutorial=0|1.

import { createEngine } from '../engine/index';
import { defaultPack } from '../content/index';
import { App, type AudioApi } from './app';
import { synth } from './audio/synth';
import { debugScreen } from './screens/debug';
import { OVERLAYS, SCREENS } from './screens/registry';
import { createTips } from './tips';
import './styles/index.css';
import './styles/app.css';

const params = new URLSearchParams(window.location.search);
const num = (k: string): number | undefined => {
  const v = params.get(k);
  return v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) >>> 0 : undefined;
};

if (params.get('gray') === '1') document.documentElement.dataset.gray = '1';

const debug = params.get('debug') === '1';
const engine = createEngine(defaultPack);
const root = document.getElementById('app')!;
const tutorialParam = params.get('tutorial');

const app = new App(root, engine, {
  debug,
  seed: num('seed'),
  encounter: params.get('encounter') ?? undefined,
  tutorial: tutorialParam === null ? undefined : tutorialParam === '1',
  screens: debug ? {} : SCREENS,
  overlays: debug ? {} : OVERLAYS,
  fallback: debugScreen,
});

app.audio = synth as unknown as AudioApi;
app.tips = createTips(app);
synth.init();
app.applySettings();

const encounter = params.get('encounter');
if (encounter && engine.pack.encounters[encounter]) {
  app.newRun({ tutorial: false }, num('seed'));
  if (app.state) {
    app.state = engine.debug.startCombat(app.state, encounter);
    app.render();
  }
} else {
  app.render();
}

// Expose for debugging and automated playtests.
(window as unknown as { heartward: App }).heartward = app;
