import { describe, it, expect } from 'vitest';
import { descendFloor } from './progression.js';
import { drainRateForFloor, type Room } from '../room/state.js';
import { generateDungeon, STANDARD_DUNGEON_CONFIG } from '../dungeon/bsp.js';
import { buildInitialBoard } from '../board/layout.js';

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 'r',
    code: 'R',
    hostId: 'p1',
    status: 'in-progress',
    runId: 'run-1',
    players: ['p1', 'p2'],
    board: buildInitialBoard(['p1', 'p2'], 2),
    registry: new Map(),
    phase: 'loot',
    floor: 1,
    bleedClock: { current: 640, max: 1000, drainPerSecond: drainRateForFloor(1) },
    outcome: null,
    ...overrides,
  };
}

describe('descendFloor — happy path', () => {
  it('increments the floor and raises the drain rate (R1)', () => {
    const room = makeRoom();
    const before = room.bleedClock.drainPerSecond;
    const res = descendFloor(room);
    expect(res.ok).toBe(true);
    expect(room.floor).toBe(2);
    expect(room.bleedClock.drainPerSecond).toBe(drainRateForFloor(2));
    expect(room.bleedClock.drainPerSecond).toBeGreaterThan(before);
  });

  it('preserves the board and the clock current value (R3)', () => {
    const room = makeRoom();
    const boardSnapshot = JSON.stringify(room.board);
    const currentBefore = room.bleedClock.current;
    descendFloor(room);
    expect(JSON.stringify(room.board)).toBe(boardSnapshot);
    expect(room.bleedClock.current).toBe(currentBefore);
  });

  it('generates the new floor dungeon deterministically from (runId, floor) (R2)', () => {
    const room = makeRoom();
    const res = descendFloor(room);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.event.floor).toBe(2);
    expect(res.event.dungeon).toEqual(generateDungeon('run-1', STANDARD_DUNGEON_CONFIG, 2));
  });

  it('enters the combat phase on the new floor (R6)', () => {
    const room = makeRoom();
    descendFloor(room);
    expect(room.phase).toBe('combat');
  });

  it('advances correctly across multiple descents', () => {
    const room = makeRoom();
    descendFloor(room);
    const res = descendFloor(room);
    expect(room.floor).toBe(3);
    if (!res.ok) return;
    expect(res.event.dungeon).toEqual(generateDungeon('run-1', STANDARD_DUNGEON_CONFIG, 3));
  });
});

describe('descendFloor — rejection (R4)', () => {
  it('rejects when the run is not in progress and mutates nothing', () => {
    const room = makeRoom({ status: 'lobby', floor: 1 });
    const snapshot = JSON.stringify(room);
    const res = descendFloor(room);
    expect(res.ok).toBe(false);
    expect(JSON.stringify(room)).toBe(snapshot);
  });

  it('rejects an already-ended run', () => {
    const room = makeRoom({ status: 'ended', outcome: 'extracted' });
    expect(descendFloor(room).ok).toBe(false);
  });
});
