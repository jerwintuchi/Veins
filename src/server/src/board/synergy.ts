import type { RelicBoard, Relic, RelicId, SynergyMap } from '@veins/shared';
import { hexCoordKey, hexNeighbors } from '@veins/shared';

export function evaluateSynergies(
  board: RelicBoard,
  registry: Map<RelicId, Relic>
): SynergyMap {
  const result: SynergyMap = {};

  for (const slot of Object.values(board.slots)) {
    if (slot.relicId === null) continue;

    const relic = registry.get(slot.relicId);
    if (relic === undefined) continue;

    let synergyFires = false;

    for (const neighborCoord of hexNeighbors(slot.coord)) {
      const neighborSlot = board.slots[hexCoordKey(neighborCoord)];

      if (neighborSlot === undefined) continue;
      if (neighborSlot.relicId === null) continue;
      if (neighborSlot.ownerId === slot.ownerId) continue;

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
