import { randomUUID } from 'node:crypto';
import { MAX_ROOM_PLAYERS } from '@testament/shared';
import type { RoomManager } from '../RoomManager.js';
import type { ReconnectTokenStore } from '../ReconnectTokenStore.js';
import type { EmitFn, BroadcastFn, ServerPlayerEntry } from '../types.js';
import { sanitizeDisplayName } from '../sanitize.js';
import { toSnapshot } from '../snapshot.js';

export function handleJoinRoom(
  socketId: string,
  payload: unknown,
  roomManager: RoomManager,
  tokenStore: ReconnectTokenStore,
  emit: EmitFn,
  broadcast: BroadcastFn,
): void {
  const p = payload as Record<string, unknown> | null;
  if (typeof p !== 'object' || p === null || typeof p['code'] !== 'string') {
    emit('LOBBY_ERROR', { code: 'INVALID_PAYLOAD', message: 'Payload must include a string code.' });
    return;
  }

  const nameResult = sanitizeDisplayName(p['displayName']);
  if (typeof nameResult === 'object') {
    emit('LOBBY_ERROR', { code: 'INVALID_PAYLOAD', message: nameResult.reason });
    return;
  }

  const code = p['code'] as string;
  const room = roomManager.getRoom(code);
  if (!room) {
    emit('LOBBY_ERROR', { code: 'ROOM_NOT_FOUND', message: 'No room with that code.' });
    return;
  }
  if (room.phase !== 'WAITING') {
    emit('LOBBY_ERROR', { code: 'ALREADY_DEPLOYING', message: 'That room is no longer accepting players.' });
    return;
  }
  if (room.players.length >= MAX_ROOM_PLAYERS) {
    emit('LOBBY_ERROR', { code: 'ROOM_FULL', message: 'That room is full.' });
    return;
  }

  const player: ServerPlayerEntry = {
    playerId: randomUUID(),
    displayName: nameResult,
    socketId,
    isLeader: false,
    readyState: false,
    disconnectedAt: null,
  };
  room.players.push(player);

  const token = tokenStore.issue(player.playerId, room.code);
  const snap = toSnapshot(room);
  broadcast(code, 'LOBBY_UPDATED', { snapshot: snap });
  emit('RECONNECT_TOKEN', { reconnectToken: token });
}
