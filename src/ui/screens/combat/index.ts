// Combat screen (DESIGN 16.1, 16.2). The screen lives in screen.ts; its animation in src/ui/anim.
import type { App, ScreenController } from '../../app';
import { CombatScreen } from './screen';

export function combatScreen(app: App): ScreenController {
  return new CombatScreen(app);
}
