import type { StateResyncEvent } from '@testament/shared';
import type { Room } from './state.js';

// Minimal surface of a socket we depend on: we emit to a SINGLE socket, never a
// room broadcast (reconnection sync targets the rejoining player only).
export interface SocketLike {
  emit(event: string, payload: unknown): void;
}

// Builds the full reconnection snapshot for a rejoining player. Pure function of
// room state: same room in -> same snapshot out. This is the only full-state push (I6 exception).
export function buildStateResync(room: Room): StateResyncEvent {
  return {
    room: { code: room.code, status: room.status, hostId: room.hostId, players: room.players },
    dungeon: room.dungeon,
    playerStates: Object.fromEntries(room.playerStates),
    disconnectedPlayers: room.disconnectedPlayers ? [...room.disconnectedPlayers] : [],
  };
}

// Emits STATE_RESYNC to the rejoining socket only. The single-socket signature
// makes a room broadcast structurally impossible.
export function syncResyncToSocket(socket: SocketLike, room: Room): void {
  socket.emit('STATE_RESYNC', buildStateResync(room));
}
