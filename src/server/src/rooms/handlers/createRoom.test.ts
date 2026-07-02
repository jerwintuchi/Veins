import { describe, it, expect, vi } from 'vitest';
import { handleCreateRoom } from './createRoom.js';
import { RoomManager } from '../RoomManager.js';
import { ReconnectTokenStore } from '../ReconnectTokenStore.js';
import type { EmitFn } from '../types.js';

function makeEmit() {
  const calls: Array<[string, unknown]> = [];
  const fn: EmitFn = (type, payload) => calls.push([type, payload]);
  return { fn, calls };
}

// T12: CREATE_ROOM handler

describe('handleCreateRoom', () => {
  it('creates a room and emits ROOM_CREATED with one leader player and a reconnectToken', () => {
    const mgr = new RoomManager();
    const store = new ReconnectTokenStore();
    const { fn, calls } = makeEmit();

    handleCreateRoom('sock-1', { displayName: 'Aldric' }, mgr, store, fn);

    expect(calls).toHaveLength(1);
    const [type, payload] = calls[0]!;
    expect(type).toBe('ROOM_CREATED');
    const p = payload as { snapshot: { players: Array<{ isLeader: boolean; readyState: boolean }> }; reconnectToken: string };
    expect(p.snapshot.players).toHaveLength(1);
    expect(p.snapshot.players[0]?.isLeader).toBe(true);
    expect(p.snapshot.players[0]?.readyState).toBe(false);
    expect(typeof p.reconnectToken).toBe('string');
  });

  it('emits LOBBY_ERROR INVALID_PAYLOAD when displayName is missing', () => {
    const mgr = new RoomManager();
    const store = new ReconnectTokenStore();
    const { fn, calls } = makeEmit();

    handleCreateRoom('sock-1', {}, mgr, store, fn);

    expect(calls[0]?.[0]).toBe('LOBBY_ERROR');
    const p = calls[0]?.[1] as { code: string };
    expect(p.code).toBe('INVALID_PAYLOAD');
    // No room was created.
    expect(mgr.getRoomBySocketId('sock-1')).toBeUndefined();
  });

  it('emits LOBBY_ERROR INVALID_PAYLOAD when displayName is wrong type', () => {
    const { fn, calls } = makeEmit();
    handleCreateRoom('sock-1', { displayName: 42 }, new RoomManager(), new ReconnectTokenStore(), fn);
    expect(calls[0]?.[0]).toBe('LOBBY_ERROR');
  });

  it('emits LOBBY_ERROR when payload is not an object', () => {
    const { fn, calls } = makeEmit();
    handleCreateRoom('sock-1', 'bad', new RoomManager(), new ReconnectTokenStore(), fn);
    expect(calls[0]?.[0]).toBe('LOBBY_ERROR');
  });
});
