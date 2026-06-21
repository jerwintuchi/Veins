import { describe, it, expect } from 'vitest';
import { generateDungeon } from '../dungeon/bsp.js';
import { RoomManager } from './manager.js';

// Deterministic code generator for tests: sequential codes.
function seqCodes() {
  let n = 0;
  return () => `CODE${n++}`;
}

describe('RoomManager.createRoom', () => {
  it('creates a lobby room with the host as the sole player', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const res = mgr.createRoom('host1');
    expect(res.ok).toBe(true);
    expect(res.room.status).toBe('lobby');
    expect(res.room.hostId).toBe('host1');
    expect(res.room.players).toEqual(['host1']);
  });

  it('issues unique codes even when the generator collides', () => {
    // Generator returns the same code twice, then a fresh one.
    const codes = ['DUP', 'DUP', 'FRESH'];
    let i = 0;
    const mgr = new RoomManager({ generateCode: () => codes[i++] ?? 'X' });
    const a = mgr.createRoom('h1');
    const b = mgr.createRoom('h2');
    expect(a.room.code).toBe('DUP');
    expect(b.room.code).toBe('FRESH');
  });
});

describe('RoomManager.joinRoom', () => {
  it('adds a player to a lobby room', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const { room } = mgr.createRoom('h1');
    const res = mgr.joinRoom(room.code, 'p2');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.room.players).toEqual(['h1', 'p2']);
  });

  it('rejects ROOM_NOT_FOUND for an unknown code', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const res = mgr.joinRoom('NOPE', 'p1');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('ROOM_NOT_FOUND');
  });

  it('rejects ROOM_FULL beyond 4 players', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const { room } = mgr.createRoom('h1');
    mgr.joinRoom(room.code, 'p2');
    mgr.joinRoom(room.code, 'p3');
    mgr.joinRoom(room.code, 'p4');
    const res = mgr.joinRoom(room.code, 'p5');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('ROOM_FULL');
  });

  it('rejects ALREADY_IN_ROOM for a duplicate player', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const { room } = mgr.createRoom('h1');
    const res = mgr.joinRoom(room.code, 'h1');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('ALREADY_IN_ROOM');
  });

  it('rejects ALREADY_STARTED once the run is in progress', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const { room } = mgr.createRoom('h1');
    mgr.joinRoom(room.code, 'p2');
    mgr.startRun(room.code);
    const res = mgr.joinRoom(room.code, 'p3');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('ALREADY_STARTED');
  });
});

describe('RoomManager.leaveRoom', () => {
  it('removes a player from the room', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const { room } = mgr.createRoom('h1');
    mgr.joinRoom(room.code, 'p2');
    const res = mgr.leaveRoom(room.code, 'p2');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.deleted).toBe(false);
    expect(res.room?.players).toEqual(['h1']);
  });

  it('deletes the room when the last player leaves', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const { room } = mgr.createRoom('h1');
    const res = mgr.leaveRoom(room.code, 'h1');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.deleted).toBe(true);
    expect(mgr.getRoom(room.code)).toBeUndefined();
  });

  it('reassigns the host when the host leaves', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const { room } = mgr.createRoom('h1');
    mgr.joinRoom(room.code, 'p2');
    const res = mgr.leaveRoom(room.code, 'h1');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.room?.hostId).toBe('p2');
  });

  it('rejects NOT_IN_ROOM when the player is not present', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const { room } = mgr.createRoom('h1');
    const res = mgr.leaveRoom(room.code, 'ghost');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('NOT_IN_ROOM');
  });
});

describe('RoomManager.startRun', () => {
  it('rejects NOT_ENOUGH_PLAYERS with fewer than 2 players', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const { room } = mgr.createRoom('h1');
    const res = mgr.startRun(room.code);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('NOT_ENOUGH_PLAYERS');
  });

  it('starts the run: in-progress status, generated dungeon, fully-owned board', () => {
    const mgr = new RoomManager({ generateCode: seqCodes(), generateRunId: () => 'fixed-run' });
    const { room } = mgr.createRoom('h1');
    mgr.joinRoom(room.code, 'p2');
    const res = mgr.startRun(room.code);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.room.status).toBe('in-progress');
    expect(res.room.floor).toBe(1);
    expect(res.room.runId).toBe('fixed-run');

    const slots = Object.values(res.room.board.slots);
    expect(slots).toHaveLength(19);
    for (const slot of slots) {
      expect(['h1', 'p2']).toContain(slot.ownerId);
      expect(slot.relicId).toBe(null);
    }
  });

  it('generates a dungeon deterministic from the run ID', () => {
    const mgr = new RoomManager({ generateCode: seqCodes(), generateRunId: () => 'fixed-run' });
    const { room } = mgr.createRoom('h1');
    mgr.joinRoom(room.code, 'p2');
    const res = mgr.startRun(room.code);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.dungeon).toEqual(generateDungeon('fixed-run'));
  });
});

describe('RoomManager — Bleed Clock integration', () => {
  function startedRoom(mgr: RoomManager) {
    const { room } = mgr.createRoom('h1');
    mgr.joinRoom(room.code, 'p2');
    mgr.startRun(room.code);
    return room.code;
  }

  it('activeRooms returns only in-progress rooms', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const lobbyOnly = mgr.createRoom('h1'); // stays in lobby
    const code = startedRoom(mgr);

    const active = mgr.activeRooms();
    expect(active.map(r => r.code)).toContain(code);
    expect(active.map(r => r.code)).not.toContain(lobbyOnly.room.code);
  });

  it('tickRoom drains the clock and ends the run on depletion', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const code = startedRoom(mgr);
    const room = mgr.getRoom(code)!;

    const before = room.bleedClock.current;
    const res = mgr.tickRoom(code, 1);
    expect(res).toBeDefined();
    expect(room.bleedClock.current).toBeLessThan(before);

    // Drain it to zero and confirm the run ends as wiped.
    room.bleedClock.current = room.bleedClock.drainPerSecond; // one tick from empty
    const end = mgr.tickRoom(code, 1);
    expect(end?.ended?.outcome).toBe('wiped');
    expect(room.status).toBe('ended');
  });

  it('tickRoom returns undefined for an unknown room', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    expect(mgr.tickRoom('NOPE', 1)).toBeUndefined();
  });

  it('extractRoom ends an in-progress run as extracted', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const code = startedRoom(mgr);
    const res = mgr.extractRoom(code);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.ended.outcome).toBe('extracted');
    expect(mgr.getRoom(code)?.status).toBe('ended');
  });

  it('extractRoom rejects a lobby (not in-progress) room', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const { room } = mgr.createRoom('h1');
    expect(mgr.extractRoom(room.code).ok).toBe(false);
  });

  it('descendRoom advances an in-progress run to the next floor', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    const code = startedRoom(mgr);
    const res = mgr.descendRoom(code);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.event.floor).toBe(2);
    expect(mgr.getRoom(code)?.floor).toBe(2);
  });

  it('descendRoom rejects an unknown code', () => {
    const mgr = new RoomManager({ generateCode: seqCodes() });
    expect(mgr.descendRoom('NOPE').ok).toBe(false);
  });
});
