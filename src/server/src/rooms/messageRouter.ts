import type { RoomManager } from './RoomManager.js';
import type { ReconnectTokenStore } from './ReconnectTokenStore.js';
import type { SessionArchive } from './SessionArchive.js';
import type { EmitFn, EmitToFn, BroadcastFn } from './types.js';
import { handleCreateRoom } from './handlers/createRoom.js';
import { handleJoinRoom } from './handlers/joinRoom.js';
import { handleToggleReady } from './handlers/toggleReady.js';
import { handleAcceptContract } from './handlers/acceptContract.js';
import { handleLeaveRoom } from './handlers/leaveRoom.js';
import { handleReconnect } from './handlers/reconnect.js';
import { handleDeploy } from './handlers/deploy.js';
import { handleExtract } from './handlers/extract.js';
import { handleProbe } from './handlers/probe.js';
import { handleUnknownMessage } from './handlers/unknown.js';

export function routeMessage(
  socketId: string,
  raw: string,
  roomManager: RoomManager,
  tokenStore: ReconnectTokenStore,
  emit: EmitFn,
  emitTo: EmitToFn,
  broadcast: BroadcastFn,
  sessionArchive: SessionArchive,
): void {
  let parsed: { type?: unknown; payload?: unknown };
  try {
    parsed = JSON.parse(raw) as { type?: unknown; payload?: unknown };
  } catch {
    emit('LOBBY_ERROR', { code: 'INVALID_PAYLOAD', message: 'Message is not valid JSON.' });
    return;
  }

  if (typeof parsed.type !== 'string') {
    emit('LOBBY_ERROR', { code: 'INVALID_PAYLOAD', message: 'Message must have a string "type" field.' });
    return;
  }

  const { type, payload } = parsed;

  switch (type) {
    case 'CREATE_ROOM':
      handleCreateRoom(socketId, payload, roomManager, tokenStore, emit);
      break;
    case 'JOIN_ROOM':
      handleJoinRoom(socketId, payload, roomManager, tokenStore, emit, broadcast);
      break;
    case 'TOGGLE_READY':
      handleToggleReady(socketId, roomManager, emit, broadcast);
      break;
    case 'ACCEPT_CONTRACT':
      handleAcceptContract(socketId, roomManager, emit, broadcast);
      break;
    case 'LEAVE_ROOM':
      handleLeaveRoom(socketId, roomManager, emit, broadcast);
      break;
    case 'RECONNECT':
      handleReconnect(socketId, payload, roomManager, tokenStore, sessionArchive, emit, broadcast);
      break;
    case 'DEPLOY':
      handleDeploy(socketId, roomManager, tokenStore, emit, emitTo, broadcast);
      break;
    case 'EXTRACT':
      handleExtract(socketId, roomManager, sessionArchive, emit, broadcast);
      break;
    case 'PROBE':
      handleProbe(socketId, payload, roomManager, emit, broadcast);
      break;
    default:
      handleUnknownMessage(socketId, type, emit);
  }
}
