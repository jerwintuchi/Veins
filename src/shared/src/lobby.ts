// Lobby and room types and constants. Types/constants only (invariant I4).
import type { PlayerId } from './ids.js';

export const MAX_PLAYERS = 4;
// Solo play is supported: a lone host can start a run. Set DEV_MIN_PLAYERS higher
// (server-side) to force co-op-only behaviour for testing.
export const MIN_PLAYERS_TO_START = 1;

export type RoomCode = string;
export type RoomStatus = 'lobby' | 'in-progress' | 'ended';

export type RoomSummary = {
  code: RoomCode;
  status: RoomStatus;
  hostId: PlayerId;
  players: PlayerId[];
};

// Client -> Server
export type JoinRoomRequest = { code: RoomCode; playerId: PlayerId };

// Server -> client / room
export type RoomUpdateEvent = { room: RoomSummary };

export type LobbyErrorEvent = {
  code:
    | 'ROOM_NOT_FOUND'
    | 'ROOM_FULL'
    | 'ALREADY_STARTED'
    | 'ALREADY_IN_ROOM'
    | 'NOT_ENOUGH_PLAYERS'
    | 'NOT_IN_ROOM'
    | 'INVALID_REQUEST'
    | 'CANNOT_REJOIN';
  message: string;
};
