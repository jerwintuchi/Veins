import { describe, it, expect } from 'vitest';
import type {
  LobbyErrorCode,
  RoomDeployingPayload,
  RoomCreatedPayload,
  LobbyUpdatedPayload,
  StateResyncPayload,
} from './lobbyMessages.js';
import type { ContractIntel } from './contract.js';
import type { FieldSnapshot } from './fieldPhase.js';

// T2: wire-protocol message payload types

describe('LobbyErrorCode', () => {
  it('contains exactly the ten expected error codes', () => {
    // Exhaustive switch — TypeScript compiler enforces this at compile time.
    const check = (code: LobbyErrorCode): number => {
      switch (code) {
        case 'ROOM_NOT_FOUND':    return 1;
        case 'ROOM_FULL':         return 2;
        case 'ALREADY_DEPLOYING': return 3;
        case 'NOT_LEADER':        return 4;
        case 'PARTY_NOT_READY':   return 5;
        case 'INVALID_PAYLOAD':   return 6;
        case 'NOT_IN_ROOM':       return 7;
        case 'TOKEN_EXPIRED':     return 8;
        case 'TOKEN_NOT_FOUND':   return 9;
        case 'WRONG_PHASE':       return 10;
      }
    };
    // Verify all ten codes resolve to distinct values.
    const codes: LobbyErrorCode[] = [
      'ROOM_NOT_FOUND', 'ROOM_FULL', 'ALREADY_DEPLOYING', 'NOT_LEADER',
      'PARTY_NOT_READY', 'INVALID_PAYLOAD', 'NOT_IN_ROOM', 'TOKEN_EXPIRED',
      'TOKEN_NOT_FOUND', 'WRONG_PHASE',
    ];
    const values = codes.map(check);
    expect(new Set(values).size).toBe(10);
  });
});

describe('RoomDeployingPayload', () => {
  it('has a contract field typed as ContractIntel with no server-only keys (R48)', () => {
    const contract: ContractIntel = {
      contractId: 'c-001',
      targetName: 'The Ashen Warden',
      siteName: 'The Collapsed Chancel',
      primaryVerb: 'INVESTIGATE',
      tier: 'APPRENTICE',
    };
    const payload: RoomDeployingPayload = { contract };
    expect(payload.contract.contractId).toBe('c-001');
    expect(payload.contract.tier).toBe('APPRENTICE');
    expect(Object.keys(payload.contract)).not.toContain('traitRoll');
    expect(Object.keys(payload.contract)).not.toContain('expeditionSeed');
    expect(Object.keys(payload.contract).sort()).toEqual(
      ['contractId', 'primaryVerb', 'siteName', 'targetName', 'tier'].sort()
    );
  });
});

describe('RoomCreatedPayload shape', () => {
  it('has snapshot and reconnectToken fields', () => {
    const payload: RoomCreatedPayload = {
      snapshot: {
        roomCode: 'ABC123',
        phase: 'WAITING',
        players: [{ playerId: 'p1', displayName: 'Aldric', isLeader: true, readyState: false }],
        contract: null,
      },
      reconnectToken: 'some-uuid',
    };
    expect(typeof payload.reconnectToken).toBe('string');
    expect(payload.snapshot.phase).toBe('WAITING');
  });
});

describe('StateResyncPayload shape', () => {
  it('is assignable with fieldSnapshot: null', () => {
    const payload: StateResyncPayload = {
      snapshot: {
        roomCode: 'ABC123',
        phase: 'WAITING',
        players: [],
        contract: null,
      },
      fieldSnapshot: null,
      reconnectToken: 'tok',
    };
    expect(payload.fieldSnapshot).toBeNull();
  });

  it('is assignable with a valid FieldSnapshot', () => {
    const fs: FieldSnapshot = {
      fieldData: { fieldId: 'FIELD-001', siteName: 'Site', incarnateName: 'Target' },
      archiveEntries: [],
      signs: [],
      perceivedChannels: [],
    };
    const payload: StateResyncPayload = {
      snapshot: {
        roomCode: 'ABC123',
        phase: 'FIELD',
        players: [],
        contract: null,
      },
      fieldSnapshot: fs,
      reconnectToken: 'tok',
    };
    expect(payload.fieldSnapshot?.fieldData.fieldId).toBe('FIELD-001');
  });
});
