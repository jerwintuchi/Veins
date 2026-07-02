// The transport seam the handlers depend on. Transport-neutral so the same
// handler core runs over Socket.io, raw WebSocket, or a test fake. (Renamed from
// SocketIOServerLike now that the transport is raw WebSocket; TD-002.)
import type { PlayerId, RoomCode } from '@testament/shared';

// One client connection, as the handlers see it.
export interface ServerSocket {
  id: string;
  data: { playerId?: PlayerId; roomCode?: RoomCode | undefined };
  // Connection-derived identity (the client's stable player id). Never a
  // per-message field (invariant I2).
  handshake?: { auth?: Record<string, unknown> };
  on(event: string, listener: (payload: unknown) => void): void;
  emit(event: string, payload: unknown): void;
  join(room: string): void;
  leave?(room: string): void;
}

// Emits to every socket in one room.
export interface RoomEmitter {
  emit(event: string, payload: unknown): void;
}

// The whole server surface the handlers use.
export interface ServerHub {
  on(event: 'connection', listener: (socket: ServerSocket) => void): void;
  to(room: string): RoomEmitter;
}
