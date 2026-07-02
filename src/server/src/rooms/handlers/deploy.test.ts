import { describe, it, expect } from 'vitest';
import { handleDeploy } from './deploy.js';
import { handleCreateRoom } from './createRoom.js';
import { handleAcceptContract } from './acceptContract.js';
import { handleToggleReady } from './toggleReady.js';
import { RoomManager } from '../RoomManager.js';
import { ReconnectTokenStore } from '../ReconnectTokenStore.js';
import type { EmitFn, EmitToFn, BroadcastFn } from '../types.js';

function makeEmit(): { fn: EmitFn; calls: Array<[string, unknown]> } {
  const calls: Array<[string, unknown]> = [];
  return { fn: (t, p) => calls.push([t, p]), calls };
}
function makeEmitTo(): { fn: EmitToFn; calls: Array<[string, string, unknown]> } {
  const calls: Array<[string, string, unknown]> = [];
  return { fn: (sid, t, p) => calls.push([sid, t, p]), calls };
}
const noBroadcast: BroadcastFn = () => {};

function setupDeployingRoom() {
  const mgr = new RoomManager();
  const store = new ReconnectTokenStore();

  handleCreateRoom('host', { displayName: 'Host' }, mgr, store, () => {});
  const room = mgr.getRoomBySocketId('host')!;
  room.players[0]!.readyState = true;

  // acceptContract transitions to DEPLOYING and attaches contract.
  const { fn: emit } = makeEmit();
  handleAcceptContract('host', mgr, emit, noBroadcast);
  return { mgr, store, room };
}

// T33: DEPLOY handler

describe('handleDeploy', () => {
  it('valid DEPLOY from leader sets phase to FIELD and emits FIELD_STARTED per player', () => {
    const { mgr, store } = setupDeployingRoom();
    const { fn: emitTo, calls: emitToCalls } = makeEmitTo();

    handleDeploy('host', mgr, store, () => {}, emitTo, noBroadcast);

    // Room is now in FIELD phase.
    const room = mgr.getRoomBySocketId('host')!;
    expect(room.phase).toBe('FIELD');
    expect(room.fieldData).not.toBeNull();

    // FIELD_STARTED emitted once per player (solo room: 1 player).
    const fieldStarted = emitToCalls.filter(([, t]) => t === 'FIELD_STARTED');
    expect(fieldStarted).toHaveLength(1);
    const payload = fieldStarted[0]?.[2] as { fieldData: { siteName: string }; reconnectToken: string };
    expect(typeof payload.fieldData.siteName).toBe('string');
    expect(payload.fieldData.siteName.length).toBeGreaterThan(0);
    expect(typeof payload.reconnectToken).toBe('string');
  });

  it('FIELD_STARTED payload includes signs array with no traitRoll (R49/R50)', () => {
    const { mgr, store } = setupDeployingRoom();
    const { fn: emitTo, calls: emitToCalls } = makeEmitTo();
    handleDeploy('host', mgr, store, () => {}, emitTo, noBroadcast);
    const payload = emitToCalls[0]?.[2] as Record<string, unknown>;
    // No server-only fields at top level.
    expect(Object.keys(payload)).not.toContain('traitRoll');
    expect(Object.keys(payload)).not.toContain('expeditionSeed');
    expect(Object.keys(payload.fieldData as object)).not.toContain('traitRoll');
    // signs is present and is an array.
    const signs = payload['signs'] as Array<Record<string, unknown>>;
    expect(Array.isArray(signs)).toBe(true);
    expect(signs.length).toBe(3);  // Apprentice tier: RESIDUE, STRESS_MARK, OMEN
    // Each sign has exactly channel and token.
    for (const sign of signs) {
      expect(Object.keys(sign).sort()).toEqual(['channel', 'token']);
    }
    // Signs channels are correct for Apprentice tier.
    expect(signs.map(s => s['channel'])).toEqual(['RESIDUE', 'STRESS_MARK', 'OMEN']);
    // No axis value literal in JSON output.
    const json = JSON.stringify(signs);
    for (const lit of ['EMBER', 'FROST', 'ROT', 'MIRE', 'FLAME', 'COLD', 'SALT', 'LIGHT', 'LUNGE', 'SWEEP', 'RECOIL', 'SHUDDER']) {
      expect(json).not.toContain(`"${lit}"`);
    }
  });

  it('resets exposure and revealedSigns when the field phase begins (T57, R57/R58)', () => {
    const { mgr, store } = setupDeployingRoom();
    const room = mgr.getRoomBySocketId('host')!;
    room.exposure = 7;
    room.revealedSigns = [{ channel: 'REACTION', token: 'no-reaction' }];

    handleDeploy('host', mgr, store, () => {}, () => {}, noBroadcast);

    expect(room.exposure).toBe(0);
    expect(room.revealedSigns).toEqual([]);
  });

  it('FIELD_STARTED signs contain no REACTION channel even when the tier has a ward (T60, P22)', () => {
    const { mgr, store } = setupDeployingRoom();
    const room = mgr.getRoomBySocketId('host')!;
    room.contract = {
      ...room.contract!,
      tier: 'JOURNEYMAN',
      traitRoll: { aspect: 'EMBER', frailty: 'FLAME', tell: 'LUNGE', ward: 'COLD', disposition: 'STALKER' },
    };
    const { fn: emitTo, calls: emitToCalls } = makeEmitTo();

    handleDeploy('host', mgr, store, () => {}, emitTo, noBroadcast);

    const payload = emitToCalls[0]?.[2] as { signs: Array<{ channel: string }> };
    expect(payload.signs.map(s => s.channel)).toEqual(['RESIDUE', 'STRESS_MARK', 'OMEN', 'SPOOR']);
  });

  // T64: distributed perception at deploy (R61, P25, P27, P28)

  it('solo player perceives the full tier channel set and receives all ambient signs (P27)', () => {
    const { mgr, store } = setupDeployingRoom();
    const { fn: emitTo, calls: emitToCalls } = makeEmitTo();

    handleDeploy('host', mgr, store, () => {}, emitTo, noBroadcast);

    const payload = emitToCalls[0]?.[2] as { signs: Array<{ channel: string }>; perceivedChannels: string[] };
    // Apprentice tier: ambient RESIDUE, STRESS_MARK, OMEN + probe-gated REACTION.
    expect(payload.perceivedChannels).toEqual(['RESIDUE', 'STRESS_MARK', 'REACTION', 'OMEN']);
    expect(payload.signs.map(s => s.channel)).toEqual(['RESIDUE', 'STRESS_MARK', 'OMEN']);
  });

  it('2-player room: every sign is within the receiving player\'s set; union covers the tier (P26, P28)', () => {
    const { mgr, store } = setupDeployingRoom();
    const room = mgr.getRoomBySocketId('host')!;
    room.players.push({
      playerId: 'p2', displayName: 'P2', socketId: 'p2-sock',
      isLeader: false, readyState: true, disconnectedAt: null, perceivedChannels: [],
    });
    const { fn: emitTo, calls: emitToCalls } = makeEmitTo();

    handleDeploy('host', mgr, store, () => {}, emitTo, noBroadcast);

    const payloads = emitToCalls
      .filter(([, t]) => t === 'FIELD_STARTED')
      .map(([, , p]) => p as { signs: Array<{ channel: string }>; perceivedChannels: string[] });
    expect(payloads).toHaveLength(2);
    const union = new Set<string>();
    for (const p of payloads) {
      expect(p.perceivedChannels.length).toBeGreaterThanOrEqual(2);
      for (const s of p.signs) expect(p.perceivedChannels).toContain(s.channel);
      p.perceivedChannels.forEach(c => union.add(c));
    }
    expect([...union].sort()).toEqual(['OMEN', 'REACTION', 'RESIDUE', 'STRESS_MARK']);
    // Assignment is stored server-side, keyed to the player entry (R63).
    expect(room.players[0]!.perceivedChannels.length).toBeGreaterThanOrEqual(2);
    expect(room.players[1]!.perceivedChannels.length).toBeGreaterThanOrEqual(2);
  });

  it('the same expedition seed yields the same assignment (P25)', () => {
    const run = () => {
      const { mgr, store } = setupDeployingRoom();
      const room = mgr.getRoomBySocketId('host')!;
      room.contract = { ...room.contract!, expeditionSeed: 'pinned-seed' };
      room.players.push({
        playerId: 'p2', displayName: 'P2', socketId: 'p2-sock',
        isLeader: false, readyState: true, disconnectedAt: null, perceivedChannels: [],
      });
      handleDeploy('host', mgr, store, () => {}, () => {}, noBroadcast);
      return room.players.map(p => p.perceivedChannels);
    };
    expect(run()).toEqual(run());
  });

  it('non-leader sender emits LOBBY_ERROR NOT_LEADER with zero state mutations', () => {
    const { mgr, store } = setupDeployingRoom();
    // Add a second player.
    const room = mgr.getRoomBySocketId('host')!;
    room.players.push({
      playerId: 'p2', displayName: 'P2', socketId: 'p2-sock',
      isLeader: false, readyState: true, disconnectedAt: null, perceivedChannels: [],
    });

    const { fn: emit, calls } = makeEmit();
    const { fn: emitTo, calls: emitToCalls } = makeEmitTo();
    handleDeploy('p2-sock', mgr, store, emit, emitTo, noBroadcast);

    expect((calls[0]?.[1] as { code: string }).code).toBe('NOT_LEADER');
    expect(emitToCalls).toHaveLength(0);
    expect(room.phase).toBe('DEPLOYING');
  });

  it('DEPLOY in a WAITING room emits LOBBY_ERROR WRONG_PHASE', () => {
    const mgr = new RoomManager();
    const store = new ReconnectTokenStore();
    handleCreateRoom('host', { displayName: 'Host' }, mgr, store, () => {});
    const { fn: emit, calls } = makeEmit();
    handleDeploy('host', mgr, store, emit, () => {}, noBroadcast);
    expect((calls[0]?.[1] as { code: string }).code).toBe('WRONG_PHASE');
  });

  it('sender not in any room emits LOBBY_ERROR NOT_IN_ROOM', () => {
    const { fn: emit, calls } = makeEmit();
    handleDeploy('unknown-sock', new RoomManager(), new ReconnectTokenStore(), emit, () => {}, noBroadcast);
    expect((calls[0]?.[1] as { code: string }).code).toBe('NOT_IN_ROOM');
  });
});
