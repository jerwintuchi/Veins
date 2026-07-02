import type { LobbySnapshot, FieldSnapshot } from '@testament/shared';
import type { RoomRecord } from './types.js';
import type { SessionArchive } from './SessionArchive.js';
import { toPublicPlayer } from './types.js';
import { toContractIntel } from '../incarnate/generateContract.js';
import { deriveAmbientSigns } from '../incarnate/deriveSigns.js';

// Pure function. Strips server-only fields before sending to any client (I5, P2).
export function toSnapshot(room: RoomRecord): LobbySnapshot {
  return {
    roomCode: room.code,
    phase: room.phase,
    players: room.players.map(toPublicPlayer),
    contract: room.contract ? toContractIntel(room.contract) : null,
  };
}

// Returns null when the room is not in FIELD phase (A8).
export function buildFieldSnapshot(room: RoomRecord, archive: SessionArchive): FieldSnapshot | null {
  if (room.phase !== 'FIELD' || !room.fieldData || !room.contract) return null;
  // Ambient signs plus every reaction sign the party has revealed by probing,
  // so a reconnecting player recovers exactly what the room has learned (P24).
  return {
    fieldData:      room.fieldData,
    archiveEntries: archive.getEntries(room.code),
    signs:          [
      ...deriveAmbientSigns(room.contract.traitRoll, room.contract.tier),
      ...room.revealedSigns,
    ],
  };
}
