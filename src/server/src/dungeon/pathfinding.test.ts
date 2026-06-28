import { describe, it, expect } from 'vitest';
import type { DungeonLayout } from '@testament/shared';
import { findNextWaypoint } from './pathfinding.js';

// Room-0 (top-left) and room-1 (bottom-right) connected by an L-shaped corridor.
// The direct diagonal path between them passes through the wall — forcing A*.
function makeDiagonalRoomDungeon(): DungeonLayout {
  return {
    runId: 'path-test',
    width: 100, height: 100,
    rooms: [
      { id: 'room-0', rect: { x: 0, y: 0, width: 10, height: 10 } },
      { id: 'room-1', rect: { x: 80, y: 80, width: 10, height: 10 } },
    ],
    corridors: [{
      fromRoomId: 'room-0', toRoomId: 'room-1',
      from: { x: 5, y: 5 }, // centre of room-0
      to:   { x: 85, y: 85 }, // centre of room-1
      // L-shape: horizontal at y=4..6 x=5..85, vertical at x=84..86 y=5..85.
    }],
  };
}

// Large flat room — everything inside is walkable; LOS always clear.
function makeFlatDungeon(size = 512): DungeonLayout {
  return {
    runId: 'flat', width: size, height: size,
    rooms: [{ id: 'room-0', rect: { x: 0, y: 0, width: size, height: size } }],
    corridors: [],
  };
}

// Two isolated rooms, no corridor — goal is unreachable.
function makeIsolatedDungeon(): DungeonLayout {
  return {
    runId: 'isolated', width: 60, height: 20,
    rooms: [
      { id: 'room-0', rect: { x: 0, y: 0, width: 10, height: 10 } },
      { id: 'room-1', rect: { x: 50, y: 0, width: 10, height: 10 } },
    ],
    corridors: [],
  };
}

describe('findNextWaypoint (T5, R3, P3)', () => {
  it('returns null when start and goal are in the same tile', () => {
    const dungeon = makeFlatDungeon();
    expect(findNextWaypoint(5.2, 7.8, 5.9, 7.1, dungeon)).toBeNull();
  });

  it('returns null (direct movement) when line-of-sight to goal is clear (flat dungeon)', () => {
    // LOS clear → no A* needed → direct fallback is optimal, null signals that.
    const dungeon = makeFlatDungeon();
    expect(findNextWaypoint(10, 10, 100, 10, dungeon)).toBeNull();
  });

  it('returns null for a 1-step adjacent move when LOS is clear', () => {
    const dungeon = makeFlatDungeon();
    expect(findNextWaypoint(10, 10, 11, 10, dungeon)).toBeNull();
  });

  it('navigates around a wall — direct path blocked, routes through L-shaped corridor (R3)', () => {
    const dungeon = makeDiagonalRoomDungeon();
    // Enemy at room-0 centre (5,5), player at room-1 centre (85,85).
    // Direct diagonal path passes through wall at ≈(45,45); corridor runs horizontally
    // at y=4..6 then vertically at x=84..86. A* routes right along y=5, then down.
    const wp = findNextWaypoint(5.5, 5.5, 85.5, 85.5, dungeon);
    expect(wp).not.toBeNull();
    // First step should move right along the horizontal corridor segment (x > 5).
    expect(wp!.x).toBeGreaterThan(5.5);
    // y stays near the corridor level (y=4..6), not drifting diagonally toward 85.
    expect(wp!.y).toBeLessThan(8);
  });

  it('returns null when the goal is completely unreachable (P3)', () => {
    const dungeon = makeIsolatedDungeon();
    expect(findNextWaypoint(5, 5, 55, 5, dungeon)).toBeNull();
  });

  it('terminates without throwing on a large open dungeon (P3)', () => {
    const dungeon = makeFlatDungeon(500);
    expect(() => findNextWaypoint(0, 0, 499, 499, dungeon)).not.toThrow();
  });
});
