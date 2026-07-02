import { describe, it, expect } from 'vitest';
import { handleCreateRoom } from './createRoom.js';
import { handleReconnect } from './reconnect.js';
import { RoomManager } from '../RoomManager.js';
import { ReconnectTokenStore } from '../ReconnectTokenStore.js';
import { SessionArchive } from '../SessionArchive.js';
import type { EmitFn, BroadcastFn } from '../types.js';

function makeEmit(): { fn: EmitFn; calls: Array<[string, unknown]> } {
  const calls: Array<[string, unknown]> = [];
  return { fn: (t, p) => calls.push([t, p]), calls };
}
function makeBroadcast(): { fn: BroadcastFn; calls: Array<[string, string, unknown]> } {
  const calls: Array<[string, string, unknown]> = [];
  return { fn: (c, t, p) => calls.push([c, t, p]), calls };
}

function setup() {
  const mgr = new RoomManager();
  const store = new ReconnectTokenStore();
  const archive = new SessionArchive();
  let token = '';
  handleCreateRoom('host', { displayName: 'Host' }, mgr, store, (t, p) => {
    if (t === 'ROOM_CREATED') token = (p as { reconnectToken: string }).reconnectToken;
  });
  return { mgr, store, archive, token };
}

// T17: RECONNECT handler

describe('handleReconnect', () => {
  it('emits STATE_RESYNC only to reconnecting socket and broadcasts LOBBY_UPDATED to room', () => {
    const { mgr, store, archive, token } = setup();
    const room = mgr.getRoomBySocketId('host')!;
    room.players[0]!.socketId = '';
    room.players[0]!.disconnectedAt = Date.now();

    const { fn: emit, calls: emitCalls } = makeEmit();
    const { fn: broadcast, calls: bcastCalls } = makeBroadcast();

    handleReconnect('host-new', { token }, mgr, store, archive, emit, broadcast);

    expect(emitCalls.some(([t]) => t === 'STATE_RESYNC')).toBe(true);
    expect(bcastCalls.some(([, t]) => t === 'LOBBY_UPDATED')).toBe(true);
    expect(bcastCalls.some(([, t]) => t === 'STATE_RESYNC')).toBe(false);
  });

  it('STATE_RESYNC includes fieldSnapshot: null when room is in WAITING phase', () => {
    const { mgr, store, archive, token } = setup();
    const room = mgr.getRoomBySocketId('host')!;
    room.players[0]!.socketId = '';
    room.players[0]!.disconnectedAt = Date.now();
    const { fn: emit, calls } = makeEmit();
    handleReconnect('host-new', { token }, mgr, store, archive, emit, () => {});
    const resync = calls.find(([t]) => t === 'STATE_RESYNC');
    expect((resync?.[1] as { fieldSnapshot: unknown }).fieldSnapshot).toBeNull();
  });

  it('emits LOBBY_ERROR TOKEN_NOT_FOUND for an unknown token', () => {
    const { fn: emit, calls } = makeEmit();
    handleReconnect('sock', { token: 'bad-token' }, new RoomManager(), new ReconnectTokenStore(), new SessionArchive(), emit, () => {});
    expect((calls[0]?.[1] as { code: string }).code).toBe('TOKEN_NOT_FOUND');
  });

  it('emits LOBBY_ERROR ROOM_NOT_FOUND when room was destroyed while disconnected', () => {
    const { mgr, store, archive, token } = setup();
    const room = mgr.getRoomBySocketId('host')!;
    mgr.destroyRoom(room.code);
    const { fn: emit, calls } = makeEmit();
    handleReconnect('host-new', { token }, mgr, store, archive, emit, () => {});
    expect((calls[0]?.[1] as { code: string }).code).toBe('ROOM_NOT_FOUND');
  });
});
