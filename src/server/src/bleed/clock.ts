import type { BleedClockState, BleedClockTickEvent, RunEndedEvent } from '@testament/shared';
import type { Room } from '../room/state.js';
import {
  bleedStageOf,
  DRAIN_MULT_STAGE2,
  DRAIN_MULT_STAGE3,
  type BleedStage,
} from '../room/state.js';

// Effective drain per second after applying stage bonus multipliers and any doctrine modifier.
function effectiveDrain(clock: BleedClockState, stage: BleedStage, drainMult = 1): number {
  let stageMult = 1;
  if (stage >= 3) stageMult = DRAIN_MULT_STAGE3;
  else if (stage >= 2) stageMult = DRAIN_MULT_STAGE2;
  return clock.drainPerSecond * stageMult * drainMult;
}

// Pure drain math. Single source of truth for the Bleed Clock.
// drainMult: optional doctrine modifier (Sanctum tier-1 sets to 0.9); defaults to 1.
export function tickBleedClock(
  clock: BleedClockState,
  deltaSeconds: number,
  drainMult = 1,
): { clock: BleedClockState; depleted: boolean; stage: BleedStage } {
  const stage = bleedStageOf(clock.current, clock.max);
  const drain = effectiveDrain(clock, stage, drainMult);
  const next = clock.current - drain * deltaSeconds;
  const current = Math.max(0, next); // R5: never negative
  return { clock: { ...clock, current }, depleted: current <= 0, stage };
}

// Applies one tick to a room and resolves run-end on depletion. Only an
// in-progress room can be ended by depletion (P5: terminal once).
export function advanceBleedForRoom(
  room: Room,
  deltaSeconds: number,
): { tick: BleedClockTickEvent; ended: RunEndedEvent | null } {
  const drainMult = room.bleedDrainMult ?? 1;
  const { clock, depleted, stage } = tickBleedClock(room.bleedClock, deltaSeconds, drainMult);
  room.bleedClock = clock;

  if (depleted && room.status === 'in-progress') {
    room.status = 'ended';
    room.outcome = 'wiped';
    return { tick: { clock, stage }, ended: { outcome: 'wiped', finalFloor: room.floor, enemiesKilled: room.enemiesKilled } };
  }

  return { tick: { clock, stage }, ended: null };
}

// Voluntary extraction: ends an in-progress run successfully and stops the clock.
export function extractRun(room: Room): { ok: true; ended: RunEndedEvent } | { ok: false } {
  if (room.status !== 'in-progress') return { ok: false };
  room.status = 'ended';
  room.outcome = 'extracted';
  return { ok: true, ended: { outcome: 'extracted', finalFloor: room.floor, enemiesKilled: room.enemiesKilled } };
}
