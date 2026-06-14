import type { BoardStateSyncEvent } from '@veins/shared';
import { evaluateSynergies } from '../board/synergy.js';
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
