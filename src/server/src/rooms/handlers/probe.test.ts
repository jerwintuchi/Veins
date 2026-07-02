// T58: PROBE handler — validate, authorize, mutate, broadcast (R54, R56, R57, P21, P23)
import { describe, it, expect } from 'vitest';
import { handleProbe } from './probe.js';
import { handleCreateRoom } from './createRoom.js';
import { handleAcceptContract } from './acceptContract.js';
import { handleDeploy } from './deploy.js';
import { RoomManager } from '../RoomManager.js';
import { ReconnectTokenStore } from '../ReconnectTokenStore.js';
import type { EmitFn, BroadcastFn } from '../types.js';
import type { ProbeResultPayload } from '@testament/shared';

function makeEmit(): { fn: EmitFn; calls: Array<[string, unknown]> } {
  const calls: Array<[string, unknown]> = [];
  return { fn: (t, p) => calls.push([t, p]), calls };
}
function makeBroadcast(): { fn: BroadcastFn; calls: Array<[string, string, unknown]> } {
  const calls: Array<[string, string, unknown]> = [];
  return { fn: (code, t, p) => calls.push([code, t, p]), calls };
}

// Creates a solo room, walks it to FIELD phase, and pins a JOURNEYMAN contract
// with ward COLD so reaction outcomes are deterministic.
function setupFieldRoom() {
  const mgr = new RoomManager();
  const store = new ReconnectTokenStore();
  handleCreateRoom('host', { displayName: 'Host' }, mgr, store, () => {});
  const room = mgr.getRoomBySocketId('host')!;
  room.players[0]!.readyState = true;
  handleAcceptContract('host', mgr, () => {}, () => {});
  room.contract = {
    ...room.contract!,
    tier: 'JOURNEYMAN',
    traitRoll: { aspect: 'EMBER', frailty: 'FLAME', tell: 'LUNGE', ward: 'COLD', disposition: 'STALKER' },
  };
  handleDeploy('host', mgr, store, () => {}, () => {}, () => {});
  return { mgr, room };
}

describe('handleProbe — validation (R54)', () => {
  it('missing stimulus → INVALID_PAYLOAD to sender only, no mutation, no broadcast', () => {
    const { mgr, room } = setupFieldRoom();
    const { fn: emit, calls } = makeEmit();
    const { fn: broadcast, calls: broadcasts } = makeBroadcast();

    handleProbe('host', {}, mgr, emit, broadcast);

    expect((calls[0]?.[1] as { code: string }).code).toBe('INVALID_PAYLOAD');
    expect(broadcasts).toHaveLength(0);
    expect(room.exposure).toBe(0);
    expect(room.revealedSigns).toEqual([]);
  });

  it('non-stimulus string → INVALID_PAYLOAD, no mutation', () => {
    const { mgr, room } = setupFieldRoom();
    const { fn: emit, calls } = makeEmit();
    const { fn: broadcast, calls: broadcasts } = makeBroadcast();

    handleProbe('host', { stimulus: 'WATER' }, mgr, emit, broadcast);

    expect((calls[0]?.[1] as { code: string }).code).toBe('INVALID_PAYLOAD');
    expect(broadcasts).toHaveLength(0);
    expect(room.exposure).toBe(0);
  });

  it('sender not in any room → NOT_IN_ROOM', () => {
    const { fn: emit, calls } = makeEmit();
    const { fn: broadcast, calls: broadcasts } = makeBroadcast();

    handleProbe('stranger', { stimulus: 'FLAME' }, new RoomManager(), emit, broadcast);

    expect((calls[0]?.[1] as { code: string }).code).toBe('NOT_IN_ROOM');
    expect(broadcasts).toHaveLength(0);
  });

  it('PROBE outside FIELD phase → WRONG_PHASE, no mutation', () => {
    const mgr = new RoomManager();
    const store = new ReconnectTokenStore();
    handleCreateRoom('host', { displayName: 'Host' }, mgr, store, () => {});
    const room = mgr.getRoomBySocketId('host')!;
    const { fn: emit, calls } = makeEmit();
    const { fn: broadcast, calls: broadcasts } = makeBroadcast();

    handleProbe('host', { stimulus: 'FLAME' }, mgr, emit, broadcast);

    expect((calls[0]?.[1] as { code: string }).code).toBe('WRONG_PHASE');
    expect(broadcasts).toHaveLength(0);
    expect(room.exposure).toBe(0);
  });
});

describe('handleProbe — success path (R54, R57)', () => {
  it('valid probe broadcasts exactly one PROBE_RESULT with playerId, stimulus, sign, exposure', () => {
    const { mgr, room } = setupFieldRoom();
    const { fn: broadcast, calls: broadcasts } = makeBroadcast();

    handleProbe('host', { stimulus: 'COLD' }, mgr, () => {}, broadcast);

    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0]?.[0]).toBe(room.code);
    expect(broadcasts[0]?.[1]).toBe('PROBE_RESULT');
    const payload = broadcasts[0]?.[2] as ProbeResultPayload;
    expect(payload.playerId).toBe(room.players[0]!.playerId);
    expect(payload.stimulus).toBe('COLD');
    expect(payload.sign).toEqual({ channel: 'REACTION', token: 'drinks-cold' });
    expect(payload.exposure).toBe(1);
  });

  it('a miss returns the no-reaction sign and still costs exposure', () => {
    const { mgr, room } = setupFieldRoom();
    const { fn: broadcast, calls: broadcasts } = makeBroadcast();

    handleProbe('host', { stimulus: 'FLAME' }, mgr, () => {}, broadcast);

    const payload = broadcasts[0]?.[2] as ProbeResultPayload;
    expect(payload.sign).toEqual({ channel: 'REACTION', token: 'no-reaction' });
    expect(room.exposure).toBe(1);
  });

  it('any player may probe, not only the leader', () => {
    const { mgr, room } = setupFieldRoom();
    room.players.push({
      playerId: 'p2', displayName: 'P2', socketId: 'p2-sock',
      isLeader: false, readyState: true, disconnectedAt: null,
    });
    const { fn: broadcast, calls: broadcasts } = makeBroadcast();

    handleProbe('p2-sock', { stimulus: 'SALT' }, mgr, () => {}, broadcast);

    expect(broadcasts).toHaveLength(1);
    expect((broadcasts[0]?.[2] as ProbeResultPayload).playerId).toBe('p2');
  });

  it('repeat probes keep costing exposure but revealedSigns stays deduped (R57/R58)', () => {
    const { mgr, room } = setupFieldRoom();
    const { fn: broadcast } = makeBroadcast();

    handleProbe('host', { stimulus: 'COLD' }, mgr, () => {}, broadcast);
    handleProbe('host', { stimulus: 'COLD' }, mgr, () => {}, broadcast);
    handleProbe('host', { stimulus: 'FLAME' }, mgr, () => {}, broadcast);

    expect(room.exposure).toBe(3);
    expect(room.revealedSigns).toEqual([
      { channel: 'REACTION', token: 'drinks-cold' },
      { channel: 'REACTION', token: 'no-reaction' },
    ]);
  });
});

describe('handleProbe — trait containment (R56, P21)', () => {
  it('a miss payload never names the ward value', () => {
    const { mgr } = setupFieldRoom(); // ward is COLD
    const { fn: broadcast, calls: broadcasts } = makeBroadcast();

    handleProbe('host', { stimulus: 'LIGHT' }, mgr, () => {}, broadcast);

    const json = JSON.stringify(broadcasts[0]?.[2]);
    expect(json).not.toContain('COLD');
    expect(json).not.toContain('cold');
    expect(json).not.toContain('traitRoll');
    expect(json).not.toContain('expeditionSeed');
    expect(json).not.toContain('"ward"');
  });

  it('the sign carries exactly channel and token', () => {
    const { mgr } = setupFieldRoom();
    const { fn: broadcast, calls: broadcasts } = makeBroadcast();

    handleProbe('host', { stimulus: 'COLD' }, mgr, () => {}, broadcast);

    const payload = broadcasts[0]?.[2] as ProbeResultPayload;
    expect(Object.keys(payload).sort()).toEqual(['exposure', 'playerId', 'sign', 'stimulus']);
    expect(Object.keys(payload.sign).sort()).toEqual(['channel', 'token']);
  });
});
