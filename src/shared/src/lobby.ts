// Lobby + room types and constants. Types/constants only (invariant I4).
import type { PlayerId, RelicBoard, SynergyMap } from './board.js';
import type { DungeonLayout } from './dungeon.js';

export const MAX_PLAYERS = 4;
// Solo play is supported: a lone host can start a run (synergy relaxes for solo
// boards — see specs/solo-play). Set DEV_MIN_PLAYERS higher to force co-op-only.
export const MIN_PLAYERS_TO_START = 1;
export const HEX_BOARD_RADIUS = 2; // radius-2 hexagon = 19 cells

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

export type RunStartedEvent = {
  dungeon: DungeonLayout;
  board: RelicBoard;
  synergyMap: SynergyMap;
};

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
