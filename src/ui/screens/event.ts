// Memory event (DESIGN 10, 16.6). STUB: replaced by the screen agent that owns this file.
import type { App, ScreenController } from '../app';
import { debugScreen } from '../screens/debug';

export function eventScreen(app: App): ScreenController {
  return debugScreen(app);
}
