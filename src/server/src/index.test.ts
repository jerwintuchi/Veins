import { describe, it, expect, vi } from 'vitest';
import { registerHandlers, summarizeRoom, runBleedTick, type ServerSocket, type SocketIOServerLike } from './index.js';
import { RoomManager } from './room/manager.js';
import type { Room } from './room/state.js';

// A fake Socket.io server that captures the connection handler and records
// room-broadcast emits, so we can drive the wiring without a real network.
function makeFakeIo() {
  const roomEmits: Array<{ room: string; event: string; payload: unknown }> = [];
  let connectionHandler: ((socket: ServerSocket) => void) | undefined;
  const io: SocketIOServerLike = {
    on: (_event, listener) => {
      connectionHandler = listener;
    },
    to: (room: string) => ({
      emit: (event, payload) => roomEmits.push({ room, event, payload }),
    }),
  };
  return { io, roomEmits, connect: () => connectionHandler };
}

function makeFakeSocket(id: string): ServerSocket & {
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
    handlers,
    emits,
    joined,
    on: (event, listener) => handlers.set(event, listener),
    emit: (event, payload) => emits.push({ event, payload }),
    join: (room) => joined.push(room),
  };
}

describe('summarizeRoom', () => {
  it('projects a room down to its public summary', () => {
    const room = {
      code: 'ABCDE',
      status: 'lobby',
      hostId: 'h1',
      players: ['h1', 'p2'],
    } as Room;
    expect(summarizeRoom(room)).toEqual({
      code: 'ABCDE',
      status: 'lobby',
      hostId: 'h1',
      players: ['h1', 'p2'],
    });
  });
});

describe('registerHandlers wiring (smoke)', () => {
  it('registers a connection handler without throwing', () => {
    const { io, connect } = makeFakeIo();
    expect(() => registerHandlers(io, new RoomManager())).not.toThrow();
    expect(typeof connect()).toBe('function');
  });

  it('create-room then place-relic flows through the authoritative core', () => {
    const { io, roomEmits, connect } = makeFakeIo();
    const manager = new RoomManager({ generateCode: () => 'ROOMX', generateRunId: () => 'run-x' });
    registerHandlers(io, manager);

    // Host connects and creates a room.
    const host = makeFakeSocket('host');
    connect()!(host);
    host.handlers.get('create-room')!(undefined);
    expect(host.joined).toContain('ROOMX');
    expect(host.emits.some(e => e.event === 'ROOM_UPDATE')).toBe(true);

    // Second player connects and joins.
    const p2 = makeFakeSocket('p2');
    connect()!(p2);
    p2.handlers.get('join-room')!({ code: 'ROOMX', playerId: 'ignored-client-claim' });
    expect(manager.getRoom('ROOMX')?.players).toEqual(['host', 'p2']);

    // Start the run (host).
    host.handlers.get('start-run')!(undefined);
    expect(roomEmits.some(e => e.event === 'RUN_STARTED')).toBe(true);

    // Host places a relic into one of their own slots.
    const room = manager.getRoom('ROOMX')!;
    const ownSlot = Object.values(room.board.slots).find(s => s.ownerId === 'host')!;
    room.registry.set('r1', {
      id: 'r1', name: 'r1', tags: ['fire'], baseEffect: { description: '' }, synergyEffect: { description: '' },
    });
    host.handlers.get('place-relic')!({ coord: ownSlot.coord, relicId: 'r1' });

    const placed = roomEmits.find(e => e.event === 'RELIC_PLACED');
    expect(placed).toBeDefined();
    expect((placed!.payload as { ownerId: string }).ownerId).toBe('host');
  });

  it('rejects placing into another player slot with NOT_OWNER (targeted error)', () => {
    const { io, connect } = makeFakeIo();
    const manager = new RoomManager({ generateCode: () => 'ROOMY', generateRunId: () => 'run-y' });
    registerHandlers(io, manager);

    const host = makeFakeSocket('host');
    connect()!(host);
    host.handlers.get('create-room')!(undefined);
    const p2 = makeFakeSocket('p2');
    connect()!(p2);
    p2.handlers.get('join-room')!({ code: 'ROOMY' });
    host.handlers.get('start-run')!(undefined);

    // Host tries to place into a slot owned by p2.
    const room = manager.getRoom('ROOMY')!;
    const otherSlot = Object.values(room.board.slots).find(s => s.ownerId === 'p2')!;
    host.handlers.get('place-relic')!({ coord: otherSlot.coord, relicId: 'r1' });

    const err = host.emits.find(e => e.event === 'RELIC_PLACE_ERROR');
    expect(err).toBeDefined();
    expect((err!.payload as { code: string }).code).toBe('NOT_OWNER');
  });

  it('rejects a malformed place-relic payload with a targeted error, never throwing', () => {
    const { io, connect } = makeFakeIo();
    const manager = new RoomManager({ generateCode: () => 'ROOMZ', generateRunId: () => 'run-z' });
    registerHandlers(io, manager);

    const host = makeFakeSocket('host');
    connect()!(host);
    host.handlers.get('create-room')!(undefined);
    const p2 = makeFakeSocket('p2');
    connect()!(p2);
    p2.handlers.get('join-room')!({ code: 'ROOMZ' });
    host.handlers.get('start-run')!(undefined);

    // Malformed payload: no coord. Must not throw inside the listener.
    expect(() => host.handlers.get('place-relic')!({ relicId: 'r1' })).not.toThrow();
    const err = host.emits.find(e => e.event === 'RELIC_PLACE_ERROR');
    expect(err).toBeDefined();
    expect((err!.payload as { code: string }).code).toBe('INVALID_COORD');
  });

  it('rejects a malformed join-room payload with INVALID_REQUEST (not ROOM_NOT_FOUND)', () => {
    const { io, connect } = makeFakeIo();
    registerHandlers(io, new RoomManager());

    const sock = makeFakeSocket('s1');
    connect()!(sock);
    expect(() => sock.handlers.get('join-room')!({})).not.toThrow();

    const err = sock.emits.find(e => e.event === 'LOBBY_ERROR');
    expect(err).toBeDefined();
    expect((err!.payload as { code: string }).code).toBe('INVALID_REQUEST');
  });

  it('rejects a malformed revive payload with a targeted error, never throwing', () => {
    const { io, connect } = makeFakeIo();
    const manager = new RoomManager({ generateCode: () => 'ROOMW', generateRunId: () => 'run-w' });
    registerHandlers(io, manager);

    const host = makeFakeSocket('host');
    connect()!(host);
    host.handlers.get('create-room')!(undefined);
    const p2 = makeFakeSocket('p2');
    connect()!(p2);
    p2.handlers.get('join-room')!({ code: 'ROOMW' });
    host.handlers.get('start-run')!(undefined);

    expect(() => host.handlers.get('revive')!({ sourceCoord: { q: 0 } })).not.toThrow();
    const err = host.emits.find(e => e.event === 'LINKED_FATES_ERROR');
    expect(err).toBeDefined();
    expect((err!.payload as { code: string }).code).toBe('INVALID_COORD');
  });
});

describe('Bleed Clock loop + extract wiring (T5)', () => {
  function startedManager(code: string) {
    const manager = new RoomManager({ generateCode: () => code, generateRunId: () => `run-${code}` });
    const { room } = manager.createRoom('h1');
    manager.joinRoom(room.code, 'p2');
    manager.startRun(room.code);
    return manager;
  }

  it('runBleedTick broadcasts BLEED_CLOCK_TICK to an active room', () => {
    const { io, roomEmits } = makeFakeIo();
    const manager = startedManager('TICK1');
    runBleedTick(io, manager, 1);
    const tick = roomEmits.find(e => e.event === 'BLEED_CLOCK_TICK');
    expect(tick).toBeDefined();
    expect(tick!.room).toBe('TICK1');
  });

  it('runBleedTick broadcasts RUN_ENDED (wiped) when the clock depletes', () => {
    const { io, roomEmits } = makeFakeIo();
    const manager = startedManager('TICK2');
    const room = manager.getRoom('TICK2')!;
    room.bleedClock.current = room.bleedClock.drainPerSecond; // one tick from empty
    runBleedTick(io, manager, 1);
    const ended = roomEmits.find(e => e.event === 'RUN_ENDED');
    expect(ended).toBeDefined();
    expect((ended!.payload as { outcome: string }).outcome).toBe('wiped');
  });

  it('extract handler broadcasts RUN_ENDED (extracted)', () => {
    const { io, roomEmits, connect } = makeFakeIo();
    const manager = new RoomManager({ generateCode: () => 'EXT1', generateRunId: () => 'run-ext1' });
    registerHandlers(io, manager);

    const host = makeFakeSocket('h1');
    connect()!(host);
    host.handlers.get('create-room')!(undefined);
    const p2 = makeFakeSocket('p2');
    connect()!(p2);
    p2.handlers.get('join-room')!({ code: 'EXT1' });
    host.handlers.get('start-run')!(undefined);

    host.handlers.get('extract')!(undefined);
    const ended = roomEmits.find(e => e.event === 'RUN_ENDED');
    expect(ended).toBeDefined();
    expect((ended!.payload as { outcome: string }).outcome).toBe('extracted');
    expect(manager.getRoom('EXT1')?.status).toBe('ended');
  });

  it('extract handler rejects when the socket is not in a room', () => {
    const { io, connect } = makeFakeIo();
    registerHandlers(io, new RoomManager());
    const sock = makeFakeSocket('lonely');
    connect()!(sock);
    sock.handlers.get('extract')!(undefined);
    const err = sock.emits.find(e => e.event === 'LOBBY_ERROR');
    expect(err).toBeDefined();
    expect((err!.payload as { code: string }).code).toBe('NOT_IN_ROOM');
  });
});
