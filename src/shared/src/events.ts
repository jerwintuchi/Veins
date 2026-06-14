import type { HexCoord, RelicId, PlayerId, SynergyMap, RelicBoard, Relic } from './board.js';

export type GamePhase = 'loot' | 'combat' | 'transition';

// Client -> Server. Note: no ownerId — the placing player's identity comes from
// the authenticated socket server-side, never a client-supplied field (I2).
export type PlaceRelicRequest = {
  coord: HexCoord;
  relicId: RelicId;
};

// Server -> Room (broadcast)
export type RelicPlacedEvent = {
  coord: HexCoord;
  relicId: RelicId;
  ownerId: PlayerId;
  synergyMap: SynergyMap;
};

// Server -> Socket (targeted error)
export type RelicPlaceErrorEvent = {
  code: 'SLOT_OCCUPIED' | 'WRONG_PHASE' | 'INVALID_COORD' | 'NOT_OWNER';
  message: string;
};

// Server -> Socket (on room join)
export type BoardStateSyncEvent = {
  board: RelicBoard;
  synergyMap: SynergyMap;
  relicRegistry: Record<RelicId, Relic>;
};

// Server -> Room (broadcast, before a Linked Fates transfer)
export type RelicRemovedEvent = {
  coord: HexCoord;
  relicId: RelicId;
  reason: 'linked-fates' | 'run-end';
};

// Client -> Server: reviver sacrifices a relic to revive a downed teammate
export type LinkedFatesRequest = {
  reviverId: PlayerId;
  sourceCoord: HexCoord; // reviver's slot holding the relic to sacrifice
  targetCoord: HexCoord; // downed teammate's slot to receive it
};

// Server -> Socket (targeted error for a failed revive)
export type LinkedFatesErrorEvent = {
  code: 'INVALID_COORD' | 'NOT_OWNER' | 'NO_RELIC' | 'SLOT_OCCUPIED';
  message: string;
};
