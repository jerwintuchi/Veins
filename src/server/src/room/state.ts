import type {
  RelicBoard,
  Relic,
  RelicId,
  PlayerId,
  GamePhase,
  RoomCode,
  RoomStatus,
  BleedClockState,
  RunOutcome,
  PlayerState,
  DungeonLayout,
  AimState,
  ProjectileState,
} from '@veins/shared';
import type { EnemyId, EnemyState } from '../combat/types.js';
import type { Rng } from '../rng/seeded.js';
import { createRng } from '../rng/seeded.js';

// In-memory game state for one room. Never persisted (netcode invariant I7).
export type Room = {
  id: string;
  code: RoomCode;
  hostId: PlayerId;
  status: RoomStatus;
  runId: string;
  players: PlayerId[];
  board: RelicBoard;
  registry: Map<RelicId, Relic>;
  phase: GamePhase;
  floor: number;
  bleedClock: BleedClockState;
  outcome: RunOutcome | null;
  // Current floor dungeon layout. Null until run starts; replaced on descend.
  dungeon: DungeonLayout | null;
  // Enemy combat state. Empty until first run starts; replaced on each descend.
  enemies: Map<EnemyId, EnemyState>;
  // Per-player HP + position + downed flag. Initialised on run start (R2).
  playerStates: Map<PlayerId, PlayerState>;
  // Per-player aim mode. Starts 'auto' for every player; updated by aim-player
  // socket events and the combat tick auto-aim refresh (R4, R8).
  aimStates: Map<PlayerId, AimState>;
  // Active in-flight projectiles (weapon spec R3).
  projectiles: Map<string, ProjectileState>;
  // ms remaining until each player can fire again; starts at 0 (fire immediately).
  weaponCooldowns: Map<PlayerId, number>;
  // Latest move direction from move-player events; applied once per tick (R4).
  playerMoveInputs: Map<PlayerId, { dx: number; dy: number }>;
  // Monotonic counter for generating unique projectile IDs.
  nextProjectileId: number;
  // Relics available to place during the current loot phase. Reset by
  // generateLootPool on run start and each loot-phase entry.
  lootPool: RelicId[];
  // Fire DoT remaining duration per enemy, in seconds. Cleared on floor descend.
  fireDurations: Map<EnemyId, number>;
  // Per-run seeded RNG for combat randomness (synaptic-filament chain, etc.). Advances
  // across floors — intentionally not reset on descend.
  combatRng: Rng;
  // Cumulative enemies killed across all floors this run.
  enemiesKilled: number;

  // --- Doctrine scoring (doctrine spec R8-R11). Optional: set on run start; absent in lobby. ---
  doctrineScores?: { sanctum: number; tumor: number; chorus: number; penitent: number };
  doctrineThresholdsFired?: Set<string>; // keys: 'sanctum-1', 'tumor-2', etc.
  bleedDrainMult?: number;          // Sanctum tier-1 sets to 0.9 (10% slower drain)
  chorusVotiveBonus?: boolean;      // Chorus tier-1 doubles votive-tissue protection
  tumorAggressionActive?: boolean;  // Tumor tier-1 speeds up enemy attacks 15%
  penitentFreeRevive?: boolean;     // Penitent tier-1: next revive skips relic sacrifice
  lastAttackerByEnemy?: Map<EnemyId, PlayerId>; // for Tumor kill attribution

  // --- Reconnection (specs/reconnection). Players currently disconnected from an
  // in-progress run. They remain in `players` (ownership/synergy preserved) and can
  // rejoin via STATE_RESYNC. A run with every player disconnected is deleted. ---
  disconnectedPlayers?: Set<PlayerId>;
};

// Placeholder tuning — moves to the Bleed Clock spec when that work begins.
const BASE_DRAIN_PER_SECOND = 1;
const DRAIN_INCREASE_PER_FLOOR = 0.5;

// Deeper floors drain the Bleed Clock faster (docs/systems/bleed-clock.md).
export function drainRateForFloor(floor: number): number {
  return BASE_DRAIN_PER_SECOND + (floor - 1) * DRAIN_INCREASE_PER_FLOOR;
}

// --- Bleed Clock stage system (docs/systems/bleed-clock.md) ---
// Stage is determined by how much of the clock has bled (not floor depth).
// ratio = current/max; pct_bled = 1 - ratio.
export type BleedStage = 0 | 1 | 2 | 3;

export function bleedStageOf(current: number, max: number): BleedStage {
  if (max <= 0) return 3;
  const pctBled = 1 - current / max;
  if (pctBled < 0.3) return 0;
  if (pctBled < 0.6) return 1;
  if (pctBled < 0.8) return 2;
  return 3;
}

// Stage 1: enemies attack 30% faster (attackCooldown × this multiplier).
export const AGGRESSION_COOLDOWN_MULT = 0.7;
// Stage 2: drain rate multiplied (reality destabilises faster).
export const DRAIN_MULT_STAGE2 = 1.5;
// Stage 3: drain rate multiplied further.
export const DRAIN_MULT_STAGE3 = 2.0;

// Descending a floor must NOT touch the Circulatory Board (Circulatory Board
// spec R5) and must NOT reset the Bleed Clock's current value (Bleed Clock spec
// R6). Only the floor counter and the drain rate change; the board carries over
// intact and tension compounds across floors.
export function advanceFloor(room: Room): Room {
  const nextFloor = room.floor + 1;
  return {
    ...room,
    floor: nextFloor,
    bleedClock: {
      ...room.bleedClock,
      drainPerSecond: drainRateForFloor(nextFloor),
    },
    // board is intentionally carried over by reference — never reset.
  };
}
