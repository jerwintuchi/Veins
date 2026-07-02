import { describe, it, expect } from 'vitest';
import { handleCreateRoom } from './createRoom.js';
import { handleJoinRoom } from './joinRoom.js';
import { handleSocketDisconnect } from './disconnect.js';
import { RoomManager } from '../RoomManager.js';
import { ReconnectTokenStore } from '../ReconnectTokenStore.js';
import type { BroadcastFn } from '../types.js';

function makeBroadcast(): { fn: BroadcastFn; calls: Array<[string, string, unknown]> } {
  const calls: Array<[string, string, unknown]> = [];
  return { fn: (c, t, p) => calls.push([c, t, p]), calls };
}

function setup() {
  const mgr = new RoomManager();
  const store = new ReconnectTokenStore();
  let code = '';
  handleCreateRoom('host', { displayName: 'Host' }, mgr, store, (t, p) => {
    if (t === 'ROOM_CREATED') code = (p as { snapshot: { roomCode: string } }).snapshot.roomCode;
  });
  return { mgr, store, code };
}

// T19: disconnect handler

describe('handleSocketDisconnect', () => {
  it('disconnecting leader triggers leader reassignment and LOBBY_UPDATED to remaining players', () => {
    const { mgr, store, code } = setup();
    handleJoinRoom('p2-sock', { code, displayName: 'P2' }, mgr, store, () => {}, () => {});
    const { fn: broadcast, calls } = makeBroadcast();
    handleSocketDisconnect('host', mgr, broadcast);
    expect(calls[0]?.[1]).toBe('LOBBY_UPDATED');
    const snap = (calls[0]?.[2] as { snapshot: { players: Array<{ isLeader: boolean }> } }).snapshot;
    expect(snap.players.some(p => p.isLeader)).toBe(true);
  });

  it('non-leader disconnect keeps the player in snapshot (reconnect window) and broadcasts LOBBY_UPDATED', () => {
    const { mgr, store, code } = setup();
    handleJoinRoom('p2-sock', { code, displayName: 'P2' }, mgr, store, () => {}, () => {});
    const { fn: broadcast, calls } = makeBroadcast();
    handleSocketDisconnect('p2-sock', mgr, broadcast);
    const snap = (calls[0]?.[2] as { snapshot: { players: unknown[] } }).snapshot;
    // Both players still present in snapshot (p2 is disconnected but retained for reconnect).
    expect(snap.players).toHaveLength(2);
  });

  it('last player disconnecting destroys the room', () => {
    const { mgr, code } = setup();
    handleSocketDisconnect('host', mgr, () => {});
    expect(mgr.getRoom(code)).toBeUndefined();
  });
});
