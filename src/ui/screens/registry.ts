// Screen and overlay registry. Each module is owned by one screen agent.
import type { OverlayKey, ScreenFactory, ScreenKey } from '../app';
import { codexOverlay } from '../overlays/codex';
import { deckOverlay } from '../overlays/deck';
import { logOverlay } from '../overlays/log';
import { pauseOverlay } from '../overlays/pause';
import { settingsOverlay } from '../overlays/settings';
import { charmScreen } from './charm';
import { combatScreen } from './combat/index';
import { deckSelectScreen } from './deckSelect';
import { endingScreen } from './ending';
import { eventScreen } from './event';
import { havenScreen } from './haven';
import { mapScreen } from './map';
import { rewardScreen } from './reward';
import { shopScreen } from './shop';
import { titleScreen } from './title';
import { wheelClosesScreen } from './wheelCloses';

export const SCREENS: Partial<Record<ScreenKey, ScreenFactory>> = {
  title: titleScreen,
  charmSelect: charmScreen,
  map: mapScreen,
  combat: combatScreen,
  reward: rewardScreen,
  wheelCloses: wheelClosesScreen,
  shop: shopScreen,
  haven: havenScreen,
  event: eventScreen,
  deckSelect: deckSelectScreen,
  victory: endingScreen,
  defeat: endingScreen,
};

/** 'draw' and 'discard' reuse the deck overlay (it reads app.overlay to pick the pile). */
export const OVERLAYS: Partial<Record<OverlayKey, ScreenFactory>> = {
  deck: deckOverlay,
  draw: deckOverlay,
  discard: deckOverlay,
  codex: codexOverlay,
  settings: settingsOverlay,
  pause: pauseOverlay,
  log: logOverlay,
};
