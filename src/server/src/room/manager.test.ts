import { describe, it, expect } from 'vitest';
import { RoomManager } from './manager.js';

// Deterministic generators so room codes and run seeds are predictable in tests.
function makeManager() {
  const codes = ['AAAA', 'BBBB', 'CCCC'];
  let ci = 0;
  return new RoomManager({
    generateCode: () => codes[ci++ % codes.length] as string,
    generateRunId: () => 'run-1',
  });
}

describe('RoomManager lifecycle', () => {
  it('creates a lobby room with the host as the only player', () => {
    const m = makeManager();
    const { room } = m.createRoom('host');
    expect(room.status).toBe('lobby');
    expect(room.players).toEqual(['host']);
    expect(room.hostId).toBe('host');
    expect(m.getRoom(room.code)).toBe(room);
  });

  it('joins an existing lobby room', () => {
    const m = makeManager();
    const { room } = m.createRoom('host');
    const res = m.joinRoom(room.code, 'p2');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.room.players).toEqual(['host', 'p2']);
  });

  it('rejects join for unknown room, full room, duplicate, and a started run', () => {
    const m = makeManager();
    expect(m.joinRoom('ZZZZ', 'p').ok).toBe(false);
    const { room } = m.createRoom('host');
    m.joinRoom(room.code, 'p2');
    m.joinRoom(room.code, 'p3');
    m.joinRoom(room.code, 'p4');
    expect(m.joinRoom(room.code, 'p5').ok).toBe(false); // full (MAX_PLAYERS = 4)
    expect(m.joinRoom(room.code, 'host').ok).toBe(false); // duplicate
    m.startRun(room.code);
    expect(m.joinRoom(room.code, 'pX').ok).toBe(false); // already started
  });

  it('reassigns host then deletes the room as players leave', () => {
    const m = makeManager();
    const { room } = m.createRoom('host');
    m.joinRoom(room.code, 'p2');
    const left = m.leaveRoom(room.code, 'host');
    expect(left.ok).toBe(true);
    if (left.ok && left.room) expect(left.room.hostId).toBe('p2');
    const empty = m.leaveRoom(room.code, 'p2');
    expect(empty.ok && empty.deleted).toBe(true);
    expect(m.getRoom(room.code)).toBeUndefined();
  });

  it('starts a run: in-progress, dungeon generated, players placed at the entry', () => {
    const m = makeManager();
    const { room } = m.createRoom('host');
    const res = m.startRun(room.code);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.room.status).toBe('in-progress');
      expect(res.room.dungeon).not.toBeNull();
      const ps = res.room.playerStates.get('host');
      expect(ps).toBeDefined();
      expect(typeof ps?.x).toBe('number');
      expect(typeof ps?.y).toBe('number');
    }
    expect(m.activeRooms().map(r => r.code)).toContain(room.code);
  });

  it('refuses to start a run that is not in a lobby', () => {
    const m = makeManager();
    const { room } = m.createRoom('host');
    m.startRun(room.code);
    expect(m.startRun(room.code).ok).toBe(false);
  });

  it('retains a disconnected player in an in-progress run and allows rejoin', () => {
    const m = makeManager();
    const { room } = m.createRoom('host');
    m.joinRoom(room.code, 'p2');
    m.startRun(room.code);
    const dc = m.markDisconnected(room.code, 'p2');
    expect(dc.ok && dc.mode).toBe('disconnected');
    expect(room.players).toContain('p2'); // membership retained
    expect(m.rejoin(room.code, 'p2').ok).toBe(true);
  });

  it('deletes an in-progress run once every player has disconnected', () => {
    const m = makeManager();
    const { room } = m.createRoom('host');
    m.startRun(room.code);
    const dc = m.markDisconnected(room.code, 'host');
    expect(dc.ok && dc.deleted).toBe(true);
    expect(m.getRoom(room.code)).toBeUndefined();
  });

  it('treats a disconnect in a lobby as a leave', () => {
    const m = makeManager();
    const { room } = m.createRoom('host');
    m.joinRoom(room.code, 'p2');
    const dc = m.markDisconnected(room.code, 'host');
    expect(dc.ok && dc.mode).toBe('left');
  });

  it('rejects rejoin for a non-member or a run that is not in progress', () => {
    const m = makeManager();
    const { room } = m.createRoom('host');
    expect(m.rejoin(room.code, 'host').ok).toBe(false); // still a lobby
    m.startRun(room.code);
    expect(m.rejoin(room.code, 'stranger').ok).toBe(false); // not a member
  });
});
