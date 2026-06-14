import { describe, it, expect, vi } from 'vitest';
import { registerHandlers, summarizeRoom, type ServerSocket, type SocketIOServerLike } from './index.js';
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
});
