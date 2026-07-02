import { randomUUID } from 'node:crypto';
import type { StubTestament, StubArchiveEntry } from '@testament/shared';
import type { RoomRecord } from './types.js';

export function buildStubTestament(room: RoomRecord): StubTestament {
  if (!room.contract) throw new Error('buildStubTestament: room.contract is null');

  const entry: StubArchiveEntry = {
    contractId: room.contract.contractId,
    targetName: room.contract.targetName,
    siteName: room.contract.siteName,
    outcome: 'success',
    notes: 'No observations recorded.',
  };

  return {
    expeditionId: randomUUID(),
    contractId: room.contract.contractId,
    outcome: 'success',
    entries: [entry],
  };
}
