import { randomUUID } from 'node:crypto';
import type { DungeonLayout, LobbyErrorEvent, PlayerId, RoomCode, PlayerState } from '@testament/shared';
import { MAX_PLAYERS, MIN_PLAYERS_TO_START as GAME_MIN_PLAYERS, PLAYER_MAX_HP } from '@testament/shared';
import { generateDungeon } from '../dungeon/bsp.js';
import type { Room } from './state.js';
import { generateRoomCode } from './roomCode.js';

// Solo play is supported (GAME_MIN_PLAYERS === 1). Set DEV_MIN_PLAYERS higher
// (e.g. 2) to force co-op-only behaviour for testing.
const MIN_PLAYERS_TO_START = parseInt(process.env['DEV_MIN_PLAYERS'] ?? String(GAME_MIN_PLAYERS), 10);

export type CreateRoomResult = { ok: true; room: Room };
export type JoinRoomResult = { ok: true; room: Room } | { ok: false; error: LobbyErrorEvent };
export type LeaveRoomResult =
  | { ok: true; deleted: boolean; room?: Room }
  | { ok: false; error: LobbyErrorEvent };
export type StartRunResult =
  | { ok: true; room: Room; dungeon: DungeonLayout }
  | { ok: false; error: LobbyErrorEvent };
export type MarkDisconnectedResult =
  | { ok: true; mode: 'left' | 'disconnected'; deleted: boolean; room?: Room | undefined }
  | { ok: false };
export type RejoinResult =
  | { ok: true; room: Room }
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
      dungeon: null,
      playerStates: new Map(),
      playerMoveInputs: new Map(),
      disconnectedPlayers: new Set(),
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

  // Handles a socket disconnect. In a lobby it behaves like leave (player removed,
  // host reassigned, empty room deleted). In an in-progress run the player is RETAINED
  // (kept in `players` so membership is unchanged) and recorded in `disconnectedPlayers`
  // so they can rejoin. A run with every player disconnected is deleted so the tick loop
  // never runs an abandoned room.
  markDisconnected(code: RoomCode, playerId: PlayerId): MarkDisconnectedResult {
    const room = this.rooms.get(code);
    if (!room || !room.players.includes(playerId)) return { ok: false };

    if (room.status === 'lobby') {
      const res = this.leaveRoom(code, playerId);
      if (!res.ok) return { ok: false };
      return { ok: true, mode: 'left', deleted: res.deleted, room: res.room };
    }

    if (!room.disconnectedPlayers) room.disconnectedPlayers = new Set();
    room.disconnectedPlayers.add(playerId);

    if (room.players.every(p => room.disconnectedPlayers!.has(p))) {
      this.rooms.delete(code);
      return { ok: true, mode: 'disconnected', deleted: true };
    }
    return { ok: true, mode: 'disconnected', deleted: false, room };
  }

  // Re-associates a returning player with an in-progress run they still belong to,
  // clearing their disconnected flag. The caller emits STATE_RESYNC.
  rejoin(code: RoomCode, playerId: PlayerId): RejoinResult {
    const room = this.rooms.get(code);
    if (!room) {
      return { ok: false, error: { code: 'ROOM_NOT_FOUND', message: 'No room with that code.' } };
    }
    if (room.status !== 'in-progress') {
      return { ok: false, error: { code: 'CANNOT_REJOIN', message: 'That run is not in progress.' } };
    }
    if (!room.players.includes(playerId)) {
      return { ok: false, error: { code: 'CANNOT_REJOIN', message: 'You are not a member of that run.' } };
    }
    room.disconnectedPlayers?.delete(playerId);
    return { ok: true, room };
  }

  // Starts a run: generates the dungeon from a fresh seed and places every player
  // at the entry room. No combat or rules yet (that is the Testament expedition loop).
  startRun(code: RoomCode): StartRunResult {
    const room = this.rooms.get(code);
    if (!room) {
      return { ok: false, error: { code: 'ROOM_NOT_FOUND', message: 'No room with that code.' } };
    }
    if (room.status !== 'lobby') {
      return { ok: false, error: { code: 'ALREADY_STARTED', message: 'That run has already started.' } };
    }
    if (room.players.length < MIN_PLAYERS_TO_START) {
      return { ok: false, error: { code: 'NOT_ENOUGH_PLAYERS', message: `Need at least ${MIN_PLAYERS_TO_START} player(s) to start.` } };
    }

    const runId = this.generateRunId();
    const dungeon = generateDungeon(runId);

    room.runId = runId;
    room.status = 'in-progress';
    room.dungeon = dungeon;

    // Players start at the dungeon entry point (room-0 centre).
    const entry = dungeon.rooms[0];
    const startX = entry ? entry.rect.x + entry.rect.width / 2 : 0;
    const startY = entry ? entry.rect.y + entry.rect.height / 2 : 0;
    room.playerStates = new Map<PlayerId, PlayerState>(
      room.players.map(id => [id, { hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP, downed: false, x: startX, y: startY }])
    );
    room.playerMoveInputs = new Map(room.players.map(id => [id, { dx: 0, dy: 0 }]));

    return { ok: true, room, dungeon };
  }

  // Rooms with an active run — drives the movement tick loop.
  activeRooms(): Room[] {
    return [...this.rooms.values()].filter(r => r.status === 'in-progress');
  }
}
