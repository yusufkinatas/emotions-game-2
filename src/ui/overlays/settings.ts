// Settings overlay (DESIGN 16.6). STUB: replaced by the screen agent that owns this file.
import type { App, ScreenController } from '../app';
import { debugScreen } from '../screens/debug';

export function settingsOverlay(app: App): ScreenController {
  return debugScreen(app);
}
