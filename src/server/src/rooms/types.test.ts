import { describe, it, expect } from 'vitest';
import type { ServerPlayerEntry, RoomRecord } from './types.js';
import type { LobbyPlayer } from '@testament/shared';
import { toPublicPlayer } from './types.js';

// T4: server-only types

describe('ServerPlayerEntry', () => {
  it('has socketId and disconnectedAt fields', () => {
    const entry: ServerPlayerEntry = {
      playerId: 'p1',
      displayName: 'Aldric',
      socketId: 'sock-1',
      isLeader: true,
      readyState: false,
      disconnectedAt: null,
    };
    expect(entry.socketId).toBe('sock-1');
    expect(entry.disconnectedAt).toBeNull();
  });
});

describe('toPublicPlayer', () => {
  it('strips socketId and disconnectedAt from the output', () => {
    const entry: ServerPlayerEntry = {
      playerId: 'p1',
      displayName: 'Aldric',
      socketId: 'sock-1',
      isLeader: true,
      readyState: false,
      disconnectedAt: 1234567890,
    };
    const pub: LobbyPlayer = toPublicPlayer(entry);
    expect(pub.playerId).toBe('p1');
    expect('socketId' in pub).toBe(false);
    expect('disconnectedAt' in pub).toBe(false);
  });
});

describe('RoomRecord shape', () => {
  it('constructs with required fields including fieldData', () => {
    const room: RoomRecord = {
      code: 'ABC123',
      phase: 'WAITING',
      players: [],
      contract: null,
      fieldData: null,
      exposure: 0,
      revealedSigns: [],
    };
    expect(room.phase).toBe('WAITING');
    expect(room.contract).toBeNull();
    expect(room.fieldData).toBeNull();
    expect(room.exposure).toBe(0);
    expect(room.revealedSigns).toEqual([]);
  });

  it('fieldData is absent from LobbyPlayer (server-only field)', () => {
    const entry: ServerPlayerEntry = {
      playerId: 'p1', displayName: 'Aldric', socketId: 's1',
      isLeader: true, readyState: false, disconnectedAt: null,
    };
    const pub = toPublicPlayer(entry);
    expect('fieldData' in pub).toBe(false);
    expect('socketId' in pub).toBe(false);
    expect('disconnectedAt' in pub).toBe(false);
  });
});
