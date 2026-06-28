import type { BoardStateSyncEvent, StateResyncEvent } from '@testament/shared';
import { evaluateSynergies } from '../board/synergy.js';
import { bleedStageOf } from './state.js';
import type { Room } from './state.js';

// Minimal surface of a Socket.io socket we depend on. Keeping it abstract makes
// the sync logic testable without a live server and documents that we emit to a
// SINGLE socket, never a room broadcast (R1: sync targets the joining player only).
export interface SocketLike {
  emit(event: string, payload: unknown): void;
}

// Builds the full board snapshot for a joining player. The synergy map is
// computed fresh from current board state on every call — Room never caches it,
// so a stale map is impossible by construction (R1).
export function buildBoardStateSync(room: Room): BoardStateSyncEvent {
  return {
    board: room.board,
    synergyMap: evaluateSynergies(room.board, room.registry),
    relicRegistry: Object.fromEntries(room.registry),
  };
}

// Emits BOARD_STATE_SYNC to the joining socket only. The signature accepts a
// single socket, not the room/io broadcaster, so a whole-room broadcast is
// structurally impossible here.
export function syncBoardToSocket(socket: SocketLike, room: Room): void {
  socket.emit('BOARD_STATE_SYNC', buildBoardStateSync(room));
}

// Builds the full reconnection snapshot for a rejoining player (reconnection spec
// R4). Pure function of room state — synergy is recomputed fresh (never cached),
// bleed stage is derived, enemies are filtered to alive only. Same room in →
// same snapshot out (P1). This is the only full-state push besides the initial
// board sync (I6 exception).
export function buildStateResync(room: Room): StateResyncEvent {
  return {
    room: { code: room.code, status: room.status, hostId: room.hostId, players: room.players },
    phase: room.phase,
    floor: room.floor,
    dungeon: room.dungeon,
    board: room.board,
    synergyMap: evaluateSynergies(room.board, room.registry),
    relicRegistry: Object.fromEntries(room.registry),
    lootPools: room.lootPools,
    bleedClock: room.bleedClock,
    bleedStage: bleedStageOf(room.bleedClock.current, room.bleedClock.max),
    outcome: room.outcome,
    playerStates: Object.fromEntries(room.playerStates),
    aimStates: Object.fromEntries(room.aimStates),
    enemies: [...room.enemies.values()]
      .filter(e => e.alive)
      .map(e => ({ enemyId: e.id, typeId: e.typeId, x: e.x, y: e.y, hp: e.hp })),
    projectiles: [...room.projectiles.values()]
      .map(p => ({ projectileId: p.id, playerId: p.ownerId, x: p.x, y: p.y, dx: p.dx, dy: p.dy })),
    disconnectedPlayers: room.disconnectedPlayers ? [...room.disconnectedPlayers] : [],
  };
}

// Emits STATE_RESYNC to the rejoining socket only. Single-socket signature makes
// a room broadcast structurally impossible (P2).
export function syncResyncToSocket(socket: SocketLike, room: Room): void {
  socket.emit('STATE_RESYNC', buildStateResync(room));
}
