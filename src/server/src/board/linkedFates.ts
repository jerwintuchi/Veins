import type { RelicBoard, Relic, RelicId } from '@testament/shared';
import type {
  LinkedFatesRequest,
  LinkedFatesErrorEvent,
  RelicRemovedEvent,
  RelicPlacedEvent,
} from '@testament/shared';
import { hexCoordKey } from '@testament/shared';
import { evaluateSynergies } from './synergy.js';

// Ordered tuple: RELIC_REMOVED must be emitted before RELIC_PLACED (R6).
// Encoding the order in the type makes it impossible to emit out of sequence.
export type LinkedFatesEvents = [
  { type: 'RELIC_REMOVED'; payload: RelicRemovedEvent },
  { type: 'RELIC_PLACED'; payload: RelicPlacedEvent },
];

export type LinkedFatesSuccess = {
  ok: true;
  board: RelicBoard;
  events: LinkedFatesEvents;
};

export type LinkedFatesFailure = {
  ok: false;
  error: LinkedFatesErrorEvent;
};

export type LinkedFatesResult = LinkedFatesSuccess | LinkedFatesFailure;

export function reviveWithLinkedFates(
  board: RelicBoard,
  request: LinkedFatesRequest,
  registry: Map<RelicId, Relic>
): LinkedFatesResult {
  const sourceKey = hexCoordKey(request.sourceCoord);
  const targetKey = hexCoordKey(request.targetCoord);

  const sourceSlot = board.slots[sourceKey];
  const targetSlot = board.slots[targetKey];

  if (sourceSlot === undefined || targetSlot === undefined) {
    return {
      ok: false,
      error: { code: 'INVALID_COORD', message: 'Source or target coordinate is not on the board.' },
    };
  }

  // Never trust the client: the reviver may only sacrifice a relic from their own slot.
  if (sourceSlot.ownerId !== request.reviverId) {
    return {
      ok: false,
      error: { code: 'NOT_OWNER', message: 'You can only sacrifice a relic from your own slot.' },
    };
  }

  // R6: a player with no relic in the chosen slot has nothing to sacrifice.
  if (sourceSlot.relicId === null) {
    return {
      ok: false,
      error: { code: 'NO_RELIC', message: 'There is no relic to sacrifice in that slot.' },
    };
  }

  if (targetSlot.relicId !== null) {
    return {
      ok: false,
      error: { code: 'SLOT_OCCUPIED', message: 'The target slot is already occupied.' },
    };
  }

  const sacrificedRelicId = sourceSlot.relicId;

  const newBoard: RelicBoard = {
    slots: {
      ...board.slots,
      [sourceKey]: { ...sourceSlot, relicId: null },
      [targetKey]: { ...targetSlot, relicId: sacrificedRelicId },
    },
  };

  return {
    ok: true,
    board: newBoard,
    events: [
      {
        type: 'RELIC_REMOVED',
        payload: {
          coord: request.sourceCoord,
          relicId: sacrificedRelicId,
          reason: 'linked-fates',
        },
      },
      {
        type: 'RELIC_PLACED',
        payload: {
          coord: request.targetCoord,
          relicId: sacrificedRelicId,
          ownerId: targetSlot.ownerId, // the relic now belongs to the downed teammate's slot
          synergyMap: evaluateSynergies(newBoard, registry),
        },
      },
    ],
  };
}
