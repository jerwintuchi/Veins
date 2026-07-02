import { describe, it, expect } from 'vitest';
import { RoomManager } from './RoomManager.js';

// T5: RoomManager

describe('RoomManager.createRoom', () => {
  it('returns a WAITING room with the creator as leader', () => {
    const mgr = new RoomManager();
    const room = mgr.createRoom('sock-1', 'Aldric');
    expect(room.phase).toBe('WAITING');
    expect(room.players).toHaveLength(1);
    expect(room.players[0]?.isLeader).toBe(true);
    expect(room.players[0]?.readyState).toBe(false);
    expect(room.players[0]?.socketId).toBe('sock-1');
  });

  it('generates a unique code for each room', () => {
    const mgr = new RoomManager();
    const r1 = mgr.createRoom('s1', 'A');
    const r2 = mgr.createRoom('s2', 'B');
    expect(r1.code).not.toBe(r2.code);
  });

  it('starts with zero exposure and no revealed signs (T57, R57/R58)', () => {
    const mgr = new RoomManager();
    const room = mgr.createRoom('sock-1', 'Aldric');
    expect(room.exposure).toBe(0);
    expect(room.revealedSigns).toEqual([]);
  });
});

describe('RoomManager.getRoom', () => {
  it('returns the room by code', () => {
    const mgr = new RoomManager();
    const room = mgr.createRoom('sock-1', 'Aldric');
    expect(mgr.getRoom(room.code)).toBe(room);
  });

  it('returns undefined for an unknown code', () => {
    const mgr = new RoomManager();
    expect(mgr.getRoom('XXXXXX')).toBeUndefined();
  });
});

describe('RoomManager.getRoomBySocketId', () => {
  it('returns the room containing the given socket', () => {
    const mgr = new RoomManager();
    const room = mgr.createRoom('sock-1', 'Aldric');
    expect(mgr.getRoomBySocketId('sock-1')).toBe(room);
  });

  it('returns undefined for an unknown socket', () => {
    const mgr = new RoomManager();
    expect(mgr.getRoomBySocketId('unknown')).toBeUndefined();
  });
});

describe('RoomManager.destroyRoom', () => {
  it('removes the room so getRoom returns undefined', () => {
    const mgr = new RoomManager();
    const room = mgr.createRoom('sock-1', 'Aldric');
    mgr.destroyRoom(room.code);
    expect(mgr.getRoom(room.code)).toBeUndefined();
  });
});
