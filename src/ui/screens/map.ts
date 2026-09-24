// Map screen (DESIGN 16.4). STUB: replaced by the screen agent that owns this file.
import type { App, ScreenController } from '../app';
import { debugScreen } from '../screens/debug';

export function mapScreen(app: App): ScreenController {
  return debugScreen(app);
}
