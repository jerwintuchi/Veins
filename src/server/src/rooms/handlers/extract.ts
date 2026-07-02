import type { RoomManager } from '../RoomManager.js';
import type { SessionArchive } from '../SessionArchive.js';
import type { EmitFn, BroadcastFn } from '../types.js';
import { buildStubTestament } from '../testament.js';
import { assertPhase } from '../phaseGuard.js';

export function handleExtract(
  socketId: string,
  roomManager: RoomManager,
  sessionArchive: SessionArchive,
  emit: EmitFn,
  broadcast: BroadcastFn,
): void {
  const room = roomManager.getRoomBySocketId(socketId);
  if (!assertPhase(room, 'FIELD', emit)) return;

  const testament = buildStubTestament(room);
  const code = room.code;

  room.phase = 'COMPLETE';
  broadcast(code, 'FIELD_TESTAMENT', { testament });

  sessionArchive.append(code, testament.entries);
  const entries = sessionArchive.getEntries(code);
  broadcast(code, 'ARCHIVE_UPDATED', { entries });

  roomManager.destroyRoom(code);
  sessionArchive.destroyArchive(code);
}
