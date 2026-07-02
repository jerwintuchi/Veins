import type { RoomManager } from '../RoomManager.js';
import type { ReconnectTokenStore } from '../ReconnectTokenStore.js';
import type { EmitFn } from '../types.js';
import { sanitizeDisplayName } from '../sanitize.js';
import { toSnapshot } from '../snapshot.js';

export function handleCreateRoom(
  socketId: string,
  payload: unknown,
  roomManager: RoomManager,
  tokenStore: ReconnectTokenStore,
  emit: EmitFn,
): void {
  const p = payload as Record<string, unknown> | null;
  if (typeof p !== 'object' || p === null) {
    emit('LOBBY_ERROR', { code: 'INVALID_PAYLOAD', message: 'Payload must be an object.' });
    return;
  }

  const nameResult = sanitizeDisplayName(p['displayName']);
  if (typeof nameResult === 'object') {
    emit('LOBBY_ERROR', { code: 'INVALID_PAYLOAD', message: nameResult.reason });
    return;
  }

  const room = roomManager.createRoom(socketId, nameResult);
  const player = room.players[0]!;
  const token = tokenStore.issue(player.playerId, room.code);
  emit('ROOM_CREATED', { snapshot: toSnapshot(room), reconnectToken: token });
}
