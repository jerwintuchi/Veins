import { describe, it, expect } from 'vitest';
import type { StubFieldData, StubArchiveEntry, StubTestament, FieldSnapshot } from './fieldPhase.js';

// T24: field-phase shared types

describe('StubFieldData', () => {
  it('has no traitRoll key (structural + runtime check)', () => {
    const data: StubFieldData = {
      fieldId: 'FIELD-001',
      siteName: 'The Collapsed Chancel',
      incarnateName: 'The Ashen Warden',
    };
    // @ts-expect-error — traitRoll must not exist on StubFieldData
    const _bad: StubFieldData = { ...data, traitRoll: 'something' };
    expect(Object.keys(data)).not.toContain('traitRoll');
  });
});

describe('StubTestament', () => {
  it('has no traitRoll key (structural + runtime check)', () => {
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
    // @ts-expect-error — traitRoll must not exist on StubTestament
    const _bad: StubTestament = { ...testament, traitRoll: 'something' };
    expect(Object.keys(testament)).not.toContain('traitRoll');
    expect(Object.keys(entry)).not.toContain('traitRoll');
  });
});

describe('StubArchiveEntry.outcome', () => {
  it('only accepts the literal success', () => {
    const entry: StubArchiveEntry = {
      contractId: 'STUB-001',
      targetName: 'The Ashen Warden',
      siteName: 'The Collapsed Chancel',
      outcome: 'success',
      notes: 'No observations recorded.',
    };
    expect(entry.outcome).toBe('success');
    // @ts-expect-error — 'failure' is not assignable to 'success'
    const _bad: StubArchiveEntry = { ...entry, outcome: 'failure' };
  });
});

describe('FieldSnapshot shape', () => {
  it('has fieldData, archiveEntries, and signs (R51/R52)', () => {
    const snap: FieldSnapshot = {
      fieldData:      { fieldId: 'FIELD-001', siteName: 'Site', incarnateName: 'Target' },
      archiveEntries: [],
      signs:          [{ channel: 'OMEN', token: 'full-body-tremor' }],
    };
    expect(snap.fieldData.fieldId).toBe('FIELD-001');
    expect(snap.archiveEntries).toHaveLength(0);
    expect(snap.signs[0]?.channel).toBe('OMEN');
    expect(Object.keys(snap.signs[0]!).sort()).toEqual(['channel', 'token']);
  });
});
