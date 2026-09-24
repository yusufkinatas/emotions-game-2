// Screen and overlay registry. Screens not listed here fall back to the debug screen.
import type { OverlayKey, ScreenFactory, ScreenKey } from '../app';

export const SCREENS: Partial<Record<ScreenKey, ScreenFactory>> = {};
export const OVERLAYS: Partial<Record<OverlayKey, ScreenFactory>> = {};
