import { describe, it, expect } from 'vitest';
import { handleCreateRoom } from './createRoom.js';
import { handleToggleReady } from './toggleReady.js';
import { RoomManager } from '../RoomManager.js';
import { ReconnectTokenStore } from '../ReconnectTokenStore.js';
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
  handleCreateRoom('host', { displayName: 'Host' }, mgr, store, () => {});
  const room = mgr.getRoomBySocketId('host')!;
  return { mgr, room };
}

// T14: TOGGLE_READY handler

describe('handleToggleReady', () => {
  it('flips readyState to true on first call and LOBBY_UPDATED reflects it', () => {
    const { mgr, room } = setup();
    const { fn: broadcast, calls } = makeBroadcast();
    handleToggleReady('host', mgr, () => {}, broadcast);
    expect(room.players[0]?.readyState).toBe(true);
    expect(calls[0]?.[1]).toBe('LOBBY_UPDATED');
    const snap = (calls[0]?.[2] as { snapshot: { players: Array<{ readyState: boolean }> } }).snapshot;
    expect(snap.players[0]?.readyState).toBe(true);
  });

  it('toggles back to false on second call', () => {
    const { mgr } = setup();
    handleToggleReady('host', mgr, () => {}, () => {});
    handleToggleReady('host', mgr, () => {}, () => {});
    expect(mgr.getRoomBySocketId('host')!.players[0]?.readyState).toBe(false);
  });

  it('emits LOBBY_ERROR NOT_IN_ROOM for an unknown socket', () => {
    const mgr = new RoomManager();
    const { fn: emit, calls } = makeEmit();
    handleToggleReady('ghost', mgr, emit, () => {});
    expect((calls[0]?.[1] as { code: string }).code).toBe('NOT_IN_ROOM');
  });

  it('emits LOBBY_ERROR for a socket in a DEPLOYING room', () => {
    const { mgr, room } = setup();
    room.phase = 'DEPLOYING';
    const { fn: emit, calls } = makeEmit();
    handleToggleReady('host', mgr, emit, () => {});
    expect(calls[0]?.[0]).toBe('LOBBY_ERROR');
  });
});
