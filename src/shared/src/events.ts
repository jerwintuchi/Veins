import type { HexCoord, RelicId, PlayerId, SynergyMap, RelicBoard, Relic } from './board.js';
import type { BleedClockState, RunOutcome } from './bleedClock.js';
import type { DungeonLayout } from './dungeon.js';
import type { EnemyTypeId, PlayerState, AimState } from './combat.js';
import type { RoomSummary } from './lobby.js';

export type GamePhase = 'loot' | 'combat' | 'transition';

// Client -> Server. Note: no ownerId — the placing player's identity comes from
// the authenticated socket server-side, never a client-supplied field (I2).
export type PlaceRelicRequest = {
  coord: HexCoord;
  relicId: RelicId;
};

// Server -> Room (broadcast)
export type RelicPlacedEvent = {
  coord: HexCoord;
  relicId: RelicId;
  ownerId: PlayerId;
  synergyMap: SynergyMap;
};

// Server -> Socket (targeted error)
export type RelicPlaceErrorEvent = {
  code: 'SLOT_OCCUPIED' | 'WRONG_PHASE' | 'INVALID_COORD' | 'NOT_OWNER' | 'RELIC_NOT_IN_POOL' | 'DOWNED' | 'ALREADY_PLACED';
  message: string;
};

// Server -> Socket (on room join)
export type BoardStateSyncEvent = {
  board: RelicBoard;
  synergyMap: SynergyMap;
  relicRegistry: Record<RelicId, Relic>;
};

// Server -> Room (broadcast, before a Linked Fates transfer)
export type RelicRemovedEvent = {
  coord: HexCoord;
  relicId: RelicId;
  reason: 'linked-fates' | 'run-end';
};

// Client -> Server: reviver sacrifices a relic to revive a downed teammate
export type LinkedFatesRequest = {
  reviverId: PlayerId;
  sourceCoord: HexCoord; // reviver's slot holding the relic to sacrifice
  targetCoord: HexCoord; // downed teammate's slot to receive it
};

// Server -> Socket (targeted error for a failed revive)
export type LinkedFatesErrorEvent = {
  code: 'INVALID_COORD' | 'NOT_OWNER' | 'NO_RELIC' | 'SLOT_OCCUPIED' | 'WRONG_PHASE';
  message: string;
};

// Server -> Room (delta, every Bleed Clock tick)
// stage: 0=normal, 1=aggression(30-60% bled), 2=drain bonus(60-80%), 3=critical(80-100%)
export type BleedClockTickEvent = { clock: BleedClockState; stage: 0 | 1 | 2 | 3 };

// Server -> Room (broadcast once when stage crosses a new threshold)
export type BleedStageChangedEvent = { stage: 0 | 1 | 2 | 3 };

// Server -> Room (broadcast when a run ends)
export type RunEndedEvent = { outcome: RunOutcome; finalFloor: number; enemiesKilled: number };

// Server -> Room (broadcast when the party descends to a new floor)
// playerPositions: where each player is repositioned for the new floor (entry
// room). Lets the client snap sprites to the entry instead of leaving them where
// they stood on the previous floor (which could overlap fresh enemy spawns).
export type FloorAdvancedEvent = {
  floor: number;
  dungeon: DungeonLayout;
  playerPositions?: Record<PlayerId, { x: number; y: number }>;
};

// --- Enemy + Combat events (server -> room, delta only, I6) ---

// Emitted once per enemy when enemies are spawned on floor entry.
export type EnemySpawnedEvent = {
  enemyId: string;
  typeId: EnemyTypeId;
  x: number;
  y: number;
  hp: number;
};

// Emitted when an enemy takes damage; carries the new HP.
export type EnemyDamagedEvent = { enemyId: string; hp: number };

// Emitted when an enemy's HP reaches 0.
export type EnemyDiedEvent = { enemyId: string };

// Emitted when a player takes damage; carries the new HP.
export type PlayerDamagedEvent = { playerId: PlayerId; hp: number };

// Emitted when a player's HP reaches 0 (they become downed).
export type PlayerDownedEvent = { playerId: PlayerId };

// Emitted after a successful Linked Fates revive; carries the restored HP.
export type PlayerRevivedEvent = { playerId: PlayerId; hp: number };

// Emitted after the server validates and applies a move-player intention.
export type PlayerMovedEvent = { playerId: PlayerId; x: number; y: number };

// Emitted when the phase changes (e.g., combat -> loot when last enemy dies).
// lootPools (per-player, keyed by PlayerId) is included when phase === 'loot';
// each client reads its own entry by localPlayerId.
export type PhaseChangedEvent = { phase: GamePhase; lootPools?: Record<PlayerId, RelicId[]> };

// Emitted when a player's aim state changes (mode flip or auto-aim target shift).
export type PlayerAimChangedEvent = {
  playerId: PlayerId;
  mode:     'auto' | 'manual';
  targetId?: string | null; // present when mode === 'auto'
  dx?:      number;         // present when mode === 'manual'
  dy?:      number;         // present when mode === 'manual'
};

// Emitted once per frame when a projectile is spawned.
export type ProjectileFiredEvent = {
  projectileId: string;
  playerId:     string;
  x: number; y: number;
  dx: number; dy: number;
};

// Emitted when a projectile is destroyed (hit or range expiry).
export type ProjectileRemovedEvent = {
  projectileId: string;
  reason: 'hit' | 'range';
};

// Emitted each combat tick for every alive enemy that moved.
export type EnemyMovedEvent = { enemyId: string; x: number; y: number };

// Server -> Room (broadcast when a doctrine score threshold is crossed).
// Deliberately carries only flavor text — clients never learn which doctrine fired or its score.
export type BoardDoctrineShiftEvent = { flavor: string };

// Re-export PlayerState from combat.ts so socket consumers import from one place.
export type { PlayerState };

// Server -> Room (broadcast when a run starts).
export type RunStartedEvent = {
  dungeon: DungeonLayout;
  board: RelicBoard;
  synergyMap: SynergyMap;
  relicRegistry: Record<RelicId, Relic>;
  lootPools: Record<PlayerId, RelicId[]>;
  playerPositions: Record<PlayerId, { x: number; y: number }>;
  // Floor-1 enemies travel in the RUN_STARTED payload (not as separate
  // ENEMY_SPAWNED events) because the Phaser scene binds its socket listeners
  // only after this event fires — same reason dungeon/playerPositions ride here.
  enemies: { enemyId: string; typeId: EnemyTypeId; x: number; y: number; hp: number }[];
};

// Server -> single socket (reconnection). The full snapshot needed to rebuild a
// fresh client's render state after a disconnect. This is the ONLY full-state push
// besides the initial BOARD_STATE_SYNC (I6 exception); never broadcast to a room.
export type StateResyncEvent = {
  room: RoomSummary;
  phase: GamePhase;
  floor: number;
  dungeon: DungeonLayout | null;
  board: RelicBoard;
  synergyMap: SynergyMap;
  relicRegistry: Record<RelicId, Relic>;
  lootPools: Record<PlayerId, RelicId[]>;
  bleedClock: BleedClockState;
  bleedStage: 0 | 1 | 2 | 3;
  outcome: RunOutcome | null;
  playerStates: Record<PlayerId, PlayerState>;
  aimStates: Record<PlayerId, AimState>;
  enemies: { enemyId: string; typeId: EnemyTypeId; x: number; y: number; hp: number }[];
  projectiles: { projectileId: string; playerId: string; x: number; y: number; dx: number; dy: number }[];
  disconnectedPlayers: PlayerId[];
};

// Server -> Room (broadcast when a player disconnects from / rejoins an in-progress run).
export type PlayerConnectionChangedEvent = { playerId: PlayerId; connected: boolean };
