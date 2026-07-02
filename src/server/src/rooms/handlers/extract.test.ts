import { describe, it, expect } from 'vitest';
import { handleExtract } from './extract.js';
import { handleCreateRoom } from './createRoom.js';
import { handleAcceptContract } from './acceptContract.js';
import { handleDeploy } from './deploy.js';
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

function setupFieldRoom() {
  const mgr = new RoomManager();
  const store = new ReconnectTokenStore();
  const archive = new SessionArchive();
  let code = '';

  handleCreateRoom('host', { displayName: 'Host' }, mgr, store, (t, p) => {
    if (t === 'ROOM_CREATED') code = (p as { snapshot: { roomCode: string } }).snapshot.roomCode;
  });
  const room = mgr.getRoomBySocketId('host')!;
  room.players[0]!.readyState = true;
  handleAcceptContract('host', mgr, () => {}, () => {});
  handleDeploy('host', mgr, store, () => {}, (sid, t, p) => {}, () => {});

  return { mgr, store, archive, code };
}

// T34: EXTRACT handler

describe('handleExtract', () => {
  it('broadcasts FIELD_TESTAMENT then ARCHIVE_UPDATED in that order', () => {
    const { mgr, archive } = setupFieldRoom();
    const { fn: broadcast, calls } = makeBroadcast();
    handleExtract('host', mgr, archive, () => {}, broadcast);

    const types = calls.map(([, t]) => t);
    expect(types[0]).toBe('FIELD_TESTAMENT');
    expect(types[1]).toBe('ARCHIVE_UPDATED');
  });

  it('FIELD_TESTAMENT testament has no traitRoll key', () => {
    const { mgr, archive } = setupFieldRoom();
    const { fn: broadcast, calls } = makeBroadcast();
    handleExtract('host', mgr, archive, () => {}, broadcast);
    const testament = (calls[0]?.[2] as { testament: Record<string, unknown> }).testament;
    expect(Object.keys(testament)).not.toContain('traitRoll');
  });

  it('after extraction, getRoom returns undefined', () => {
    const { mgr, archive, code } = setupFieldRoom();
    handleExtract('host', mgr, archive, () => {}, () => {});
    expect(mgr.getRoom(code)).toBeUndefined();
  });

  it('after extraction, sessionArchive.getEntries returns empty array', () => {
    const { mgr, archive, code } = setupFieldRoom();
    handleExtract('host', mgr, archive, () => {}, () => {});
    expect(archive.getEntries(code)).toEqual([]);
  });

  it('EXTRACT in a DEPLOYING room emits LOBBY_ERROR WRONG_PHASE with no broadcasts', () => {
    const mgr = new RoomManager();
    const store = new ReconnectTokenStore();
    const archive = new SessionArchive();
    handleCreateRoom('host', { displayName: 'Host' }, mgr, store, () => {});
    const room = mgr.getRoomBySocketId('host')!;
    room.players[0]!.readyState = true;
    handleAcceptContract('host', mgr, () => {}, () => {});
    // Room is now DEPLOYING, not FIELD.
    const { fn: emit, calls } = makeEmit();
    const { fn: broadcast, calls: bcast } = makeBroadcast();
    handleExtract('host', mgr, archive, emit, broadcast);
    expect((calls[0]?.[1] as { code: string }).code).toBe('WRONG_PHASE');
    expect(bcast).toHaveLength(0);
  });

  it('sender not in any room emits LOBBY_ERROR NOT_IN_ROOM', () => {
    const { fn: emit, calls } = makeEmit();
    handleExtract('unknown', new RoomManager(), new SessionArchive(), emit, () => {});
    expect((calls[0]?.[1] as { code: string }).code).toBe('NOT_IN_ROOM');
  });
});
