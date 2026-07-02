import { describe, it, expect } from 'vitest';
import { handleCreateRoom } from './createRoom.js';
import { handleToggleReady } from './toggleReady.js';
import { handleAcceptContract } from './acceptContract.js';
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
  return { mgr, store };
}

// T15: ACCEPT_CONTRACT handler

describe('handleAcceptContract', () => {
  it('solo leader who is ready transitions room to DEPLOYING and broadcasts ROOM_DEPLOYING', () => {
    const { mgr } = setup();
    handleToggleReady('host', mgr, () => {}, () => {});
    const { fn: broadcast, calls } = makeBroadcast();
    handleAcceptContract('host', mgr, () => {}, broadcast);
    expect(calls[0]?.[1]).toBe('ROOM_DEPLOYING');
    expect(mgr.getRoomBySocketId('host')!.phase).toBe('DEPLOYING');
  });

  it('ROOM_DEPLOYING payload includes ContractIntel with no traitRoll or expeditionSeed (R48)', () => {
    const { mgr } = setup();
    handleToggleReady('host', mgr, () => {}, () => {});
    const { fn: broadcast, calls } = makeBroadcast();
    handleAcceptContract('host', mgr, () => {}, broadcast);
    const payload = calls[0]?.[2] as { contract: Record<string, unknown> };
    expect(payload.contract).toBeDefined();
    expect(Object.keys(payload.contract)).not.toContain('traitRoll');
    expect(Object.keys(payload.contract)).not.toContain('expeditionSeed');
    expect(payload.contract['tier']).toBe('APPRENTICE');
    // server-side room.contract has the traitRoll
    const room = mgr.getRoomBySocketId('host')!;
    expect(room.contract?.traitRoll).toBeDefined();
  });

  it('emits LOBBY_ERROR NOT_LEADER for a non-leader socket', () => {
    const { mgr, store } = setup();
    // Manually add a second player
    const room = mgr.getRoomBySocketId('host')!;
    room.players.push({ playerId: 'p2', displayName: 'P2', socketId: 'p2-sock', isLeader: false, readyState: true, disconnectedAt: null, perceivedChannels: [] });
    const { fn: emit, calls } = makeEmit();
    handleAcceptContract('p2-sock', mgr, emit, () => {});
    expect((calls[0]?.[1] as { code: string }).code).toBe('NOT_LEADER');
    expect(room.phase).toBe('WAITING');
  });

  it('emits LOBBY_ERROR PARTY_NOT_READY when a player is not ready', () => {
    const { mgr } = setup();
    // host is not ready (readyState defaults to false)
    const { fn: emit, calls } = makeEmit();
    handleAcceptContract('host', mgr, emit, () => {});
    expect((calls[0]?.[1] as { code: string }).code).toBe('PARTY_NOT_READY');
    expect(mgr.getRoomBySocketId('host')!.phase).toBe('WAITING');
  });
});
