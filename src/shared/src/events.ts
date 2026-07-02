// Wire-protocol message payloads (server <-> client). Types only (invariant I4).
// After the initial sync the server sends delta events only (I6).
import type { DungeonLayout } from './dungeon.js';
import type { PlayerId } from './ids.js';
import type { PlayerState } from './player.js';
import type { RoomSummary } from './lobby.js';

// Client -> Server: per-frame movement direction. The server applies it once per
// tick regardless of how many arrive (no client-authored position; I2).
export type MovePlayerRequest = { dx: number; dy: number };

// Server -> Room (broadcast when a run starts): the dungeon and each player's
// starting position.
export type RunStartedEvent = {
  dungeon: DungeonLayout;
  playerPositions: Record<PlayerId, { x: number; y: number }>;
};

// Server -> Room: the server applied a validated move.
export type PlayerMovedEvent = { playerId: PlayerId; x: number; y: number };

// Server -> Room: a player disconnected from / rejoined an in-progress run.
export type PlayerConnectionChangedEvent = { playerId: PlayerId; connected: boolean };

// Server -> single socket (reconnection). The full snapshot to rebuild a fresh
// client's render state. The only full-state push (I6 exception); never a room broadcast.
export type StateResyncEvent = {
  room: RoomSummary;
  dungeon: DungeonLayout | null;
  playerStates: Record<PlayerId, PlayerState>;
  disconnectedPlayers: PlayerId[];
};
