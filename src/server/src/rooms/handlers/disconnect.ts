import type { RoomManager } from '../RoomManager.js';
import type { BroadcastFn } from '../types.js';
import { reassignLeader } from '../leaderElection.js';
import { toSnapshot } from '../snapshot.js';

export function handleSocketDisconnect(
  socketId: string,
  roomManager: RoomManager,
  broadcast: BroadcastFn,
): void {
  const room = roomManager.getRoomBySocketId(socketId);
  if (!room) return;

  const player = room.players.find(p => p.socketId === socketId);
  if (!player) return;

  const wasLeader = player.isLeader;
  player.disconnectedAt = Date.now();
  player.socketId = '';

  // If all players are disconnected, destroy the room.
  if (room.players.every(p => p.disconnectedAt !== null)) {
    roomManager.destroyRoom(room.code);
    return;
  }

  if (wasLeader) {
    // Elect the first still-connected player as leader.
    const connected = room.players.filter(p => p.disconnectedAt === null);
    if (connected.length > 0) {
      room.players = reassignLeader(room.players.map(p =>
        p.playerId === connected[0]!.playerId ? { ...p, isLeader: true } : { ...p, isLeader: false }
      ));
    }
  }

  broadcast(room.code, 'LOBBY_UPDATED', { snapshot: toSnapshot(room) });
}
