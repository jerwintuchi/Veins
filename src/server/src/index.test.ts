import { describe, it, expect, vi } from 'vitest';
import { registerHandlers, summarizeRoom, runBleedTick, runCombatTick, type ServerSocket, type SocketIOServerLike } from './index.js';
import { RoomManager } from './room/manager.js';
import type { Room } from './room/state.js';
import { buildInitialBoard } from './board/layout.js';
import { drainRateForFloor } from './room/state.js';
import { generateDungeon, STANDARD_DUNGEON_CONFIG } from './dungeon/bsp.js';
import { createRng, hashSeed } from './rng/seeded.js';
import { STARTER_RELICS } from '@veins/shared';
import { FIRE_DURATION_S } from './relic/effects.js';
import { generateLootPool } from './loot/pool.js';

// Helper: put a room that started in combat directly into loot phase with a non-empty pool.
function forceLootPhase(room: Room): void {
  room.phase = 'loot';
  room.enemies = new Map();
  room.lootPool = generateLootPool([...room.registry.keys()], room.board, room.runId, room.floor);
}

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

    // Run starts in combat phase; force loot phase so relic placement is valid.
    const room = manager.getRoom('ROOMX')!;
    forceLootPhase(room);

    // Host places a relic from the loot pool into one of their own slots.
    const ownSlot = Object.values(room.board.slots).find(s => s.ownerId === 'host')!;
    const relicId = room.lootPool[0]!;
    host.handlers.get('place-relic')!({ coord: ownSlot.coord, relicId });

    const placed = roomEmits.find(e => e.event === 'RELIC_PLACED');
    expect(placed).toBeDefined();
    expect((placed!.payload as { ownerId: string }).ownerId).toBe('host');
  });

  it('RUN_STARTED carries relicRegistry with all STARTER_RELICS (T2-board-ui, R3)', async () => {
    const { STARTER_RELICS } = await import('@veins/shared');
    const { io, roomEmits, connect } = makeFakeIo();
    const manager = new RoomManager({ generateCode: () => 'RROOM', generateRunId: () => 'run-rr' });
    registerHandlers(io, manager);

    const host = makeFakeSocket('host');
    connect()!(host);
    host.handlers.get('create-room')!(undefined);
    const p2 = makeFakeSocket('p2');
    connect()!(p2);
    p2.handlers.get('join-room')!({ code: 'RROOM' });
    host.handlers.get('start-run')!(undefined);

    const ev = roomEmits.find(e => e.event === 'RUN_STARTED');
    expect(ev).toBeDefined();
    const payload = ev!.payload as { relicRegistry: Record<string, unknown>; board: unknown; synergyMap: unknown };
    expect(payload.board).toBeDefined();
    expect(payload.synergyMap).toBeDefined();
    expect(typeof payload.relicRegistry).toBe('object');
    expect(Object.keys(payload.relicRegistry)).toHaveLength(STARTER_RELICS.length);
    for (const relic of STARTER_RELICS) {
      expect(payload.relicRegistry[relic.id]).toBeDefined();
    }
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

    // Run starts in combat phase; force loot phase so relic placement is valid.
    const room = manager.getRoom('ROOMY')!;
    forceLootPhase(room);

    // Host tries to place a pool relic into a slot owned by p2.
    const otherSlot = Object.values(room.board.slots).find(s => s.ownerId === 'p2')!;
    const relicId = room.lootPool[0]!;
    host.handlers.get('place-relic')!({ coord: otherSlot.coord, relicId });

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
    // Descend so the room is in combat phase (revive is phase-gated to combat).
    host.handlers.get('descend')!(undefined);

    expect(() => host.handlers.get('revive')!({ sourceCoord: { q: 0 } })).not.toThrow();
    const err = host.emits.find(e => e.event === 'LINKED_FATES_ERROR');
    expect(err).toBeDefined();
    expect((err!.payload as { code: string }).code).toBe('INVALID_COORD');
  });

  it('RUN_STARTED carries lootPool field (empty at start — combat phase first) (T2-loot, R3)', () => {
    const { io, roomEmits, connect } = makeFakeIo();
    const manager = new RoomManager({ generateCode: () => 'LPOOL1', generateRunId: () => 'run-lp1' });
    registerHandlers(io, manager);

    const host = makeFakeSocket('host');
    connect()!(host);
    host.handlers.get('create-room')!(undefined);
    const p2 = makeFakeSocket('p2');
    connect()!(p2);
    p2.handlers.get('join-room')!({ code: 'LPOOL1' });
    host.handlers.get('start-run')!(undefined);

    const ev = roomEmits.find(e => e.event === 'RUN_STARTED');
    expect(ev).toBeDefined();
    const payload = ev!.payload as { lootPool: string[] };
    // Run starts in combat phase; loot pool is populated after the first floor is cleared.
    expect(Array.isArray(payload.lootPool)).toBe(true);
  });

  it('place-relic rejects a relic not in lootPool with RELIC_NOT_IN_POOL (T2-loot, R4)', () => {
    const { io, connect } = makeFakeIo();
    const manager = new RoomManager({ generateCode: () => 'LPOOL2', generateRunId: () => 'run-lp2' });
    registerHandlers(io, manager);

    const host = makeFakeSocket('host');
    connect()!(host);
    host.handlers.get('create-room')!(undefined);
    const p2 = makeFakeSocket('p2');
    connect()!(p2);
    p2.handlers.get('join-room')!({ code: 'LPOOL2' });
    host.handlers.get('start-run')!(undefined);

    const room = manager.getRoom('LPOOL2')!;
    forceLootPhase(room);
    const ownSlot = Object.values(room.board.slots).find(s => s.ownerId === 'host')!;
    // Use a relic that exists in the registry but is NOT in the loot pool.
    const notInPool = [...room.registry.keys()].find(id => !room.lootPool.includes(id))!;
    host.handlers.get('place-relic')!({ coord: ownSlot.coord, relicId: notInPool });

    const err = host.emits.find(e => e.event === 'RELIC_PLACE_ERROR');
    expect(err).toBeDefined();
    expect((err!.payload as { code: string }).code).toBe('RELIC_NOT_IN_POOL');
  });

  it('successful placement removes relic from lootPool (T2-loot, R4)', () => {
    const { io, connect } = makeFakeIo();
    const manager = new RoomManager({ generateCode: () => 'LPOOL3', generateRunId: () => 'run-lp3' });
    registerHandlers(io, manager);

    const host = makeFakeSocket('host');
    connect()!(host);
    host.handlers.get('create-room')!(undefined);
    const p2 = makeFakeSocket('p2');
    connect()!(p2);
    p2.handlers.get('join-room')!({ code: 'LPOOL3' });
    host.handlers.get('start-run')!(undefined);

    const room = manager.getRoom('LPOOL3')!;
    forceLootPhase(room);
    const ownSlot = Object.values(room.board.slots).find(s => s.ownerId === 'host')!;
    const relicId = room.lootPool[0]!;
    const poolSizeBefore = room.lootPool.length;

    host.handlers.get('place-relic')!({ coord: ownSlot.coord, relicId });

    expect(room.lootPool).not.toContain(relicId);
    expect(room.lootPool.length).toBe(poolSizeBefore - 1);
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

  it('a non-depleting tick emits ONLY the delta, never a full resync (R4/I6)', () => {
    const { io, roomEmits } = makeFakeIo();
    const manager = startedManager('TICK3');
    runBleedTick(io, manager, 1);
    // Exactly one broadcast, and it is the delta — no RUN_ENDED, no BOARD/STATE resync.
    expect(roomEmits).toHaveLength(1);
    expect(roomEmits[0]!.event).toBe('BLEED_CLOCK_TICK');
    expect(roomEmits.some(e => e.event === 'RUN_ENDED')).toBe(false);
    expect(roomEmits.some(e => /SYNC|RESYNC|STATE/.test(e.event))).toBe(false);
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

  it('descend handler broadcasts FLOOR_ADVANCED with the new floor + dungeon', () => {
    const { io, roomEmits, connect } = makeFakeIo();
    const manager = new RoomManager({ generateCode: () => 'DESC1', generateRunId: () => 'run-desc1' });
    registerHandlers(io, manager);

    const host = makeFakeSocket('h1');
    connect()!(host);
    host.handlers.get('create-room')!(undefined);
    const p2 = makeFakeSocket('p2');
    connect()!(p2);
    p2.handlers.get('join-room')!({ code: 'DESC1' });
    host.handlers.get('start-run')!(undefined);
    // Force loot phase so descend is accepted (run now starts in combat).
    const descRoom = manager.getRoom('DESC1')!;
    descRoom.phase = 'loot';
    descRoom.enemies = new Map();

    host.handlers.get('descend')!(undefined);
    const advanced = roomEmits.find(e => e.event === 'FLOOR_ADVANCED');
    expect(advanced).toBeDefined();
    expect((advanced!.payload as { floor: number }).floor).toBe(2);
    expect((advanced!.payload as { dungeon: { runId: string } }).dungeon.runId).toBe('run-desc1');
    expect(manager.getRoom('DESC1')?.floor).toBe(2);
  });

  it('descend handler rejects when the socket is not in a room', () => {
    const { io, connect } = makeFakeIo();
    registerHandlers(io, new RoomManager());
    const sock = makeFakeSocket('lonely');
    connect()!(sock);
    sock.handlers.get('descend')!(undefined);
    const err = sock.emits.find(e => e.event === 'LOBBY_ERROR');
    expect(err).toBeDefined();
    expect((err!.payload as { code: string }).code).toBe('NOT_IN_ROOM');
  });
});

describe('runCombatTick — relic effect ENEMY_DAMAGED events (T5, R3, R4, R5)', () => {
  const DUNGEON = generateDungeon('r', STANDARD_DUNGEON_CONFIG, 1);

  function makeActiveRoom(overrides: Partial<Room> = {}): Room {
    return {
      id: 'r', code: 'R', hostId: 'p1', status: 'in-progress', runId: 'run-1',
      players: ['p1', 'p2'],
      board: buildInitialBoard(['p1', 'p2'], 2),
      registry: new Map(STARTER_RELICS.map(r => [r.id, r])),
      phase: 'combat', floor: 1,
      bleedClock: { current: 1000, max: 1000, drainPerSecond: drainRateForFloor(1) },
      outcome: null, dungeon: DUNGEON,
      enemies: new Map(),
      playerStates: new Map([
        ['p1', { hp: 100, maxHp: 100, downed: false, x: 0, y: 0 }],
        ['p2', { hp: 100, maxHp: 100, downed: false, x: 500, y: 500 }],
      ]),
      aimStates: new Map([
        ['p1', { mode: 'auto' as const, targetId: null }],
        ['p2', { mode: 'auto' as const, targetId: null }],
      ]),
      projectiles: new Map(),
      weaponCooldowns: new Map([['p1', 0], ['p2', 0]]),
      playerMoveInputs: new Map([['p1', { dx: 0, dy: 0 }], ['p2', { dx: 0, dy: 0 }]]),
      nextProjectileId: 0,
      lootPool: [],
      fireDurations: new Map(),
      combatRng: createRng(hashSeed('run-1#combat')),
      ...overrides,
    };
  }

  it('emits ENEMY_DAMAGED for fire DoT damage each combat tick (T5, R4)', () => {
    const roomEmits: Array<{ room: string; event: string; payload: unknown }> = [];
    const fakeIo: SocketIOServerLike = {
      on: () => {},
      to: (room: string) => ({ emit: (ev, payload) => roomEmits.push({ room, event: ev, payload }) }),
    };
    const manager = new RoomManager({ generateCode: () => 'FT5', generateRunId: () => 'run-t5' });
    const room = makeActiveRoom({ code: 'FT5' });
    // Enemy burning with enough HP to survive 1s of fire
    room.enemies.set('e1', { id: 'e1', typeId: 'shambler', x: 400, y: 0, hp: 50, maxHp: 60, damage: 15, alive: true, attackCooldownRemaining: 999 });
    room.fireDurations.set('e1', FIRE_DURATION_S);
    // Inject room directly into the manager's internal map via startRun bypass:
    // We need to inject the room. The cleanest way here is to place it via `(manager as any).rooms`.
    (manager as unknown as { rooms: Map<string, Room> }).rooms.set('FT5', room);

    runCombatTick(fakeIo, manager, 1.0);

    const fireDamageEvents = roomEmits.filter(e => e.event === 'ENEMY_DAMAGED');
    expect(fireDamageEvents.length).toBeGreaterThan(0);
    const e1Events = fireDamageEvents.filter(e => (e.payload as { enemyId: string }).enemyId === 'e1');
    expect(e1Events.length).toBeGreaterThan(0);
  });
});
