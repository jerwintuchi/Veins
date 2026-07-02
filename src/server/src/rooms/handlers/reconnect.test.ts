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

  // T66: perception survives reconnection (R63, P29)

  it('a reconnecting player keeps the same perceivedChannels and gets a filtered snapshot', () => {
    const { mgr, store, archive, token } = setup();
    const room = mgr.getRoomBySocketId('host')!;
    room.phase = 'FIELD';
    room.contract = {
      contractId: 'c-001', tier: 'JOURNEYMAN',
      targetName: 'T', siteName: 'S', primaryVerb: 'INVESTIGATE',
      expeditionSeed: 'seed-1',
      traitRoll: { aspect: 'EMBER', frailty: 'FLAME', tell: 'LUNGE', ward: 'COLD', disposition: 'STALKER' },
    };
    room.fieldData = { fieldId: 'FIELD-001', siteName: 'S', incarnateName: 'T' };
    room.players[0]!.perceivedChannels = ['RESIDUE', 'REACTION'];
    room.revealedSigns = [{ channel: 'REACTION', token: 'drinks-cold' }];
    room.players[0]!.socketId = '';
    room.players[0]!.disconnectedAt = Date.now();

    const { fn: emit, calls } = makeEmit();
    handleReconnect('host-new', { token }, mgr, store, archive, emit, () => {});

    // The set is identical after reconnect (P29) and the snapshot is filtered to it (P28).
    expect(room.players[0]!.perceivedChannels).toEqual(['RESIDUE', 'REACTION']);
    const resync = calls.find(([t]) => t === 'STATE_RESYNC');
    const fs = (resync?.[1] as { fieldSnapshot: { signs: Array<{ channel: string; token: string }>; perceivedChannels: string[] } }).fieldSnapshot;
    expect(fs.perceivedChannels).toEqual(['RESIDUE', 'REACTION']);
    expect(fs.signs).toEqual([
      { channel: 'RESIDUE',  token: 'scorched-wax' },
      { channel: 'REACTION', token: 'drinks-cold' },
    ]);
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
