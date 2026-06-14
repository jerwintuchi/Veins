// Authoritative game server. Thin Socket.io plumbing over the unit-tested core
// (RoomManager, board layout, placement, linked fates, dungeon). Every inbound
// message is validated; only the server mutates room state (invariants I1, I2).
import { fileURLToPath } from 'node:url';
import type {
  JoinRoomRequest,
  PlaceRelicRequest,
  LinkedFatesRequest,
  RoomSummary,
  PlayerId,
  RoomCode,
} from '@veins/shared';
import { RoomManager } from './room/manager.js';
import type { Room } from './room/state.js';
import { placeRelic } from './board/placement.js';
import { reviveWithLinkedFates } from './board/linkedFates.js';
import { evaluateSynergies } from './board/synergy.js';

// Minimal Socket.io surface we depend on. Keeping it abstract makes the wiring
// testable without a live server; the real io is cast to this at the boundary.
export interface ServerSocket {
  id: string;
  data: { playerId?: PlayerId; roomCode?: RoomCode | undefined };
  on(event: string, listener: (payload: unknown) => void): void;
  emit(event: string, payload: unknown): void;
  join(room: string): void;
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
    // In production, playerId comes from the authenticated handshake. Fall back
    // to the socket id so the identity is always server-derived, never a client
    // payload field (invariant I2).
    const playerId: PlayerId = socket.data.playerId ?? socket.id;
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
        socket.emit('LOBBY_ERROR', { code: 'ROOM_NOT_FOUND', message: 'Invalid join request.' });
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

    socket.on('leave-room', () => {
      const code = socket.data.roomCode;
      if (!code) return;
      const res = manager.leaveRoom(code, playerId);
      socket.data.roomCode = undefined;
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
        board: res.room.board,
        synergyMap: evaluateSynergies(res.room.board, res.room.registry),
      });
    });

    socket.on('place-relic', (payload) => {
      const room = currentRoom();
      if (!room) {
        socket.emit('RELIC_PLACE_ERROR', { code: 'INVALID_COORD', message: 'You are not in an active room.' });
        return;
      }
      const req = payload as PlaceRelicRequest;
      const result = placeRelic(room.board, req, playerId, room.phase, room.registry);
      if (!result.ok) {
        socket.emit('RELIC_PLACE_ERROR', result.error);
        return;
      }
      room.board = result.board;
      io.to(room.code).emit('RELIC_PLACED', result.event);
    });

    socket.on('revive', (payload) => {
      const room = currentRoom();
      if (!room) {
        socket.emit('LINKED_FATES_ERROR', { code: 'INVALID_COORD', message: 'You are not in an active room.' });
        return;
      }
      const req = payload as LinkedFatesRequest;
      // reviverId is forced to the authenticated player, never trusted from the client.
      const result = reviveWithLinkedFates(
        room.board,
        { reviverId: playerId, sourceCoord: req.sourceCoord, targetCoord: req.targetCoord },
        room.registry
      );
      if (!result.ok) {
        socket.emit('LINKED_FATES_ERROR', result.error);
        return;
      }
      room.board = result.board;
      for (const e of result.events) io.to(room.code).emit(e.type, e.payload);
    });

    socket.on('disconnect', () => {
      const code = socket.data.roomCode;
      if (!code) return;
      const res = manager.leaveRoom(code, playerId);
      if (res.ok && !res.deleted && res.room) {
        io.to(code).emit('ROOM_UPDATE', { room: summarizeRoom(res.room) });
      }
    });
  });
}

// Production bootstrap. Imported lazily so tests never open a port.
export async function startServer(port: number): Promise<void> {
  const { Server } = await import('socket.io');
  const io = new Server(port, { cors: { origin: '*' } });
  const manager = new RoomManager();
  // socket.io's Server is structurally richer than SocketIOServerLike; cast at
  // this single boundary so the handler logic stays transport-agnostic.
  registerHandlers(io as unknown as SocketIOServerLike, manager);
  // eslint-disable-next-line no-console
  console.log(`Veins server listening on :${port}`);
}

const isMain = process.argv[1] !== undefined && process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  void startServer(Number(process.env.PORT) || 3001);
}
