import { describe, it, expect } from 'vitest';
import type { RoomSummary, JoinRoomRequest, RunStartedEvent, LobbyErrorEvent } from './lobby.js';
import { MAX_PLAYERS, MIN_PLAYERS_TO_START, HEX_BOARD_RADIUS } from './lobby.js';

describe('lobby constants', () => {
  it('have the expected values', () => {
    expect(MAX_PLAYERS).toBe(4);
    expect(MIN_PLAYERS_TO_START).toBe(2);
    expect(HEX_BOARD_RADIUS).toBe(2);
  });
});

describe('lobby types', () => {
  it('instantiate cleanly under strict mode', () => {
    const summary: RoomSummary = {
      code: 'ABCDE',
      status: 'lobby',
      hostId: 'p1',
      players: ['p1', 'p2'],
    };
    const join: JoinRoomRequest = { code: 'ABCDE', playerId: 'p3' };
    const err: LobbyErrorEvent = { code: 'ROOM_FULL', message: 'full' };

    expect(summary.status).toBe('lobby');
    expect(join.playerId).toBe('p3');
    expect(err.code).toBe('ROOM_FULL');

    // RunStartedEvent shape compiles (structurally checked).
    const started: Pick<RunStartedEvent, 'board' | 'synergyMap'> = {
      board: { slots: {} },
      synergyMap: {},
    };
    expect(started.board.slots).toEqual({});
  });
});
