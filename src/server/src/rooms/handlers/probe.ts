import type { Stimulus, ProbeResultPayload } from '@testament/shared';
import { STIMULI } from '@testament/shared';
import type { RoomManager } from '../RoomManager.js';
import type { EmitFn, BroadcastFn } from '../types.js';
import { assertPhase } from '../phaseGuard.js';
import { deriveReaction, PROBE_EXPOSURE_COST } from '../../incarnate/deriveReaction.js';

export function handleProbe(
  socketId: string,
  payload: unknown,
  roomManager: RoomManager,
  emit: EmitFn,
  broadcast: BroadcastFn,
): void {
  const p = payload as Record<string, unknown> | null;
  const stimulus = p !== null && typeof p === 'object' ? p['stimulus'] : undefined;
  if (typeof stimulus !== 'string' || !(STIMULI as ReadonlyArray<string>).includes(stimulus)) {
    emit('LOBBY_ERROR', { code: 'INVALID_PAYLOAD', message: 'Payload must include a valid stimulus.' });
    return;
  }

  const room = roomManager.getRoomBySocketId(socketId);
  if (!assertPhase(room, 'FIELD', emit)) return;

  // Any player may probe — probing is party behavior, not a leader action.
  const sender = room.players.find(pl => pl.socketId === socketId)!;

  // room.contract is guaranteed non-null in FIELD phase (set by acceptContract).
  const contract = room.contract!;
  const sign = deriveReaction(contract.traitRoll, contract.tier, stimulus as Stimulus);

  room.exposure += PROBE_EXPOSURE_COST;
  if (!room.revealedSigns.some(s => s.token === sign.token)) {
    room.revealedSigns.push(sign);
  }

  const result: ProbeResultPayload = {
    playerId: sender.playerId,
    stimulus: stimulus as Stimulus,
    sign,
    exposure: room.exposure,
  };
  broadcast(room.code, 'PROBE_RESULT', result);
}
