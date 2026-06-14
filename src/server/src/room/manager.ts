import { randomUUID } from 'node:crypto';
import type { DungeonLayout, LobbyErrorEvent, PlayerId, RoomCode } from '@veins/shared';
import { MAX_PLAYERS, MIN_PLAYERS_TO_START, HEX_BOARD_RADIUS } from '@veins/shared';
import type { BleedClockTickEvent, RunEndedEvent } from '@veins/shared';
import { generateDungeon } from '../dungeon/bsp.js';
import { buildInitialBoard } from '../board/layout.js';
import { advanceBleedForRoom, extractRun } from '../bleed/clock.js';
import { drainRateForFloor, type Room } from './state.js';
import { generateRoomCode } from './roomCode.js';

const DUNGEON_START_HP = 1000;

export type CreateRoomResult = { ok: true; room: Room };
export type JoinRoomResult = { ok: true; room: Room } | { ok: false; error: LobbyErrorEvent };
export type LeaveRoomResult =
  | { ok: true; deleted: boolean; room?: Room }
  | { ok: false; error: LobbyErrorEvent };
export type StartRunResult =
  | { ok: true; room: Room; dungeon: DungeonLayout }
  | { ok: false; error: LobbyErrorEvent };

export type RoomManagerDeps = {
  generateCode?: () => string;
  generateRunId?: () => string;
};

// In-memory store of active rooms. Never persisted (invariant I7). Code/runId
// generators are injectable so tests can be deterministic.
export class RoomManager {
  private rooms = new Map<RoomCode, Room>();
  private generateCode: () => string;
  private generateRunId: () => string;

  constructor(deps: RoomManagerDeps = {}) {
    this.generateCode = deps.generateCode ?? generateRoomCode;
    this.generateRunId = deps.generateRunId ?? randomUUID;
  }

  getRoom(code: RoomCode): Room | undefined {
    return this.rooms.get(code);
  }

  private uniqueCode(): RoomCode {
    let code = this.generateCode();
    while (this.rooms.has(code)) code = this.generateCode();
    return code;
  }

  createRoom(hostId: PlayerId): CreateRoomResult {
    const code = this.uniqueCode();
    const room: Room = {
      id: code,
      code,
      hostId,
      status: 'lobby',
      runId: '',
      players: [hostId],
      board: { slots: {} },
      registry: new Map(),
      phase: 'loot',
      floor: 0,
      bleedClock: { current: 0, max: 0, drainPerSecond: 0 },
      outcome: null,
    };
    this.rooms.set(code, room);
    return { ok: true, room };
  }

  joinRoom(code: RoomCode, playerId: PlayerId): JoinRoomResult {
    const room = this.rooms.get(code);
    if (!room) {
      return { ok: false, error: { code: 'ROOM_NOT_FOUND', message: 'No room with that code.' } };
    }
    if (room.status !== 'lobby') {
      return { ok: false, error: { code: 'ALREADY_STARTED', message: 'That run has already started.' } };
    }
    if (room.players.length >= MAX_PLAYERS) {
      return { ok: false, error: { code: 'ROOM_FULL', message: 'That room is full.' } };
    }
    if (room.players.includes(playerId)) {
      return { ok: false, error: { code: 'ALREADY_IN_ROOM', message: 'You are already in that room.' } };
    }
    room.players.push(playerId);
    return { ok: true, room };
  }

  leaveRoom(code: RoomCode, playerId: PlayerId): LeaveRoomResult {
    const room = this.rooms.get(code);
    if (!room || !room.players.includes(playerId)) {
      return { ok: false, error: { code: 'NOT_IN_ROOM', message: 'You are not in that room.' } };
    }

    room.players = room.players.filter(p => p !== playerId);

    if (room.players.length === 0) {
      this.rooms.delete(code);
      return { ok: true, deleted: true };
    }

    // Reassign host if the host left.
    if (room.hostId === playerId) {
      room.hostId = room.players[0] as PlayerId;
    }
    return { ok: true, deleted: false, room };
  }

  startRun(code: RoomCode): StartRunResult {
    const room = this.rooms.get(code);
    if (!room) {
      return { ok: false, error: { code: 'ROOM_NOT_FOUND', message: 'No room with that code.' } };
    }
    if (room.status !== 'lobby') {
      return { ok: false, error: { code: 'ALREADY_STARTED', message: 'That run has already started.' } };
    }
    if (room.players.length < MIN_PLAYERS_TO_START) {
      return { ok: false, error: { code: 'NOT_ENOUGH_PLAYERS', message: 'Need at least 2 players to start.' } };
    }

    const runId = this.generateRunId();
    const dungeon = generateDungeon(runId);

    room.runId = runId;
    room.status = 'in-progress';
    room.board = buildInitialBoard(room.players, HEX_BOARD_RADIUS);
    room.floor = 1;
    room.phase = 'loot';
    room.bleedClock = {
      current: DUNGEON_START_HP,
      max: DUNGEON_START_HP,
      drainPerSecond: drainRateForFloor(1),
    };

    return { ok: true, room, dungeon };
  }

  // Rooms with an active run — drives the Bleed Clock tick loop.
  activeRooms(): Room[] {
    return [...this.rooms.values()].filter(r => r.status === 'in-progress');
  }

  // Advances a room's Bleed Clock by dt seconds. Returns the tick (and a
  // RUN_ENDED payload if the clock depleted), or undefined if no such room.
  tickRoom(code: RoomCode, deltaSeconds: number):
    | { tick: BleedClockTickEvent; ended: RunEndedEvent | null }
    | undefined {
    const room = this.rooms.get(code);
    if (!room) return undefined;
    return advanceBleedForRoom(room, deltaSeconds);
  }

  // Voluntary extraction. Ends an in-progress run as 'extracted'.
  extractRoom(code: RoomCode): { ok: true; ended: RunEndedEvent } | { ok: false } {
    const room = this.rooms.get(code);
    if (!room) return { ok: false };
    return extractRun(room);
  }
}
