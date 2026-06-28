import { describe, it, expect } from 'vitest';
import type { BleedClockState } from '@veins/shared';
import { tickBleedClock, advanceBleedForRoom, extractRun } from './clock.js';
import { drainRateForFloor, advanceFloor, type Room } from '../room/state.js';

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 'r',
    code: 'R',
    hostId: 'p1',
    status: 'in-progress',
    runId: 'run-1',
    players: ['p1', 'p2'],
    board: { slots: {} },
    registry: new Map(),
    phase: 'loot',
    floor: 1,
    bleedClock: { current: 100, max: 100, drainPerSecond: 10 },
    outcome: null,
    dungeon: null,
    enemies: new Map(),
    playerStates: new Map(),
    aimStates: new Map(),
    projectiles: new Map(),
    weaponCooldowns: new Map(),
    playerMoveInputs: new Map(),
    nextProjectileId: 0,
    lootPools: {},
    placedThisLootPhase: new Set(),
    fireDurations: new Map(),
    combatRng: { next: () => 0 } as never,
    enemiesKilled: 0,
    ...overrides,
  };
}

// --- T2: pure tick math ---

describe('tickBleedClock', () => {
  it('reduces current by drainPerSecond * dt', () => {
    const clock: BleedClockState = { current: 100, max: 100, drainPerSecond: 10 };
    expect(tickBleedClock(clock, 1).clock.current).toBe(90);
    expect(tickBleedClock(clock, 2).clock.current).toBe(80);
  });

  it('clamps current at 0 and never goes negative, even for huge dt', () => {
    const clock: BleedClockState = { current: 5, max: 100, drainPerSecond: 10 };
    expect(tickBleedClock(clock, 100).clock.current).toBe(0);
  });

  it('reports depleted exactly when current reaches 0 (stage 0, no multiplier)', () => {
    // current=90/max=100 → 10% bled → stage 0 → base drain, no bonus
    const clock: BleedClockState = { current: 90, max: 100, drainPerSecond: 90 };
    expect(tickBleedClock(clock, 0.5).depleted).toBe(false); // drains 45, remains 45
    expect(tickBleedClock(clock, 1).depleted).toBe(true);    // drains 90, reaches 0
  });

  it('stage 3 (≥80% bled) applies 2× drain multiplier', () => {
    // current=5/max=100 → 95% bled → stage 3 → effective drain = drainPerSecond × 2.0
    const clock: BleedClockState = { current: 5, max: 100, drainPerSecond: 5 };
    expect(tickBleedClock(clock, 0.4).depleted).toBe(false); // effective drain=10, drains 4, remains 1
    expect(tickBleedClock(clock, 0.5).depleted).toBe(true);  // effective drain=10, drains 5, reaches 0
  });

  it('is deterministic and does not mutate the input clock', () => {
    const clock: BleedClockState = { current: 50, max: 100, drainPerSecond: 7 };
    const a = tickBleedClock(clock, 1.5);
    const b = tickBleedClock(clock, 1.5);
    expect(a).toEqual(b);
    expect(clock.current).toBe(50); // unchanged
  });
});

// --- T3: room transitions ---

describe('advanceBleedForRoom', () => {
  it('returns ended:null and stays in-progress on a non-depleting tick', () => {
    const room = makeRoom({ bleedClock: { current: 100, max: 100, drainPerSecond: 10 } });
    const res = advanceBleedForRoom(room, 1);
    expect(res.ended).toBeNull();
    expect(room.status).toBe('in-progress');
    expect(room.bleedClock.current).toBe(90);
  });

  it('ends the run as wiped when the clock depletes', () => {
    const room = makeRoom({ floor: 3, bleedClock: { current: 5, max: 100, drainPerSecond: 10 } });
    const res = advanceBleedForRoom(room, 1);
    expect(room.status).toBe('ended');
    expect(room.outcome).toBe('wiped');
    expect(res.ended).toEqual({ outcome: 'wiped', finalFloor: 3, enemiesKilled: 0 });
  });

  it('does not re-end an already-ended room (terminal once)', () => {
    const room = makeRoom({ status: 'ended', outcome: 'extracted', bleedClock: { current: 0, max: 100, drainPerSecond: 10 } });
    const res = advanceBleedForRoom(room, 1);
    expect(res.ended).toBeNull();
    expect(room.outcome).toBe('extracted'); // unchanged
  });
});

describe('extractRun', () => {
  it('ends an in-progress run as extracted', () => {
    const room = makeRoom({ floor: 2 });
    const res = extractRun(room);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(room.status).toBe('ended');
    expect(room.outcome).toBe('extracted');
    expect(res.ended).toEqual({ outcome: 'extracted', finalFloor: 2, enemiesKilled: 0 });
  });

  it('rejects extraction when the run is not in progress', () => {
    const room = makeRoom({ status: 'lobby' });
    const res = extractRun(room);
    expect(res.ok).toBe(false);
    expect(room.status).toBe('lobby'); // no change
  });
});

// --- depth scaling (R2/R6) ---

describe('depth scaling', () => {
  it('drainRateForFloor strictly increases with depth', () => {
    expect(drainRateForFloor(1)).toBeLessThan(drainRateForFloor(2));
    expect(drainRateForFloor(2)).toBeLessThan(drainRateForFloor(3));
  });

  it('advanceFloor preserves current clock value but raises the drain rate', () => {
    const room = makeRoom({ floor: 1, bleedClock: { current: 73, max: 100, drainPerSecond: drainRateForFloor(1) } });
    const next = advanceFloor(room);
    expect(next.bleedClock.current).toBe(73); // tension carries over
    expect(next.bleedClock.drainPerSecond).toBeGreaterThan(room.bleedClock.drainPerSecond);
  });
});
