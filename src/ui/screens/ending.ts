// Victory and defeat (DESIGN 15.2 to 15.4). STUB: replaced by the screen agent that owns this file.
import type { App, ScreenController } from '../app';
import { debugScreen } from '../screens/debug';

export function endingScreen(app: App): ScreenController {
  return debugScreen(app);
}
