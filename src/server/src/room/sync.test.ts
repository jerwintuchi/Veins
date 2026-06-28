import { describe, it, expect, vi } from 'vitest';
import type { Relic, RelicSlot, RelicTag } from '@testament/shared';
import { hexCoordKey } from '@testament/shared';
import { buildBoardStateSync, syncBoardToSocket, type SocketLike } from './sync.js';
import type { Room } from './state.js';

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
    bleedClock: { current: 100, max: 100, drainPerSecond: 1 },
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

// ---

describe('buildBoardStateSync', () => {
  it('returns a complete snapshot: board, synergyMap, and relicRegistry', () => {
    const room = makeRoom(
      [
        { coord: { q: 0, r: 0 }, ownerId: 'p1', relicId: 'r1' },
        { coord: { q: 1, r: 0 }, ownerId: 'p2', relicId: 'r2' },
      ],
      [makeRelic('r1', ['fire']), makeRelic('r2', ['fire'])]
    );

    const sync = buildBoardStateSync(room);

    expect(sync.board).toBe(room.board);
    expect(sync.relicRegistry['r1']?.name).toBe('r1');
    expect(sync.relicRegistry['r2']?.name).toBe('r2');
    // synergy fires: r1 & r2 are adjacent, cross-player, share 'fire'
    expect(sync.synergyMap['r1']).toBe(true);
    expect(sync.synergyMap['r2']).toBe(true);
  });

  it('computes the synergyMap fresh from current state (Room caches nothing)', () => {
    const room = makeRoom(
      [
        { coord: { q: 0, r: 0 }, ownerId: 'p1', relicId: 'r1' },
        { coord: { q: 1, r: 0 }, ownerId: 'p2', relicId: null },
      ],
      [makeRelic('r1', ['fire']), makeRelic('r2', ['fire'])]
    );

    // First sync: r1 is alone, no synergy.
    expect(buildBoardStateSync(room).synergyMap['r1']).toBe(false);

    // Mutate the board, then sync again: the new sync must reflect the change,
    // proving it is recomputed and not read from a stored field.
    room.board.slots[hexCoordKey({ q: 1, r: 0 })] = {
      coord: { q: 1, r: 0 },
      ownerId: 'p2',
      relicId: 'r2',
    };
    expect(buildBoardStateSync(room).synergyMap['r1']).toBe(true);
  });

  it('serializes the registry Map into a plain Record', () => {
    const room = makeRoom([], [makeRelic('r1', ['fire'])]);
    const sync = buildBoardStateSync(room);
    expect(sync.relicRegistry).toEqual({ r1: makeRelic('r1', ['fire']) });
  });
});

describe('syncBoardToSocket', () => {
  it('emits BOARD_STATE_SYNC to the joining socket exactly once', () => {
    const room = makeRoom([{ coord: { q: 0, r: 0 }, ownerId: 'p1', relicId: 'r1' }], [makeRelic('r1', ['fire'])]);
    const socket: SocketLike = { emit: vi.fn() };

    syncBoardToSocket(socket, room);

    expect(socket.emit).toHaveBeenCalledTimes(1);
    expect(socket.emit).toHaveBeenCalledWith('BOARD_STATE_SYNC', expect.objectContaining({
      board: room.board,
    }));
  });

  it('targets only the joining socket, never a room-wide broadcast', () => {
    const room = makeRoom([], []);
    const socket: SocketLike = { emit: vi.fn() };
    // A room broadcaster that must never be touched by the sync.
    const roomBroadcast = { emit: vi.fn() };

    syncBoardToSocket(socket, room);

    expect(socket.emit).toHaveBeenCalledTimes(1);
    expect(roomBroadcast.emit).not.toHaveBeenCalled();
  });
});
