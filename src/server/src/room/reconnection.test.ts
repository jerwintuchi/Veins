import { describe, it, expect } from 'vitest';
import { RoomManager } from './manager.js';
import { buildStateResync, syncResyncToSocket } from './sync.js';
import { registerHandlers, type ServerSocket, type SocketIOServerLike } from '../index.js';

// Deterministic manager: unique codes via counter, fixed runId.
function makeManager(): RoomManager {
  let n = 0;
  return new RoomManager({ generateCode: () => `ROOM${n++}`, generateRunId: () => 'run-fixed' });
}

// Creates an in-progress room with the given players (first is host).
function startedRoom(m: RoomManager, players: string[]): { code: string; room: ReturnType<RoomManager['getRoom']> } {
  const create = m.createRoom(players[0]!);
  const code = create.room.code;
  for (const p of players.slice(1)) m.joinRoom(code, p);
  const res = m.startRun(code);
  if (!res.ok) throw new Error('startRun failed');
  return { code, room: res.room };
}

// --- Fake Socket.io harness (mirrors index.test.ts) ---
function makeFakeIo() {
  const roomEmits: Array<{ room: string; event: string; payload: unknown }> = [];
  let connectionHandler: ((socket: ServerSocket) => void) | undefined;
  const io: SocketIOServerLike = {
    on: (_event, listener) => { connectionHandler = listener; },
    to: (room: string) => ({ emit: (event, payload) => roomEmits.push({ room, event, payload }) }),
  };
  return { io, roomEmits, connect: () => connectionHandler };
}

function makeFakeSocket(id: string, auth: Record<string, unknown> = {}): ServerSocket & {
  handlers: Map<string, (payload: unknown) => void>;
  emits: Array<{ event: string; payload: unknown }>;
  joined: string[];
} {
  const handlers = new Map<string, (payload: unknown) => void>();
  const emits: Array<{ event: string; payload: unknown }> = [];
  const joined: string[] = [];
  return {
    id,
    data: {},
    handshake: { auth },
    handlers,
    emits,
    joined,
    on: (event, listener) => handlers.set(event, listener),
    emit: (event, payload) => emits.push({ event, payload }),
    join: (room) => joined.push(room),
  };
}

describe('RoomManager.markDisconnected (R2)', () => {
  it('retains the player in an in-progress run and flags them disconnected', () => {
    const m = makeManager();
    const { code, room } = startedRoom(m, ['p1', 'p2']);
    const res = m.markDisconnected(code, 'p1');
    expect(res.ok && res.mode).toBe('disconnected');
    expect(res.ok && res.deleted).toBe(false);
    expect(room!.players).toContain('p1');             // ownership preserved (P3)
    expect(room!.disconnectedPlayers!.has('p1')).toBe(true);
    expect(m.getRoom(code)).toBeDefined();
  });

  it('removes the player (mode "left") when the room is still a lobby', () => {
    const m = makeManager();
    const code = m.createRoom('p1').room.code;
    m.joinRoom(code, 'p2');
    const res = m.markDisconnected(code, 'p2');
    expect(res.ok && res.mode).toBe('left');
    expect(m.getRoom(code)!.players).not.toContain('p2');
  });

  it('deletes an in-progress room once every player is disconnected', () => {
    const m = makeManager();
    const { code } = startedRoom(m, ['p1', 'p2']);
    m.markDisconnected(code, 'p1');
    const res = m.markDisconnected(code, 'p2');
    expect(res.ok && res.deleted).toBe(true);
    expect(m.getRoom(code)).toBeUndefined();
  });

  it('returns ok:false for a non-member', () => {
    const m = makeManager();
    const { code } = startedRoom(m, ['p1', 'p2']);
    expect(m.markDisconnected(code, 'stranger')).toEqual({ ok: false });
  });
});

describe('RoomManager.rejoin (R3)', () => {
  it('succeeds for a member of an in-progress run and clears the flag', () => {
    const m = makeManager();
    const { code, room } = startedRoom(m, ['p1', 'p2']);
    m.markDisconnected(code, 'p1');
    const res = m.rejoin(code, 'p1');
    expect(res.ok).toBe(true);
    expect(room!.disconnectedPlayers!.has('p1')).toBe(false);
  });

  it('fails with CANNOT_REJOIN for a non-member', () => {
    const m = makeManager();
    const { code } = startedRoom(m, ['p1', 'p2']);
    const res = m.rejoin(code, 'stranger');
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error.code).toBe('CANNOT_REJOIN');
  });

  it('fails with ROOM_NOT_FOUND for an unknown code', () => {
    const m = makeManager();
    const res = m.rejoin('NOPE', 'p1');
    expect(!res.ok && res.error.code).toBe('ROOM_NOT_FOUND');
  });

  it('fails with CANNOT_REJOIN for a room that is still a lobby', () => {
    const m = makeManager();
    const code = m.createRoom('p1').room.code;
    const res = m.rejoin(code, 'p1');
    expect(!res.ok && res.error.code).toBe('CANNOT_REJOIN');
  });
});

describe('buildStateResync (R4, P1, P2)', () => {
  it('produces a complete snapshot of an in-progress room', () => {
    const m = makeManager();
    const { room } = startedRoom(m, ['p1', 'p2']);
    const snap = buildStateResync(room!);
    expect(snap.room.players).toEqual(['p1', 'p2']);
    expect(snap.phase).toBe(room!.phase);
    expect(snap.floor).toBe(1);
    expect(snap.board).toBe(room!.board);
    expect(Object.keys(snap.relicRegistry).length).toBeGreaterThan(0);
    expect(snap.bleedClock.max).toBeGreaterThan(0);
    expect(snap.bleedStage).toBe(0);
    expect(Object.keys(snap.playerStates).sort()).toEqual(['p1', 'p2']);
    expect(Object.keys(snap.aimStates).sort()).toEqual(['p1', 'p2']);
    expect(Array.isArray(snap.enemies)).toBe(true);
    expect(Array.isArray(snap.projectiles)).toBe(true);
    expect(snap.disconnectedPlayers).toEqual([]);
  });

  it('includes disconnected players and excludes dead enemies', () => {
    const m = makeManager();
    const { room } = startedRoom(m, ['p1', 'p2']);
    room!.disconnectedPlayers!.add('p2');
    const deadId = [...room!.enemies.keys()][0];
    if (deadId) room!.enemies.get(deadId)!.alive = false;
    const snap = buildStateResync(room!);
    expect(snap.disconnectedPlayers).toContain('p2');
    if (deadId) expect(snap.enemies.find(e => e.enemyId === deadId)).toBeUndefined();
  });

  it('is deterministic: same room -> equal snapshot (P1)', () => {
    const m = makeManager();
    const { room } = startedRoom(m, ['p1', 'p2']);
    expect(buildStateResync(room!)).toEqual(buildStateResync(room!));
  });

  it('syncResyncToSocket emits exactly one STATE_RESYNC to the single socket (P2)', () => {
    const m = makeManager();
    const { room } = startedRoom(m, ['p1']);
    const emits: Array<{ event: string; payload: unknown }> = [];
    syncResyncToSocket({ emit: (event, payload) => emits.push({ event, payload }) }, room!);
    expect(emits).toHaveLength(1);
    expect(emits[0]!.event).toBe('STATE_RESYNC');
  });
});

describe('socket handlers — identity, rejoin, disconnect (R1, R4, R5)', () => {
  it('uses the handshake auth playerId as identity (R1)', () => {
    const m = makeManager();
    const { io, connect } = makeFakeIo();
    registerHandlers(io, m);
    const s = makeFakeSocket('socket-transport-id', { playerId: 'stable-1' });
    connect()!(s);
    s.handlers.get('create-room')!(undefined);
    const update = s.emits.find(e => e.event === 'ROOM_UPDATE');
    expect((update!.payload as { room: { players: string[] } }).room.players).toEqual(['stable-1']);
  });

  it('rejoin emits STATE_RESYNC to the socket only + broadcasts connection:true (R4, R5)', () => {
    const m = makeManager();
    const { code } = startedRoom(m, ['stable-1', 'p2']);
    m.markDisconnected(code, 'stable-1');
    const { io, roomEmits, connect } = makeFakeIo();
    registerHandlers(io, m);
    const s = makeFakeSocket('new-transport', { playerId: 'stable-1' });
    connect()!(s);
    s.handlers.get('rejoin')!({ code });

    const resync = s.emits.find(e => e.event === 'STATE_RESYNC');
    expect(resync).toBeDefined();
    expect((resync!.payload as { floor: number }).floor).toBe(1);
    expect(s.joined).toContain(code);
    const conn = roomEmits.find(e => e.event === 'PLAYER_CONNECTION_CHANGED');
    expect(conn!.payload).toEqual({ playerId: 'stable-1', connected: true });
    // STATE_RESYNC must NOT be a room broadcast (P2).
    expect(roomEmits.find(e => e.event === 'STATE_RESYNC')).toBeUndefined();
    expect(m.getRoom(code)!.disconnectedPlayers!.has('stable-1')).toBe(false);
  });

  it('rejoin with a bad code emits LOBBY_ERROR and no STATE_RESYNC', () => {
    const m = makeManager();
    const { io, connect } = makeFakeIo();
    registerHandlers(io, m);
    const s = makeFakeSocket('t', { playerId: 'p1' });
    connect()!(s);
    s.handlers.get('rejoin')!({ code: 'NOPE' });
    expect(s.emits.find(e => e.event === 'LOBBY_ERROR')).toBeDefined();
    expect(s.emits.find(e => e.event === 'STATE_RESYNC')).toBeUndefined();
  });

  it('in-progress disconnect broadcasts connection:false and retains the player (R2, R5)', () => {
    const m = makeManager();
    const { code } = startedRoom(m, ['stable-1', 'p2']);
    const { io, roomEmits, connect } = makeFakeIo();
    registerHandlers(io, m);
    const s = makeFakeSocket('t', { playerId: 'stable-1' });
    connect()!(s);
    s.data.roomCode = code;
    s.handlers.get('disconnect')!(undefined);
    const conn = roomEmits.find(e => e.event === 'PLAYER_CONNECTION_CHANGED');
    expect(conn!.payload).toEqual({ playerId: 'stable-1', connected: false });
    expect(m.getRoom(code)!.players).toContain('stable-1');
    expect(m.getRoom(code)!.disconnectedPlayers!.has('stable-1')).toBe(true);
  });
});
