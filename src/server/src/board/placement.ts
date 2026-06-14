import type { RelicBoard, Relic, RelicId, PlayerId } from '@veins/shared';
import type {
  PlaceRelicRequest,
  GamePhase,
  RelicPlacedEvent,
  RelicPlaceErrorEvent,
} from '@veins/shared';
import { hexCoordKey } from '@veins/shared';
import { evaluateSynergies } from './synergy.js';

export type PlaceRelicSuccess = {
  ok: true;
  board: RelicBoard;
  event: RelicPlacedEvent;
};

export type PlaceRelicFailure = {
  ok: false;
  error: RelicPlaceErrorEvent;
};

export type PlaceRelicResult = PlaceRelicSuccess | PlaceRelicFailure;

// `playerId` is the authenticated, server-side identity of the requester (from
// the socket session), never a client-supplied field. A player may only place
// into a slot they own, and the emitted event reports the slot's true owner.
export function placeRelic(
  board: RelicBoard,
  request: PlaceRelicRequest,
  playerId: PlayerId,
  phase: GamePhase,
  registry: Map<RelicId, Relic>
): PlaceRelicResult {
  if (phase !== 'loot') {
    return {
      ok: false,
      error: { code: 'WRONG_PHASE', message: 'Relics can only be placed during the loot phase.' },
    };
  }

  const key = hexCoordKey(request.coord);
  const slot = board.slots[key];

  if (slot === undefined) {
    return {
      ok: false,
      error: { code: 'INVALID_COORD', message: 'That coordinate is not on the board.' },
    };
  }

  if (slot.ownerId !== playerId) {
    return {
      ok: false,
      error: { code: 'NOT_OWNER', message: 'You can only place relics in your own slots.' },
    };
  }

  if (slot.relicId !== null) {
    return {
      ok: false,
      error: { code: 'SLOT_OCCUPIED', message: 'That slot is already occupied.' },
    };
  }

  const newBoard: RelicBoard = {
    slots: {
      ...board.slots,
      [key]: { ...slot, relicId: request.relicId },
    },
  };

  return {
    ok: true,
    board: newBoard,
    event: {
      coord: request.coord,
      relicId: request.relicId,
      ownerId: slot.ownerId, // server truth, not a client claim
      synergyMap: evaluateSynergies(newBoard, registry),
    },
  };
}
