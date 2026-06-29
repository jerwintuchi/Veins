// Authoritative game server. Thin transport plumbing over the unit-tested core
// (RoomManager, dungeon generation, movement). Every inbound message is validated;
// only the server mutates room state (invariants I1, I2).
//
// NOTE: still on Socket.io. The raw-WebSocket transport swap (TD-002) is Phase 1
// of the roadmap; the handler core is kept behind the SocketIOServerLike seam so
// that swap stays contained.
import { fileURLToPath } from 'node:url';
import type { JoinRoomRequest, MovePlayerRequest, RoomSummary, PlayerId, RoomCode } from '@testament/shared';
import { RoomManager } from './room/manager.js';
import type { Room } from './room/state.js';
import { buildStateResync } from './room/sync.js';
import { movePlayer } from './combat/movement.js';

// How often the server applies movement and broadcasts positions (20Hz / 50ms).
const MOVEMENT_TICK_MS = 50;

// Minimal socket surface we depend on. Keeping it abstract makes the wiring
// testable without a live server; the real io is cast to this at the boundary.
export interface ServerSocket {
  id: string;
  data: { playerId?: PlayerId; roomCode?: RoomCode | undefined };
  // Handshake auth carries the client's stable player id (used for reconnection).
  handshake?: { auth?: Record<string, unknown> };
  on(event: string, listener: (payload: unknown) => void): void;
  emit(event: string, payload: unknown): void;
  join(room: string): void;
  leave?(room: string): void;
}
export interface RoomEmitter {
  emit(event: string, payload: unknown): void;
}
export interface SocketIOServerLike {
  on(event: 'connection', listener: (socket: ServerSocket) => void): void;
  to(room: string): RoomEmitter;
}

export function summarizeRoom(room: Room): RoomSummary {
  return { code: room.code, status: room.status, hostId: room.hostId, players: room.players };
}

export function registerHandlers(io: SocketIOServerLike, manager: RoomManager): void {
  io.on('connection', (socket) => {
    // Identity comes from the handshake auth (a stable client-held token, used for
    // reconnection), falling back to any pre-set data id, then the socket id. It is
    // connection-derived, never a per-message client field (invariant I2).
    const authId = typeof socket.handshake?.auth?.['playerId'] === 'string'
      ? (socket.handshake.auth['playerId'] as PlayerId)
      : undefined;
    const playerId: PlayerId = authId ?? socket.data.playerId ?? socket.id;
    socket.data.playerId = playerId;

    const currentRoom = (): Room | undefined =>
      socket.data.roomCode ? manager.getRoom(socket.data.roomCode) : undefined;

    socket.on('create-room', () => {
      const { room } = manager.createRoom(playerId);
      socket.data.roomCode = room.code;
      socket.join(room.code);
      socket.emit('ROOM_UPDATE', { room: summarizeRoom(room) });
    });

    socket.on('join-room', (payload) => {
      const req = payload as JoinRoomRequest;
      if (!req || typeof req.code !== 'string') {
        socket.emit('LOBBY_ERROR', { code: 'INVALID_REQUEST', message: 'Malformed join-room request.' });
        return;
      }
      const res = manager.joinRoom(req.code, playerId);
      if (!res.ok) {
        socket.emit('LOBBY_ERROR', res.error);
        return;
      }
      socket.data.roomCode = res.room.code;
      socket.join(res.room.code);
      io.to(res.room.code).emit('ROOM_UPDATE', { room: summarizeRoom(res.room) });
    });

    // Reconnection: a returning player re-associates with an in-progress run they
    // still belong to and receives a full STATE_RESYNC snapshot — to this socket
    // only (the sanctioned I6 full-state exception), never a room broadcast.
    socket.on('rejoin', (payload) => {
      const req = payload as { code?: unknown };
      if (!req || typeof req.code !== 'string') {
        socket.emit('LOBBY_ERROR', { code: 'INVALID_REQUEST', message: 'Malformed rejoin request.' });
        return;
      }
      const res = manager.rejoin(req.code, playerId);
      if (!res.ok) {
        socket.emit('LOBBY_ERROR', res.error);
        return;
      }
      socket.data.roomCode = res.room.code;
      socket.join(res.room.code);
      socket.emit('STATE_RESYNC', buildStateResync(res.room));
      io.to(res.room.code).emit('PLAYER_CONNECTION_CHANGED', { playerId, connected: true });
    });

    socket.on('leave-room', () => {
      const code = socket.data.roomCode;
      if (!code) return;
      const res = manager.leaveRoom(code, playerId);
      socket.data.roomCode = undefined;
      socket.leave?.(code); // stop receiving this room's broadcasts after leaving
      if (res.ok && !res.deleted && res.room) {
        io.to(code).emit('ROOM_UPDATE', { room: summarizeRoom(res.room) });
      }
    });

    socket.on('start-run', () => {
      const code = socket.data.roomCode;
      if (!code) {
        socket.emit('LOBBY_ERROR', { code: 'NOT_IN_ROOM', message: 'You are not in a room.' });
        return;
      }
      const res = manager.startRun(code);
      if (!res.ok) {
        socket.emit('LOBBY_ERROR', res.error);
        return;
      }
      io.to(code).emit('RUN_STARTED', {
        dungeon: res.dungeon,
        playerPositions: Object.fromEntries(
          [...res.room.playerStates.entries()].map(([id, s]) => [id, { x: s.x, y: s.y }])
        ),
      });
    });

    // Per-frame input: store the latest move direction; the tick applies it once
    // per frame regardless of how many events arrive (closes the event-flood
    // speed exploit). Silently ignore when not in an active run (I2).
    socket.on('move-player', (payload) => {
      const room = currentRoom();
      if (!room) return;
      const req = payload as MovePlayerRequest;
      if (!req || typeof req.dx !== 'number' || typeof req.dy !== 'number') {
        socket.emit('LOBBY_ERROR', { code: 'INVALID_REQUEST', message: 'Malformed move-player request.' });
        return;
      }
      if (!room.playerMoveInputs.has(playerId)) return; // run not yet started
      room.playerMoveInputs.set(playerId, { dx: req.dx, dy: req.dy });
    });

    socket.on('disconnect', () => {
      const code = socket.data.roomCode;
      if (!code) return;
      // In a lobby this removes the player (ROOM_UPDATE). In an in-progress run the
      // player is retained and only flagged disconnected, so they can rejoin —
      // teammates get PLAYER_CONNECTION_CHANGED.
      const res = manager.markDisconnected(code, playerId);
      if (!res.ok) return;
      if (res.mode === 'disconnected') {
        if (!res.deleted) {
          io.to(code).emit('PLAYER_CONNECTION_CHANGED', { playerId, connected: false });
        }
      } else if (!res.deleted && res.room) {
        io.to(code).emit('ROOM_UPDATE', { room: summarizeRoom(res.room) });
      }
    });
  });
}

// One movement step across all active rooms: apply each player's stored input and
// broadcast new positions. Exported so the loop can be driven in tests.
export function runMovementTick(io: SocketIOServerLike, manager: RoomManager, deltaSeconds: number): void {
  for (const room of manager.activeRooms()) {
    if (!room.dungeon) continue;
    for (const pid of room.players) {
      const ps = room.playerStates.get(pid);
      if (!ps) continue;
      const input = room.playerMoveInputs.get(pid) ?? { dx: 0, dy: 0 };
      const next = movePlayer(ps, input.dx, input.dy, deltaSeconds, room.dungeon);
      if (next.x !== ps.x || next.y !== ps.y) {
        room.playerStates.set(pid, next);
        io.to(room.code).emit('PLAYER_MOVED', { playerId: pid, x: next.x, y: next.y });
      }
    }
  }
}

// Production bootstrap. Imported lazily so tests never open a port.
export async function startServer(port: number): Promise<void> {
  const { Server } = await import('socket.io');
  const io = new Server(port, { cors: { origin: '*' } });
  const manager = new RoomManager();
  // socket.io's Server is structurally richer than SocketIOServerLike; cast at
  // this single boundary so the handler logic stays transport-agnostic.
  const ioLike = io as unknown as SocketIOServerLike;
  registerHandlers(ioLike, manager);
  setInterval(() => runMovementTick(ioLike, manager, MOVEMENT_TICK_MS / 1000), MOVEMENT_TICK_MS);
  // eslint-disable-next-line no-console
  console.log(`Testament server listening on :${port}`);
}

const isMain = process.argv[1] !== undefined && process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  void startServer(Number(process.env.PORT) || 3001);
}
