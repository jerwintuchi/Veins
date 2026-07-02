import { describe, it, expect } from 'vitest';
import { buildStubTestament } from './testament.js';
import type { RoomRecord, ServerPlayerEntry } from './types.js';
import type { ContractRecord } from '../incarnate/contractRecord.js';

const CONTRACT: ContractRecord = {
  contractId:     'c-001',
  targetName:     'The Ashen Warden',
  siteName:       'The Collapsed Chancel',
  primaryVerb:    'INVESTIGATE',
  tier:           'APPRENTICE',
  expeditionSeed: 'test-seed-uuid',
  traitRoll:      { aspect: 'EMBER', frailty: 'FLAME', tell: 'LUNGE' },
};

function makeRoom(contract: ContractRecord | null = CONTRACT): RoomRecord {
  const player: ServerPlayerEntry = {
    playerId: 'p1', displayName: 'Aldric', socketId: 's1',
    isLeader: true, readyState: true, disconnectedAt: null,
  };
  return { code: 'ABC123', phase: 'FIELD', players: [player], contract, fieldData: null, exposure: 0, revealedSigns: [] };
}

// T30: buildStubTestament

describe('buildStubTestament', () => {
  it('contractId matches room.contract.contractId', () => {
    const t = buildStubTestament(makeRoom());
    expect(t.contractId).toBe('c-001');
  });

  it('outcome is success', () => {
    expect(buildStubTestament(makeRoom()).outcome).toBe('success');
  });

  it('entries has length 1', () => {
    expect(buildStubTestament(makeRoom()).entries).toHaveLength(1);
  });

  it('entries[0].targetName matches contract.targetName', () => {
    const t = buildStubTestament(makeRoom());
    expect(t.entries[0]?.targetName).toBe(CONTRACT.targetName);
  });

  it('expeditionId is a non-empty UUID string', () => {
    const t = buildStubTestament(makeRoom());
    expect(typeof t.expeditionId).toBe('string');
    expect(t.expeditionId.length).toBeGreaterThan(0);
    expect(t.expeditionId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('neither testament nor any entry has a traitRoll key', () => {
    const t = buildStubTestament(makeRoom());
    expect(Object.keys(t)).not.toContain('traitRoll');
    expect(Object.keys(t.entries[0]!)).not.toContain('traitRoll');
  });

  it('throws when room.contract is null', () => {
    expect(() => buildStubTestament(makeRoom(null))).toThrow();
  });
});
