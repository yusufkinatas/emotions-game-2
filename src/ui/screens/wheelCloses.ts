// The wheel closes (DESIGN 12.5, 15.1). STUB: replaced by the screen agent that owns this file.
import type { App, ScreenController } from '../app';
import { debugScreen } from '../screens/debug';

export function wheelClosesScreen(app: App): ScreenController {
  return debugScreen(app);
}
