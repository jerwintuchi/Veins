import type { RelicBoard, RelicId, PlayerId } from '@testament/shared';
import { createRng, hashSeed, type Rng } from '../rng/seeded.js';

export const LOOT_POOL_SIZE = 3;

// Deterministic in-place Fisher-Yates shuffle.
function shuffle<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

// Pure, server-only (I1, I3). Same (registryIds, board, runId, floor, ownerId)
// always produces the same pool. Seed is namespaced so loot and spawn sequences
// are independent.
//
// `ownerId` makes the pool per-player: the seed is salted with the id (so each
// player gets a distinct set) and that player's already-placed relics are offered
// last (teammates may hold the same relic on their own section). Omitting it yields
// the legacy whole-board behaviour.
//
// The pool prefers relics the player has NOT yet placed (variety), but backfills
// with already-acquired relics so it is never empty once a player owns most relics.
// That keeps the tray populated late-run: the player can still place into an empty
// slot or replace a relic on a full board (placement allows occupied own-slots).
export function generateLootPool(
  registryIds: RelicId[],
  board: RelicBoard,
  runId: string,
  floor: number,
  ownerId?: PlayerId
): RelicId[] {
  const placed = new Set(
    Object.values(board.slots)
      .filter(s => ownerId === undefined || s.ownerId === ownerId)
      .map(s => s.relicId)
      .filter((id): id is string => id !== null)
  );

  const seedSuffix = ownerId === undefined ? '' : `#${ownerId}`;
  const rng = createRng(hashSeed(`${runId}#${floor}#loot${seedSuffix}`));

  const unplaced = shuffle(registryIds.filter(id => !placed.has(id)), rng);
  if (unplaced.length >= LOOT_POOL_SIZE) return unplaced.slice(0, LOOT_POOL_SIZE);

  // Backfill with already-acquired relics (shuffled) so the tray stays full.
  const acquired = shuffle(registryIds.filter(id => placed.has(id)), rng);
  return [...unplaced, ...acquired].slice(0, LOOT_POOL_SIZE);
}

// Per-player loot: each player gets their own independent pool so one player can
// never consume the choices of another. A flat Record keyed by PlayerId, sent to
// clients which read their own entry by localPlayerId.
export function generateLootPools(
  registryIds: RelicId[],
  board: RelicBoard,
  runId: string,
  floor: number,
  players: PlayerId[]
): Record<PlayerId, RelicId[]> {
  const pools: Record<PlayerId, RelicId[]> = {};
  for (const pid of players) {
    pools[pid] = generateLootPool(registryIds, board, runId, floor, pid);
  }
  return pools;
}
