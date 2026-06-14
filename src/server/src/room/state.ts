import type { RelicBoard, Relic, RelicId, PlayerId, GamePhase } from '@veins/shared';

// Minimal Bleed Clock state. The full mechanic gets its own spec later;
// this exists now only so floor transitions have something to update (T6).
export type BleedClock = {
  current: number; // remaining dungeon HP
  max: number;
  drainPerSecond: number;
};

// In-memory game state for one room. Never persisted (netcode invariant I7).
export type Room = {
  id: string;
  players: PlayerId[];
  board: RelicBoard;
  registry: Map<RelicId, Relic>;
  phase: GamePhase;
  floor: number;
  bleedClock: BleedClock;
};

// Placeholder tuning — moves to the Bleed Clock spec when that work begins.
const BASE_DRAIN_PER_SECOND = 1;
const DRAIN_INCREASE_PER_FLOOR = 0.5;

// Deeper floors drain the Bleed Clock faster (DESIGN.md).
export function drainRateForFloor(floor: number): number {
  return BASE_DRAIN_PER_SECOND + (floor - 1) * DRAIN_INCREASE_PER_FLOOR;
}

// R5: descending a floor must NOT touch the Circulatory Board. Only the floor
// counter and the Bleed Clock drain rate change. The board carries over intact.
export function advanceFloor(room: Room): Room {
  const nextFloor = room.floor + 1;
  return {
    ...room,
    floor: nextFloor,
    bleedClock: {
      ...room.bleedClock,
      drainPerSecond: drainRateForFloor(nextFloor),
    },
    // board is intentionally carried over by reference — never reset.
  };
}
