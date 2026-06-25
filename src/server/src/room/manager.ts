import { randomUUID } from 'node:crypto';
import type { AimState, DungeonLayout, LobbyErrorEvent, PlayerId, RoomCode, PlayerState } from '@veins/shared';
import { MAX_PLAYERS, MIN_PLAYERS_TO_START as GAME_MIN_PLAYERS, HEX_BOARD_RADIUS, PLAYER_MAX_HP, STARTER_RELICS } from '@veins/shared';

// Solo play is supported (GAME_MIN_PLAYERS === 1). Set DEV_MIN_PLAYERS higher (e.g. 2)
// to force co-op-only behaviour for testing.
const MIN_PLAYERS_TO_START = parseInt(process.env['DEV_MIN_PLAYERS'] ?? String(GAME_MIN_PLAYERS), 10);
import type { BleedClockTickEvent, RunEndedEvent, FloorAdvancedEvent } from '@veins/shared';
import { generateDungeon } from '../dungeon/bsp.js';
import { buildInitialBoard } from '../board/layout.js';
import { advanceBleedForRoom, extractRun } from '../bleed/clock.js';
import { descendFloor } from '../floor/progression.js';
import { spawnEnemies } from '../combat/spawn.js';
import { drainRateForFloor, type Room } from './state.js';
import { generateRoomCode } from './roomCode.js';
import { generateLootPool } from '../loot/pool.js';
import { createRng, hashSeed } from '../rng/seeded.js';

const DUNGEON_START_HP = 1000;

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
      board: { slots: {} },
      registry: new Map(),
      phase: 'loot',
      floor: 0,
      bleedClock: { current: 0, max: 0, drainPerSecond: 0 },
      outcome: null,
      dungeon: null,
      enemies: new Map(),
      playerStates: new Map(),
      aimStates: new Map(),
      projectiles: new Map(),
      weaponCooldowns: new Map(),
      playerMoveInputs: new Map(),
      nextProjectileId: 0,
      lootPool: [],
      fireDurations: new Map(),
      combatRng: createRng(0),
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
  // — kept in `players` so board ownership/synergy are unchanged (the same guarantee
  // solo-play relies on) and recorded in `disconnectedPlayers` so they can rejoin.
  // A run with every player disconnected is deleted so the tick loop never runs an
  // abandoned room (R2).
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
  // clearing their disconnected flag. The caller emits STATE_RESYNC (R3, R4).
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
    room.board = buildInitialBoard(room.players, HEX_BOARD_RADIUS);
    room.floor = 1;
    room.phase = 'combat';
    room.bleedClock = {
      current: DUNGEON_START_HP,
      max: DUNGEON_START_HP,
      drainPerSecond: drainRateForFloor(1),
    };
    room.dungeon = dungeon;
    // Initialise per-player HP and position (R2). Players start at the dungeon
    // entry point (room-0 centre); position refinement belongs to the encounter spec.
    const entryRoom = dungeon.rooms[0];
    const startX = entryRoom ? entryRoom.rect.x + entryRoom.rect.width / 2 : 0;
    const startY = entryRoom ? entryRoom.rect.y + entryRoom.rect.height / 2 : 0;
    room.playerStates = new Map<string, PlayerState>(
      room.players.map(id => [id, { hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP, downed: false, x: startX, y: startY }])
    );
    // All players start in auto-aim mode; target is null until first combat tick (R4).
    room.aimStates = new Map<string, AimState>(
      room.players.map(id => [id, { mode: 'auto', targetId: null }])
    );
    // Weapon system: no projectiles yet, cooldowns start at 0 (fire immediately),
    // move inputs start at rest (R3).
    room.projectiles      = new Map();
    room.weaponCooldowns  = new Map(room.players.map(id => [id, 0]));
    room.playerMoveInputs = new Map(room.players.map(id => [id, { dx: 0, dy: 0 }]));
    room.nextProjectileId = 0;
    // Populate the relic registry with the starter set.
    room.registry = new Map(STARTER_RELICS.map(r => [r.id, r]));
    // Spawn floor-1 enemies immediately — run starts in combat, not loot.
    room.enemies = spawnEnemies(runId, 1, dungeon);
    // Loot pool is empty until enemies are cleared; filled on phase transition to loot.
    room.lootPool = [];
    // Combat RNG seeded from runId; advances across floors (not reset on descend).
    room.combatRng = createRng(hashSeed(`${runId}#combat`));
    room.enemiesKilled = 0;

    // Doctrine scoring state — initialized fresh each run.
    room.doctrineScores = { sanctum: 0, tumor: 0, chorus: 0, penitent: 0 };
    room.doctrineThresholdsFired = new Set();
    room.bleedDrainMult = 1;
    room.chorusVotiveBonus = false;
    room.tumorAggressionActive = false;
    room.penitentFreeRevive = false;
    room.lastAttackerByEnemy = new Map();

    return { ok: true, room, dungeon };
  }

  // Rooms with an active run — drives the Bleed Clock tick loop.
  activeRooms(): Room[] {
    return [...this.rooms.values()].filter(r => r.status === 'in-progress');
  }

  // Advances a room's Bleed Clock by dt seconds. Returns the tick (and a
  // RUN_ENDED payload if the clock depleted), or undefined if no such room.
  tickRoom(code: RoomCode, deltaSeconds: number):
    | { tick: BleedClockTickEvent; ended: RunEndedEvent | null }
    | undefined {
    const room = this.rooms.get(code);
    if (!room) return undefined;
    return advanceBleedForRoom(room, deltaSeconds);
  }

  // Voluntary extraction. Ends an in-progress run as 'extracted'.
  extractRoom(code: RoomCode): { ok: true; ended: RunEndedEvent } | { ok: false } {
    const room = this.rooms.get(code);
    if (!room) return { ok: false };
    return extractRun(room);
  }

  // Descends a room to the next floor. Updates the dungeon, spawns enemies for
  // the new floor, and transitions phase to combat (T11, R3).
  descendRoom(code: RoomCode): { ok: true; event: FloorAdvancedEvent } | { ok: false } {
    const room = this.rooms.get(code);
    if (!room) return { ok: false };
    const res = descendFloor(room); // sets room.floor, room.dungeon, room.phase='combat'
    if (!res.ok) return { ok: false };
    // Fire DoT does not persist across floor boundaries.
    room.fireDurations = new Map();
    // Spawn enemies for the new floor (deterministic from runId + floor).
    room.enemies = spawnEnemies(room.runId, room.floor, res.event.dungeon);
    // If the dungeon somehow has no non-entry rooms (degenerate case), skip straight
    // to loot phase — combat with zero enemies would flip phase on the first tick
    // anyway, but doing it here avoids a spurious PHASE_CHANGED event.
    if (room.enemies.size === 0) room.phase = 'loot';
    return res;
  }
}
