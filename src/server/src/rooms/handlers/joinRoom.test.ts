import { describe, it, expect } from 'vitest';
import { handleCreateRoom } from './createRoom.js';
import { handleJoinRoom } from './joinRoom.js';
import { RoomManager } from '../RoomManager.js';
import { ReconnectTokenStore } from '../ReconnectTokenStore.js';
import type { EmitFn, BroadcastFn } from '../types.js';

function makeEmit() {
  const calls: Array<[string, unknown]> = [];
  const fn: EmitFn = (t, p) => calls.push([t, p]);
  return { fn, calls };
}
function makeBroadcast() {
  const calls: Array<[string, string, unknown]> = [];
  const fn: BroadcastFn = (code, t, p) => calls.push([code, t, p]);
  return { fn, calls };
}

function createRoomAndGetCode(mgr: RoomManager, store: ReconnectTokenStore): string {
  let code = '';
  handleCreateRoom('host-sock', { displayName: 'Host' }, mgr, store, (type, payload) => {
    if (type === 'ROOM_CREATED') {
      code = (payload as { snapshot: { roomCode: string } }).snapshot.roomCode;
    }
  });
  return code;
}

// T13: JOIN_ROOM handler

describe('handleJoinRoom', () => {
  it('adds player and broadcasts LOBBY_UPDATED to all including the joiner', () => {
    const mgr = new RoomManager();
    const store = new ReconnectTokenStore();
    const code = createRoomAndGetCode(mgr, store);
    const { fn: emit, calls: emitCalls } = makeEmit();
    const { fn: broadcast, calls: bcastCalls } = makeBroadcast();

    handleJoinRoom('joiner-sock', { code, displayName: 'Seeker' }, mgr, store, emit, broadcast);

    expect(bcastCalls[0]?.[1]).toBe('LOBBY_UPDATED');
    const snap = (bcastCalls[0]?.[2] as { snapshot: { players: Array<{ readyState: boolean }> } }).snapshot;
    expect(snap.players).toHaveLength(2);
    expect(snap.players[1]?.readyState).toBe(false);
    // joiner gets a reconnect token
    expect(emitCalls.some(([t]) => t === 'RECONNECT_TOKEN')).toBe(true);
  });

  it('emits LOBBY_ERROR ROOM_NOT_FOUND for an unknown code', () => {
    const { fn: emit, calls } = makeEmit();
    const { fn: broadcast, calls: bcastCalls } = makeBroadcast();
    handleJoinRoom('sock', { code: 'XXXXXX', displayName: 'X' }, new RoomManager(), new ReconnectTokenStore(), emit, broadcast);
    expect(calls[0]?.[0]).toBe('LOBBY_ERROR');
    expect((calls[0]?.[1] as { code: string }).code).toBe('ROOM_NOT_FOUND');
    expect(bcastCalls).toHaveLength(0);
  });

  it('emits LOBBY_ERROR ROOM_FULL when room has 4 players', () => {
    const mgr = new RoomManager();
    const store = new ReconnectTokenStore();
    const code = createRoomAndGetCode(mgr, store);
    // Fill to 4
    for (let i = 0; i < 3; i++) {
      handleJoinRoom(`s${i}`, { code, displayName: `P${i}` }, mgr, store, () => {}, () => {});
    }
    const { fn: emit, calls } = makeEmit();
    handleJoinRoom('extra', { code, displayName: 'Extra' }, mgr, store, emit, () => {});
    expect((calls[0]?.[1] as { code: string }).code).toBe('ROOM_FULL');
  });

  it('emits LOBBY_ERROR ALREADY_DEPLOYING when room is in DEPLOYING phase', () => {
    const mgr = new RoomManager();
    const store = new ReconnectTokenStore();
    const code = createRoomAndGetCode(mgr, store);
    // Manually set phase to DEPLOYING
    const room = mgr.getRoom(code)!;
    room.phase = 'DEPLOYING';
    const { fn: emit, calls } = makeEmit();
    handleJoinRoom('sock', { code, displayName: 'Late' }, mgr, store, emit, () => {});
    expect((calls[0]?.[1] as { code: string }).code).toBe('ALREADY_DEPLOYING');
  });

  it('does not broadcast when an error occurs', () => {
    const { fn: broadcast, calls: bcastCalls } = makeBroadcast();
    handleJoinRoom('sock', { code: 'BAD', displayName: 'X' }, new RoomManager(), new ReconnectTokenStore(), () => {}, broadcast);
    expect(bcastCalls).toHaveLength(0);
  });
});
