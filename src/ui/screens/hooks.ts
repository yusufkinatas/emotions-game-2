// Global UI reactions to engine events outside any one screen: "The Deep" title card when the run enters
// act 3 (DESIGN 15.1) and the act's ambience when a run moves into a new act away from the map.
import { TITLE_CARDS } from '../../content/index';
import type { App } from '../app';
import { ambienceFor, showTitleCard } from '../components/titleCard';

export function installMetaHooks(app: App): void {
  app.onStep((events) => {
    for (const ev of events) {
      if (ev.e === 'run' && ev.what === 'act' && ev.after === 3) {
        // The Deep opens straight into its Sanctuary; the card covers the change of scene.
        ambienceFor(app, 3);
        void showTitleCard(app, TITLE_CARDS.deep, 2400);
      }
    }
  });
}
