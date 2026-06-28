import type { RelicBoard, Relic, RelicId, SynergyMap } from '@testament/shared';
import { hexCoordKey, hexNeighbors } from '@testament/shared';

export function evaluateSynergies(
  board: RelicBoard,
  registry: Map<RelicId, Relic>
): SynergyMap {
  const result: SynergyMap = {};

  // Solo runs: every board cell is owned by the lone player, so the cross-player
  // synergy rule would make synergy impossible and the core mechanic dead. Detect a
  // single-owner board (party size == 1, since startRun assigns every cell an owner)
  // and relax the owner check for it. Co-op boards (>=2 owners) are unaffected.
  // Pure: derived from board state only (P1). See specs/solo-play/design.md.
  const owners = new Set<string>();
  for (const slot of Object.values(board.slots)) owners.add(slot.ownerId);
  const soloBoard = owners.size <= 1;

  for (const slot of Object.values(board.slots)) {
    if (slot.relicId === null) continue;

    const relic = registry.get(slot.relicId);
    if (relic === undefined) continue;

    let synergyFires = false;

    for (const neighborCoord of hexNeighbors(slot.coord)) {
      const neighborSlot = board.slots[hexCoordKey(neighborCoord)];

      if (neighborSlot === undefined) continue;
      if (neighborSlot.relicId === null) continue;
      if (!soloBoard && neighborSlot.ownerId === slot.ownerId) continue;

      const neighborRelic = registry.get(neighborSlot.relicId);
      if (neighborRelic === undefined) continue;

      if (relic.tags.some(tag => neighborRelic.tags.includes(tag))) {
        synergyFires = true;
        break;
      }
    }

    result[relic.id] = synergyFires;
  }

  return result;
}
