import type { PlayerId, RoomCode, RoomStatus, PlayerState, DungeonLayout } from '@testament/shared';

// In-memory game state for one room. Never persisted (netcode invariant I7).
export type Room = {
  id: string;
  code: RoomCode;
  hostId: PlayerId;
  status: RoomStatus;
  // Seed for this run's procedural generation; empty until the run starts.
  runId: string;
  players: PlayerId[];
  // Current dungeon layout. Null until the run starts.
  dungeon: DungeonLayout | null;
  // Per-player position + HP. Populated on run start.
  playerStates: Map<PlayerId, PlayerState>;
  // Latest move direction per player; applied once per movement tick (I2).
  playerMoveInputs: Map<PlayerId, { dx: number; dy: number }>;
  // Players currently disconnected from an in-progress run. They remain in
  // `players` (membership preserved) and can rejoin via STATE_RESYNC. A run with
  // every player disconnected is deleted.
  disconnectedPlayers?: Set<PlayerId>;
};
