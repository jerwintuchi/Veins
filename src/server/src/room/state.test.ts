import { describe, it, expect } from 'vitest';
import type { Relic, RelicSlot, RelicTag } from '@testament/shared';
import { hexCoordKey } from '@testament/shared';
import { advanceFloor, drainRateForFloor, type Room } from './state.js';

// --- test helpers ---

function makeRelic(id: string, tags: RelicTag[]): Relic {
  return { id, name: id, tags, baseEffect: { description: '' }, synergyEffect: { description: '' } };
}

function makeRoom(slots: RelicSlot[], relics: Relic[]): Room {
  return {
    id: 'room1',
    code: 'ROOM1',
    hostId: 'p1',
    status: 'in-progress',
    runId: 'run-1',
    players: ['p1', 'p2'],
    board: { slots: Object.fromEntries(slots.map(s => [hexCoordKey(s.coord), s])) },
    registry: new Map(relics.map(r => [r.id, r])),
    phase: 'loot',
    floor: 1,
    bleedClock: { current: 100, max: 100, drainPerSecond: drainRateForFloor(1) },
    outcome: null,
    dungeon: null,
    enemies: new Map(),
    playerStates: new Map(),
    aimStates: new Map(),
    projectiles: new Map(),
    weaponCooldowns: new Map(),
    playerMoveInputs: new Map(),
    nextProjectileId: 0,
  };
}

// T4 — R2: Room carries combat state maps.
describe('Room combat state fields (T4, R2)', () => {
  it('a freshly constructed room has an empty enemies map', () => {
    const room = makeRoom([], []);
    expect(room.enemies.size).toBe(0);
  });

  it('a freshly constructed room has an empty playerStates map (populated on run start)', () => {
    const room = makeRoom([], []);
    expect(room.playerStates.size).toBe(0);
  });
});

// T3 — R4: Room carries aimStates map, initialized on run start.
describe('Room.aimStates (T3, R4)', () => {
  it('a freshly constructed room has an empty aimStates map', () => {
    const room = makeRoom([], []);
    expect(room.aimStates.size).toBe(0);
  });
});

// T2 (weapon spec) — R3: Room carries weapon state maps.
describe('Room weapon state fields (T2-weapon, R3)', () => {
  it('projectiles is an empty Map on construction', () => {
    const room = makeRoom([], []);
    expect(room.projectiles.size).toBe(0);
  });

  it('weaponCooldowns is an empty Map on construction (populated on run start)', () => {
    const room = makeRoom([], []);
    expect(room.weaponCooldowns.size).toBe(0);
  });

  it('playerMoveInputs is an empty Map on construction (populated on run start)', () => {
    const room = makeRoom([], []);
    expect(room.playerMoveInputs.size).toBe(0);
  });

  it('nextProjectileId starts at 0', () => {
    const room = makeRoom([], []);
    expect(room.nextProjectileId).toBe(0);
  });
});

// ---

describe('drainRateForFloor', () => {
  it('increases with depth (deeper floors drain faster)', () => {
    expect(drainRateForFloor(1)).toBeLessThan(drainRateForFloor(2));
    expect(drainRateForFloor(2)).toBeLessThan(drainRateForFloor(3));
  });
});

describe('advanceFloor — R5: board persists across floor transitions', () => {
  const room = makeRoom(
    [
      { coord: { q: 0, r: 0 }, ownerId: 'p1', relicId: 'r1' },
      { coord: { q: 1, r: 0 }, ownerId: 'p2', relicId: 'r2' },
    ],
    [makeRelic('r1', ['fire']), makeRelic('r2', ['fire'])]
  );

  it('leaves the board deeply equal before and after the transition', () => {
    const before = JSON.stringify(room.board);
    const next = advanceFloor(room);
    expect(JSON.stringify(next.board)).toBe(before);
  });

  it('increments the floor number while leaving board slots unchanged', () => {
    const next = advanceFloor(room);
    expect(next.floor).toBe(room.floor + 1);
    expect(next.board.slots).toEqual(room.board.slots);
  });

  it('updates the Bleed Clock drain rate on transition', () => {
    const next = advanceFloor(room);
    expect(next.bleedClock.drainPerSecond).toBe(drainRateForFloor(next.floor));
    expect(next.bleedClock.drainPerSecond).toBeGreaterThan(room.bleedClock.drainPerSecond);
  });

  it('preserves relic placements and ownership exactly across the transition', () => {
    const next = advanceFloor(room);
    const slot = next.board.slots[hexCoordKey({ q: 0, r: 0 })];
    expect(slot?.relicId).toBe('r1');
    expect(slot?.ownerId).toBe('p1');
  });

  it('does not mutate the original room', () => {
    const snapshot = JSON.stringify(room);
    advanceFloor(room);
    expect(JSON.stringify(room)).toBe(snapshot);
  });
});
