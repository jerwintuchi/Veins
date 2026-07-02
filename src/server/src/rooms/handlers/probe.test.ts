// T58: PROBE handler — validate, authorize, mutate, deliver (R54, R56, R57, P21, P23)
// T65: per-player delivery — only REACTION perceivers read the response (R62, P28)
import { describe, it, expect } from 'vitest';
import { handleProbe } from './probe.js';
import { handleCreateRoom } from './createRoom.js';
import { handleAcceptContract } from './acceptContract.js';
import { handleDeploy } from './deploy.js';
import { RoomManager } from '../RoomManager.js';
import { ReconnectTokenStore } from '../ReconnectTokenStore.js';
import type { EmitFn, EmitToFn } from '../types.js';
import type { Channel, ProbeResultPayload } from '@testament/shared';

function makeEmit(): { fn: EmitFn; calls: Array<[string, unknown]> } {
  const calls: Array<[string, unknown]> = [];
  return { fn: (t, p) => calls.push([t, p]), calls };
}
function makeEmitTo(): { fn: EmitToFn; calls: Array<[string, string, unknown]> } {
  const calls: Array<[string, string, unknown]> = [];
  return { fn: (sid, t, p) => calls.push([sid, t, p]), calls };
}

// Creates a solo room, walks it to FIELD phase, and pins a JOURNEYMAN contract
// with ward COLD so reaction outcomes are deterministic. The solo host perceives
// all channels (P27), so their probe results always carry the sign.
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

// Adds a second player to a field room with an explicit perception set.
function addPlayer(room: ReturnType<typeof setupFieldRoom>['room'], channels: Channel[]) {
  room.players.push({
    playerId: 'p2', displayName: 'P2', socketId: 'p2-sock',
    isLeader: false, readyState: true, disconnectedAt: null,
    perceivedChannels: channels,
  });
}

describe('handleProbe — validation (R54)', () => {
  it('missing stimulus → INVALID_PAYLOAD to sender only, no mutation, no delivery', () => {
    const { mgr, room } = setupFieldRoom();
    const { fn: emit, calls } = makeEmit();
    const { fn: emitTo, calls: sent } = makeEmitTo();

    handleProbe('host', {}, mgr, emit, emitTo);

    expect((calls[0]?.[1] as { code: string }).code).toBe('INVALID_PAYLOAD');
    expect(sent).toHaveLength(0);
    expect(room.exposure).toBe(0);
    expect(room.revealedSigns).toEqual([]);
  });

  it('non-stimulus string → INVALID_PAYLOAD, no mutation', () => {
    const { mgr, room } = setupFieldRoom();
    const { fn: emit, calls } = makeEmit();
    const { fn: emitTo, calls: sent } = makeEmitTo();

    handleProbe('host', { stimulus: 'WATER' }, mgr, emit, emitTo);

    expect((calls[0]?.[1] as { code: string }).code).toBe('INVALID_PAYLOAD');
    expect(sent).toHaveLength(0);
    expect(room.exposure).toBe(0);
  });

  it('sender not in any room → NOT_IN_ROOM', () => {
    const { fn: emit, calls } = makeEmit();
    const { fn: emitTo, calls: sent } = makeEmitTo();

    handleProbe('stranger', { stimulus: 'FLAME' }, new RoomManager(), emit, emitTo);

    expect((calls[0]?.[1] as { code: string }).code).toBe('NOT_IN_ROOM');
    expect(sent).toHaveLength(0);
  });

  it('PROBE outside FIELD phase → WRONG_PHASE, no mutation', () => {
    const mgr = new RoomManager();
    const store = new ReconnectTokenStore();
    handleCreateRoom('host', { displayName: 'Host' }, mgr, store, () => {});
    const room = mgr.getRoomBySocketId('host')!;
    const { fn: emit, calls } = makeEmit();
    const { fn: emitTo, calls: sent } = makeEmitTo();

    handleProbe('host', { stimulus: 'FLAME' }, mgr, emit, emitTo);

    expect((calls[0]?.[1] as { code: string }).code).toBe('WRONG_PHASE');
    expect(sent).toHaveLength(0);
    expect(room.exposure).toBe(0);
  });
});

describe('handleProbe — success path (R54, R57)', () => {
  it('valid probe delivers one PROBE_RESULT per player with playerId, stimulus, sign, exposure', () => {
    const { mgr, room } = setupFieldRoom();
    const { fn: emitTo, calls: sent } = makeEmitTo();

    handleProbe('host', { stimulus: 'COLD' }, mgr, () => {}, emitTo);

    expect(sent).toHaveLength(1); // solo room: one player
    expect(sent[0]?.[0]).toBe('host');
    expect(sent[0]?.[1]).toBe('PROBE_RESULT');
    const payload = sent[0]?.[2] as ProbeResultPayload;
    expect(payload.playerId).toBe(room.players[0]!.playerId);
    expect(payload.stimulus).toBe('COLD');
    expect(payload.sign).toEqual({ channel: 'REACTION', token: 'drinks-cold' });
    expect(payload.exposure).toBe(1);
  });

  it('a miss returns the no-reaction sign and still costs exposure', () => {
    const { mgr, room } = setupFieldRoom();
    const { fn: emitTo, calls: sent } = makeEmitTo();

    handleProbe('host', { stimulus: 'FLAME' }, mgr, () => {}, emitTo);

    const payload = sent[0]?.[2] as ProbeResultPayload;
    expect(payload.sign).toEqual({ channel: 'REACTION', token: 'no-reaction' });
    expect(room.exposure).toBe(1);
  });

  it('any player may probe, not only the leader', () => {
    const { mgr, room } = setupFieldRoom();
    addPlayer(room, ['REACTION', 'SPOOR']);
    const { fn: emitTo, calls: sent } = makeEmitTo();

    handleProbe('p2-sock', { stimulus: 'SALT' }, mgr, () => {}, emitTo);

    expect(sent).toHaveLength(2); // one delivery per player
    expect((sent[0]?.[2] as ProbeResultPayload).playerId).toBe('p2');
  });

  it('repeat probes keep costing exposure but revealedSigns stays deduped (R57/R58)', () => {
    const { mgr, room } = setupFieldRoom();
    const { fn: emitTo } = makeEmitTo();

    handleProbe('host', { stimulus: 'COLD' }, mgr, () => {}, emitTo);
    handleProbe('host', { stimulus: 'COLD' }, mgr, () => {}, emitTo);
    handleProbe('host', { stimulus: 'FLAME' }, mgr, () => {}, emitTo);

    expect(room.exposure).toBe(3);
    expect(room.revealedSigns).toEqual([
      { channel: 'REACTION', token: 'drinks-cold' },
      { channel: 'REACTION', token: 'no-reaction' },
    ]);
  });
});

describe('handleProbe — per-player perception filtering (T65, R62, P28)', () => {
  it('only REACTION perceivers receive the sign; others get sign: null', () => {
    const { mgr, room } = setupFieldRoom();
    room.players[0]!.perceivedChannels = ['RESIDUE', 'OMEN'];       // host cannot read REACTION
    addPlayer(room, ['REACTION', 'SPOOR']);                          // p2 can
    const { fn: emitTo, calls: sent } = makeEmitTo();

    handleProbe('host', { stimulus: 'COLD' }, mgr, () => {}, emitTo);

    const byId = new Map(sent.map(([sid, , p]) => [sid, p as ProbeResultPayload]));
    // The prober rang the bell blind: they cannot read the response.
    expect(byId.get('host')?.sign).toBeNull();
    expect(byId.get('p2-sock')?.sign).toEqual({ channel: 'REACTION', token: 'drinks-cold' });
    // Everyone still sees who probed, with what, and the cost.
    for (const p of byId.values()) {
      expect(p.playerId).toBe(room.players[0]!.playerId);
      expect(p.stimulus).toBe('COLD');
      expect(p.exposure).toBe(1);
    }
  });

  it('exposure accrues once per probe regardless of receiver count', () => {
    const { mgr, room } = setupFieldRoom();
    addPlayer(room, ['REACTION']);
    const { fn: emitTo } = makeEmitTo();

    handleProbe('host', { stimulus: 'SALT' }, mgr, () => {}, emitTo);

    expect(room.exposure).toBe(1);
  });
});

describe('handleProbe — trait containment (R56, P21)', () => {
  it('a miss payload never names the ward value', () => {
    const { mgr } = setupFieldRoom(); // ward is COLD
    const { fn: emitTo, calls: sent } = makeEmitTo();

    handleProbe('host', { stimulus: 'LIGHT' }, mgr, () => {}, emitTo);

    const json = JSON.stringify(sent[0]?.[2]);
    expect(json).not.toContain('COLD');
    expect(json).not.toContain('cold');
    expect(json).not.toContain('traitRoll');
    expect(json).not.toContain('expeditionSeed');
    expect(json).not.toContain('"ward"');
  });

  it('the sign carries exactly channel and token', () => {
    const { mgr } = setupFieldRoom();
    const { fn: emitTo, calls: sent } = makeEmitTo();

    handleProbe('host', { stimulus: 'COLD' }, mgr, () => {}, emitTo);

    const payload = sent[0]?.[2] as ProbeResultPayload;
    expect(Object.keys(payload).sort()).toEqual(['exposure', 'playerId', 'sign', 'stimulus']);
    expect(Object.keys(payload.sign!).sort()).toEqual(['channel', 'token']);
  });
});
