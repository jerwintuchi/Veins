import { describe, it, expect } from 'vitest';
import { routeMessage } from './messageRouter.js';
import { RoomManager } from './RoomManager.js';
import { ReconnectTokenStore } from './ReconnectTokenStore.js';
import { SessionArchive } from './SessionArchive.js';
import type { EmitFn, EmitToFn, BroadcastFn } from './types.js';

function makeEmit(): { fn: EmitFn; calls: Array<[string, unknown]> } {
  const calls: Array<[string, unknown]> = [];
  return { fn: (t, p) => calls.push([t, p]), calls };
}
const noBroadcast: BroadcastFn = () => {};
const noEmitTo: EmitToFn = () => {};

function route(socketId: string, raw: string, mgr = new RoomManager(), store = new ReconnectTokenStore(), emit: EmitFn = () => {}) {
  routeMessage(socketId, raw, mgr, store, emit, noEmitTo, noBroadcast, new SessionArchive());
}

// T21 / T36: message router

describe('routeMessage', () => {
  it('dispatches CREATE_ROOM to the createRoom handler', () => {
    const mgr = new RoomManager();
    const store = new ReconnectTokenStore();
    const { fn: emit, calls } = makeEmit();
    routeMessage('sock-1', JSON.stringify({ type: 'CREATE_ROOM', payload: { displayName: 'Aldric' } }), mgr, store, emit, noEmitTo, noBroadcast, new SessionArchive());
    expect(calls[0]?.[0]).toBe('ROOM_CREATED');
  });

  it('emits LOBBY_ERROR INVALID_PAYLOAD for malformed JSON', () => {
    const { fn: emit, calls } = makeEmit();
    route('sock-1', 'not-json{', undefined, undefined, emit);
    expect(calls[0]?.[0]).toBe('LOBBY_ERROR');
    expect((calls[0]?.[1] as { code: string }).code).toBe('INVALID_PAYLOAD');
  });

  it('emits LOBBY_ERROR INVALID_PAYLOAD for a message with missing type field', () => {
    const { fn: emit, calls } = makeEmit();
    route('sock-1', JSON.stringify({ payload: {} }), undefined, undefined, emit);
    expect((calls[0]?.[1] as { code: string }).code).toBe('INVALID_PAYLOAD');
  });

  it('dispatches to handleUnknownMessage for unrecognized types', () => {
    const { fn: emit, calls } = makeEmit();
    route('sock-1', JSON.stringify({ type: 'MYSTERY', payload: {} }), undefined, undefined, emit);
    expect((calls[0]?.[1] as { code: string }).code).toBe('INVALID_PAYLOAD');
    expect((calls[0]?.[1] as { message: string }).message).toContain('MYSTERY');
  });

  it('dispatches DEPLOY envelope to the deploy handler', () => {
    const mgr = new RoomManager();
    const store = new ReconnectTokenStore();
    const { fn: emit, calls } = makeEmit();
    // Room must be in DEPLOYING phase; without setup it won't be, so we expect WRONG_PHASE or NOT_IN_ROOM.
    routeMessage('sock-1', JSON.stringify({ type: 'DEPLOY', payload: {} }), mgr, store, emit, noEmitTo, noBroadcast, new SessionArchive());
    // NOT_IN_ROOM confirms the DEPLOY handler was reached (not handleUnknownMessage).
    expect((calls[0]?.[1] as { code: string }).code).toBe('NOT_IN_ROOM');
  });

  it('dispatches EXTRACT envelope to the extract handler', () => {
    const mgr = new RoomManager();
    const store = new ReconnectTokenStore();
    const { fn: emit, calls } = makeEmit();
    routeMessage('sock-1', JSON.stringify({ type: 'EXTRACT', payload: {} }), mgr, store, emit, noEmitTo, noBroadcast, new SessionArchive());
    expect((calls[0]?.[1] as { code: string }).code).toBe('NOT_IN_ROOM');
  });

  it('dispatches PROBE envelope to the probe handler (T59)', () => {
    const mgr = new RoomManager();
    const store = new ReconnectTokenStore();
    const { fn: emit, calls } = makeEmit();
    routeMessage('sock-1', JSON.stringify({ type: 'PROBE', payload: { stimulus: 'FLAME' } }), mgr, store, emit, noEmitTo, noBroadcast, new SessionArchive());
    // NOT_IN_ROOM confirms the PROBE handler was reached (not handleUnknownMessage).
    expect((calls[0]?.[1] as { code: string }).code).toBe('NOT_IN_ROOM');
  });
});
