import type { LobbySnapshot, FieldSnapshot } from '@testament/shared';
import type { RoomRecord } from './types.js';
import type { SessionArchive } from './SessionArchive.js';
import { toPublicPlayer } from './types.js';
import { toContractIntel } from '../incarnate/generateContract.js';
import { deriveAmbientSigns } from '../incarnate/deriveSigns.js';
import { filterSigns } from './perception.js';

// Pure function. Strips server-only fields before sending to any client (I5, P2).
export function toSnapshot(room: RoomRecord): LobbySnapshot {
  return {
    roomCode: room.code,
    phase: room.phase,
    players: room.players.map(toPublicPlayer),
    contract: room.contract ? toContractIntel(room.contract) : null,
  };
}

// Returns null when the room is not in FIELD phase (A8) or the player is unknown.
export function buildFieldSnapshot(
  room: RoomRecord,
  archive: SessionArchive,
  playerId: string,
): FieldSnapshot | null {
  if (room.phase !== 'FIELD' || !room.fieldData || !room.contract) return null;
  const player = room.players.find(p => p.playerId === playerId);
  if (!player) return null;
  // Ambient signs plus every reaction sign the party has revealed by probing,
  // filtered to what this player perceives (P24, P28): the reconnecting player
  // recovers exactly what they are entitled to read, nothing more.
  return {
    fieldData:         room.fieldData,
    archiveEntries:    archive.getEntries(room.code),
    signs:             filterSigns(
      [
        ...deriveAmbientSigns(room.contract.traitRoll, room.contract.tier),
        ...room.revealedSigns,
      ],
      player.perceivedChannels,
    ),
    perceivedChannels: player.perceivedChannels,
  };
}
