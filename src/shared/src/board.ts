// Types and pure coordinate utilities for the Circulatory Board.
// No game logic here — evaluateSynergies lives in src/server/.

export type HexCoord = { q: number; r: number };

export type RelicId = string;
export type PlayerId = string;

export type RelicTag = 'fire' | 'aoe' | 'party' | 'poison' | 'shield' | 'chain';

export type Effect = {
  description: string;
};

export type Relic = {
  id: RelicId;
  name: string;
  tags: RelicTag[];
  baseEffect: Effect;
  synergyEffect: Effect;
};

export type RelicSlot = {
  coord: HexCoord;
  ownerId: PlayerId;
  relicId: RelicId | null;
};

export type RelicBoard = {
  slots: Record<string, RelicSlot>;
};

export type SynergyMap = Record<RelicId, boolean>;

const HEX_NEIGHBOR_OFFSETS: ReadonlyArray<HexCoord> = [
  { q: 1, r: 0 },
  { q: -1, r: 0 },
  { q: 0, r: 1 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
  { q: -1, r: 1 },
];

export function hexCoordKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`;
}

export function hexNeighbors(coord: HexCoord): HexCoord[] {
  return HEX_NEIGHBOR_OFFSETS.map(({ q, r }) => ({
    q: coord.q + q,
    r: coord.r + r,
  }));
}
