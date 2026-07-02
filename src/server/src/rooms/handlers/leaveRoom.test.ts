import { describe, it, expect } from 'vitest';
import { handleCreateRoom } from './createRoom.js';
import { handleJoinRoom } from './joinRoom.js';
import { handleLeaveRoom } from './leaveRoom.js';
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

// T16: LEAVE_ROOM handler

describe('handleLeaveRoom', () => {
  it('broadcasts LOBBY_UPDATED with only remaining player after one leaves', () => {
    const { mgr, store, code } = setup();
    handleJoinRoom('p2-sock', { code, displayName: 'P2' }, mgr, store, () => {}, () => {});
    const { fn: broadcast, calls } = makeBroadcast();
    handleLeaveRoom('p2-sock', mgr, () => {}, broadcast);
    const snap = (calls[0]?.[2] as { snapshot: { players: unknown[] } }).snapshot;
    expect(snap.players).toHaveLength(1);
  });

  it('departing player is absent from broadcast snapshot', () => {
    const { mgr, store, code } = setup();
    handleJoinRoom('p2-sock', { code, displayName: 'P2' }, mgr, store, () => {}, () => {});
    const { fn: broadcast, calls } = makeBroadcast();
    handleLeaveRoom('p2-sock', mgr, () => {}, broadcast);
    const snap = (calls[0]?.[2] as { snapshot: { players: Array<{ displayName: string }> } }).snapshot;
    expect(snap.players.every(p => p.displayName !== 'P2')).toBe(true);
  });

  it('transfers leader to remaining player when leader leaves', () => {
    const { mgr, store, code } = setup();
    handleJoinRoom('p2-sock', { code, displayName: 'P2' }, mgr, store, () => {}, () => {});
    const { fn: broadcast, calls } = makeBroadcast();
    handleLeaveRoom('host', mgr, () => {}, broadcast);
    const snap = (calls[0]?.[2] as { snapshot: { players: Array<{ isLeader: boolean }> } }).snapshot;
    expect(snap.players[0]?.isLeader).toBe(true);
  });

  it('destroys the room when the last player leaves', () => {
    const { mgr, code } = setup();
    handleLeaveRoom('host', mgr, () => {}, () => {});
    expect(mgr.getRoom(code)).toBeUndefined();
  });

  it('does not broadcast LOBBY_UPDATED when room is destroyed', () => {
    const { mgr } = setup();
    const { fn: broadcast, calls } = makeBroadcast();
    handleLeaveRoom('host', mgr, () => {}, broadcast);
    expect(calls).toHaveLength(0);
  });
});
