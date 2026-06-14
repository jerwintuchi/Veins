import { describe, it, expect } from 'vitest';
import type { BleedClockState, RunOutcome } from './bleedClock.js';
import { BLEED_TICK_INTERVAL_MS } from './bleedClock.js';
import type { BleedClockTickEvent, RunEndedEvent } from './events.js';

describe('bleed clock constants', () => {
  it('ticks once per second', () => {
    expect(BLEED_TICK_INTERVAL_MS).toBe(1000);
  });
});

describe('bleed clock types', () => {
  it('instantiate cleanly under strict mode', () => {
    const clock: BleedClockState = { current: 900, max: 1000, drainPerSecond: 1.5 };
    const outcome: RunOutcome = 'extracted';
    const tick: BleedClockTickEvent = { clock };
    const ended: RunEndedEvent = { outcome: 'wiped', finalFloor: 3 };

    expect(clock.max).toBe(1000);
    expect(outcome).toBe('extracted');
    expect(tick.clock.current).toBe(900);
    expect(ended.outcome).toBe('wiped');
  });
});
