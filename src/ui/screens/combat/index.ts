// Combat screen (DESIGN 16.1, 16.2). STUB: replaced by the screen agent that owns this file.
import type { App, ScreenController } from '../../app';
import { debugScreen } from '../../screens/debug';

export function combatScreen(app: App): ScreenController {
  return debugScreen(app);
}
