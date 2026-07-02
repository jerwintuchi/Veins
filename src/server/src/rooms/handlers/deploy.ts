import type { RoomManager } from '../RoomManager.js';
import type { ReconnectTokenStore } from '../ReconnectTokenStore.js';
import type { EmitFn, EmitToFn, BroadcastFn } from '../types.js';
import { buildStubFieldData } from '../fieldData.js';
import { assertPhase } from '../phaseGuard.js';
import { deriveAmbientSigns } from '../../incarnate/deriveSigns.js';
import { assignPerception, channelsForTier, filterSigns } from '../perception.js';
import { createRng, hashSeed } from '../../rng/seeded.js';

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

  // Distributed Perception (R61): a domain-suffixed sub-seed keeps the assignment
  // deterministic per expedition (I3) without replaying the contract rng sequence.
  const perceptionRng = createRng(hashSeed(contract.expeditionSeed + ':perception'));
  const assignment = assignPerception(
    perceptionRng,
    room.players.map(p => p.playerId),
    channelsForTier(contract.tier),
  );

  // FIELD_STARTED is per-player: own reconnect token, own filtered signs.
  for (const player of room.players) {
    player.perceivedChannels = assignment.get(player.playerId)!;
    const token = tokenStore.issue(player.playerId, room.code);
    emitTo(player.socketId, 'FIELD_STARTED', {
      fieldData,
      reconnectToken:    token,
      signs:             filterSigns(signs, player.perceivedChannels),
      perceivedChannels: player.perceivedChannels,
    });
  }
}
