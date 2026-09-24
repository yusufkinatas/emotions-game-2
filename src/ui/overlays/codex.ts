// Codex overlay (DESIGN 16.6). STUB: replaced by the screen agent that owns this file.
import type { App, ScreenController } from '../app';
import { debugScreen } from '../screens/debug';

export function codexOverlay(app: App): ScreenController {
  return debugScreen(app);
}
