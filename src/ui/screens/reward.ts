// Reward screen (DESIGN 16.5). STUB: replaced by the screen agent that owns this file.
import type { App, ScreenController } from '../app';
import { debugScreen } from '../screens/debug';

export function rewardScreen(app: App): ScreenController {
  return debugScreen(app);
}
