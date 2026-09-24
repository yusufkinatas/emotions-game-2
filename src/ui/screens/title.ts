// Title screen (DESIGN 16.3). STUB: replaced by the screen agent that owns this file.
import type { App, ScreenController } from '../app';
import { debugScreen } from '../screens/debug';

export function titleScreen(app: App): ScreenController {
  return debugScreen(app);
}
