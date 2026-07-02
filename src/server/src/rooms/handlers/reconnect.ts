import type { RoomManager } from '../RoomManager.js';
import type { ReconnectTokenStore } from '../ReconnectTokenStore.js';
import type { SessionArchive } from '../SessionArchive.js';
import type { EmitFn, BroadcastFn } from '../types.js';
import { toSnapshot, buildFieldSnapshot } from '../snapshot.js';

export function handleReconnect(
  socketId: string,
  payload: unknown,
  roomManager: RoomManager,
  tokenStore: ReconnectTokenStore,
  sessionArchive: SessionArchive,
  emit: EmitFn,
  broadcast: BroadcastFn,
): void {
  const p = payload as Record<string, unknown> | null;
  if (typeof p !== 'object' || p === null || typeof p['token'] !== 'string') {
    emit('LOBBY_ERROR', { code: 'INVALID_PAYLOAD', message: 'Payload must include a string token.' });
    return;
  }

  const token = p['token'] as string;
  const entry = tokenStore.resolve(token);
  if (!entry) {
    // Distinguish expired vs unknown by checking if we can still find it (already cleaned up).
    emit('LOBBY_ERROR', { code: 'TOKEN_NOT_FOUND', message: 'Token not found or expired.' });
    return;
  }

  const room = roomManager.getRoom(entry.roomCode);
  if (!room) {
    emit('LOBBY_ERROR', { code: 'ROOM_NOT_FOUND', message: 'The room no longer exists.' });
    return;
  }

  const player = room.players.find(p => p.playerId === entry.playerId);
  if (!player) {
    emit('LOBBY_ERROR', { code: 'ROOM_NOT_FOUND', message: 'Player not found in room.' });
    return;
  }

  // Re-associate socket and clear disconnect timestamp.
  player.socketId = socketId;
  player.disconnectedAt = null;

  const newToken = tokenStore.issue(player.playerId, room.code);
  emit('STATE_RESYNC', {
    snapshot: toSnapshot(room),
    fieldSnapshot: buildFieldSnapshot(room, sessionArchive, player.playerId),
    reconnectToken: newToken,
  });
  broadcast(room.code, 'LOBBY_UPDATED', { snapshot: toSnapshot(room) });
}
