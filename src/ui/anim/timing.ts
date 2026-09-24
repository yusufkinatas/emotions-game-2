// Animation timing: every wait goes through app.dur (speed setting, instant mode) and ends early the
// moment the player asks to fast-forward (a click, Space or Enter sets app.skipping).

import type { App } from '../app';

export interface Clock {
  app: App;
  /** 2 when many events are queued (18.3: auto-speed to 2x). */
  speed: number;
}

/** A reference duration in real ms after the speed setting, skipping and auto-speed. */
export const ms = (clock: Clock, t: number): number => clock.app.dur(t) / clock.speed;

function sleepReal(app: App, real: number): Promise<void> {
  if (real <= 0 || app.skipping) return Promise.resolve();
  const end = performance.now() + real;
  return new Promise((resolve) => {
    const tick = () => {
      if (app.skipping || performance.now() >= end) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** Wait t reference ms, scaled and skippable. */
export const wait = (clock: Clock, t: number): Promise<void> => sleepReal(clock.app, ms(clock, t));

/** Wait until at least t reference ms have passed since `since` (a performance.now() stamp). */
export const waitSince = (clock: Clock, since: number, t: number): Promise<void> =>
  sleepReal(clock.app, ms(clock, t) - (performance.now() - since));
