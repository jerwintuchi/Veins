import type { HexCoord, PlayerId, RelicBoard, RelicSlot } from '@veins/shared';
import { hexCoordKey } from '@veins/shared';

// All axial coords within hex-distance `radius` of the origin.
// radius 2 -> 19 cells (1 + 6 + 12).
export function buildHexCoords(radius: number): HexCoord[] {
  const coords: HexCoord[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      // axial hex distance from origin
      const distance = (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
      if (distance <= radius) coords.push({ q, r });
    }
  }
  return coords;
}

// Angle of a hex around the origin, used to slice the board into pie-shaped
// home regions. Axial -> cartesian, then atan2.
function angleOf(coord: HexCoord): number {
  const x = coord.q + coord.r / 2;
  const y = coord.r * (Math.sqrt(3) / 2);
  return Math.atan2(y, x);
}

// Assigns each coord an owner. Outer cells are sorted by angle and split into N
// contiguous arcs (home regions); the center cell goes to the first player.
// Contiguous arcs border one another, so different-owner adjacency always
// exists -> synergy is possible (R5). Deterministic for a fixed players list.
export function assignHomeQuadrants(
  coords: HexCoord[],
  players: PlayerId[]
): Map<string, PlayerId> {
  if (players.length === 0) throw new Error('assignHomeQuadrants requires at least one player');

  const owners = new Map<string, PlayerId>();
  const n = players.length;

  const center = coords.find(c => c.q === 0 && c.r === 0);
  const outer = coords.filter(c => !(c.q === 0 && c.r === 0));

  // Stable sort: by angle, breaking ties by coord key so the result is fully
  // deterministic regardless of input order.
  outer.sort((a, b) => {
    const da = angleOf(a);
    const db = angleOf(b);
    if (da !== db) return da - db;
    return hexCoordKey(a).localeCompare(hexCoordKey(b));
  });

  outer.forEach((coord, i) => {
    const playerIndex = Math.floor((i * n) / outer.length);
    owners.set(hexCoordKey(coord), players[playerIndex] as PlayerId);
  });

  if (center) owners.set(hexCoordKey(center), players[0] as PlayerId);

  return owners;
}

// Builds the initial empty board: every cell owned, no relics placed.
export function buildInitialBoard(players: PlayerId[], radius: number): RelicBoard {
  const coords = buildHexCoords(radius);
  const owners = assignHomeQuadrants(coords, players);

  const slots: Record<string, RelicSlot> = {};
  for (const coord of coords) {
    const key = hexCoordKey(coord);
    slots[key] = {
      coord,
      ownerId: owners.get(key) as PlayerId,
      relicId: null,
    };
  }
  return { slots };
}
