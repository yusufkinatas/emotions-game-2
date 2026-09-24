// Deck, draw pile and discard pile overlay (DESIGN 16.6). STUB: replaced by the screen agent that owns this file.
import type { App, ScreenController } from '../app';
import { debugScreen } from '../screens/debug';

export function deckOverlay(app: App): ScreenController {
  return debugScreen(app);
}
