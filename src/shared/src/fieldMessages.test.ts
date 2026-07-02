import { describe, it, expect } from 'vitest';
import type {
  DeployPayload,
  ExtractPayload,
  FieldStartedPayload,
  FieldTestamentPayload,
  ArchiveUpdatedPayload,
  ProbePayload,
  ProbeResultPayload,
} from './fieldMessages.js';
import type { StubTestament, StubArchiveEntry } from './fieldPhase.js';

// T25: field-phase wire-payload types

describe('FieldStartedPayload', () => {
  it('has fieldData, reconnectToken, signs, and perceivedChannels (R49/R52/R59)', () => {
    const payload: FieldStartedPayload = {
      fieldData:         { fieldId: 'FIELD-001', siteName: 'Site', incarnateName: 'Target' },
      reconnectToken:    'some-uuid',
      signs:             [{ channel: 'RESIDUE', token: 'scorched-wax' }],
      perceivedChannels: ['RESIDUE', 'OMEN'],
    };
    expect(typeof payload.reconnectToken).toBe('string');
    expect(payload.fieldData.fieldId).toBe('FIELD-001');
    expect(payload.signs).toHaveLength(1);
    expect(payload.signs[0]?.channel).toBe('RESIDUE');
    // signs elements must not carry trait data
    expect(Object.keys(payload.signs[0]!).sort()).toEqual(['channel', 'token']);
    expect(payload.perceivedChannels).toContain('RESIDUE');
  });
});

describe('FieldTestamentPayload', () => {
  it('has testament typed as StubTestament with no traitRoll anywhere', () => {
    const entry: StubArchiveEntry = {
      contractId: 'STUB-001',
      targetName: 'The Ashen Warden',
      siteName: 'The Collapsed Chancel',
      outcome: 'success',
      notes: 'No observations recorded.',
    };
    const testament: StubTestament = {
      expeditionId: 'uuid-1',
      contractId: 'STUB-001',
      outcome: 'success',
      entries: [entry],
    };
    const payload: FieldTestamentPayload = { testament };
    const serialized = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
    expect(JSON.stringify(serialized)).not.toContain('traitRoll');
    expect(payload.testament.contractId).toBe('STUB-001');
  });
});

describe('DeployPayload and ExtractPayload', () => {
  it('are assignable from an empty object', () => {
    const deploy: DeployPayload = {};
    const extract: ExtractPayload = {};
    expect(deploy).toEqual({});
    expect(extract).toEqual({});
  });
});

describe('ArchiveUpdatedPayload', () => {
  it('has an entries array', () => {
    const payload: ArchiveUpdatedPayload = { entries: [] };
    expect(Array.isArray(payload.entries)).toBe(true);
  });
});

// T54: probe wire payloads (R53)

describe('ProbePayload', () => {
  it('carries exactly a stimulus', () => {
    const payload: ProbePayload = { stimulus: 'FLAME' };
    expect(payload.stimulus).toBe('FLAME');
    // @ts-expect-error — arbitrary strings are not stimuli
    const _bad: ProbePayload = { stimulus: 'WATER' };
  });
});

describe('ProbeResultPayload', () => {
  it('carries playerId, stimulus, sign, and exposure — never trait data (R56)', () => {
    const payload: ProbeResultPayload = {
      playerId: 'player-1',
      stimulus: 'COLD',
      sign:     { channel: 'REACTION', token: 'no-reaction' },
      exposure: 1,
    };
    expect(Object.keys(payload).sort()).toEqual(['exposure', 'playerId', 'sign', 'stimulus']);
    expect(Object.keys(payload.sign!).sort()).toEqual(['channel', 'token']);
    const json = JSON.stringify(payload);
    expect(json).not.toContain('traitRoll');
    expect(json).not.toContain('ward');
    expect(json).not.toContain('expeditionSeed');
  });

  it('accepts sign: null for a player who cannot read the REACTION channel (R59)', () => {
    const payload: ProbeResultPayload = {
      playerId: 'player-1',
      stimulus: 'COLD',
      sign:     null,
      exposure: 1,
    };
    expect(payload.sign).toBeNull();
    expect(payload.exposure).toBe(1);
  });
});
