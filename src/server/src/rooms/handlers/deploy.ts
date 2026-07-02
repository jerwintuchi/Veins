import type { RoomManager } from '../RoomManager.js';
import type { ReconnectTokenStore } from '../ReconnectTokenStore.js';
import type { EmitFn, EmitToFn, BroadcastFn } from '../types.js';
import { buildStubFieldData } from '../fieldData.js';
import { assertPhase } from '../phaseGuard.js';
import { deriveAmbientSigns } from '../../incarnate/deriveSigns.js';

export function handleDeploy(
  socketId: string,
  roomManager: RoomManager,
  tokenStore: ReconnectTokenStore,
  emit: EmitFn,
  emitTo: EmitToFn,
  _broadcast: BroadcastFn,
): void {
  const room = roomManager.getRoomBySocketId(socketId);
  if (!assertPhase(room, 'DEPLOYING', emit)) return;

  const sender = room.players.find(p => p.socketId === socketId);
  if (!sender?.isLeader) {
    emit('LOBBY_ERROR', { code: 'NOT_LEADER', message: 'Only the leader can initiate deployment.' });
    return;
  }

  // room.contract is guaranteed non-null when phase is DEPLOYING (set by acceptContract).
  const contract  = room.contract!;
  const fieldData = buildStubFieldData(contract);
  // Ambient signs only — the REACTION channel is probe-gated (R58, P22).
  const signs     = deriveAmbientSigns(contract.traitRoll, contract.tier);

  room.phase         = 'FIELD';
  room.fieldData     = fieldData;
  room.exposure      = 0;
  room.revealedSigns = [];

  // FIELD_STARTED is per-player: each player needs their own reconnect token.
  for (const player of room.players) {
    const token = tokenStore.issue(player.playerId, room.code);
    emitTo(player.socketId, 'FIELD_STARTED', { fieldData, reconnectToken: token, signs });
  }
}
