import type { BleedClockState, BleedClockTickEvent, RunEndedEvent } from '@veins/shared';
import type { Room } from '../room/state.js';

// Pure drain math. Single source of truth for the Bleed Clock.
export function tickBleedClock(
  clock: BleedClockState,
  deltaSeconds: number
): { clock: BleedClockState; depleted: boolean } {
  const next = clock.current - clock.drainPerSecond * deltaSeconds;
  const current = Math.max(0, next); // R5: never negative
  return { clock: { ...clock, current }, depleted: current <= 0 };
}

// Applies one tick to a room and resolves run-end on depletion. Only an
// in-progress room can be ended by depletion (P5: terminal once).
export function advanceBleedForRoom(
  room: Room,
  deltaSeconds: number
): { tick: BleedClockTickEvent; ended: RunEndedEvent | null } {
  const { clock, depleted } = tickBleedClock(room.bleedClock, deltaSeconds);
  room.bleedClock = clock;

  if (depleted && room.status === 'in-progress') {
    room.status = 'ended';
    room.outcome = 'wiped';
    return { tick: { clock }, ended: { outcome: 'wiped', finalFloor: room.floor } };
  }

  return { tick: { clock }, ended: null };
}

// Voluntary extraction: ends an in-progress run successfully and stops the clock.
export function extractRun(room: Room): { ok: true; ended: RunEndedEvent } | { ok: false } {
  if (room.status !== 'in-progress') return { ok: false };
  room.status = 'ended';
  room.outcome = 'extracted';
  return { ok: true, ended: { outcome: 'extracted', finalFloor: room.floor } };
}
