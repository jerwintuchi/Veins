import type { RoomManager } from '../RoomManager.js';
import type { EmitFn, BroadcastFn } from '../types.js';
import { toSnapshot } from '../snapshot.js';

export function handleToggleReady(
  socketId: string,
  roomManager: RoomManager,
  emit: EmitFn,
  broadcast: BroadcastFn,
): void {
  const room = roomManager.getRoomBySocketId(socketId);
  if (!room) {
    emit('LOBBY_ERROR', { code: 'NOT_IN_ROOM', message: 'You are not in any room.' });
    return;
  }
  if (room.phase !== 'WAITING') {
    emit('LOBBY_ERROR', { code: 'INVALID_PAYLOAD', message: 'Cannot toggle ready outside of WAITING phase.' });
    return;
  }

  const player = room.players.find(p => p.socketId === socketId)!;
  player.readyState = !player.readyState;
  broadcast(room.code, 'LOBBY_UPDATED', { snapshot: toSnapshot(room) });
}
