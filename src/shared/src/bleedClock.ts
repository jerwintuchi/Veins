// Bleed Clock types + constants. Types/constants only (invariant I4).

export type BleedClockState = {
  current: number; // remaining dungeon HP
  max: number;
  drainPerSecond: number;
};

export type RunOutcome = 'extracted' | 'wiped';

// How often the server ticks and broadcasts the clock.
export const BLEED_TICK_INTERVAL_MS = 1000;
