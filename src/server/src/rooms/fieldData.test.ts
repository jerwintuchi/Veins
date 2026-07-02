import { describe, it, expect } from 'vitest';
import { buildStubFieldData } from './fieldData.js';
import type { ContractIntel } from '@testament/shared';

const CONTRACT: ContractIntel = {
  contractId:  'c-001',
  targetName:  'The Ashen Warden',
  siteName:    'The Collapsed Chancel',
  primaryVerb: 'INVESTIGATE',
  tier:        'APPRENTICE',
};

// T29: buildStubFieldData

describe('buildStubFieldData', () => {
  it('siteName matches contract.siteName', () => {
    const result = buildStubFieldData(CONTRACT);
    expect(result.siteName).toBe(CONTRACT.siteName);
  });

  it('incarnateName matches contract.targetName', () => {
    const result = buildStubFieldData(CONTRACT);
    expect(result.incarnateName).toBe(CONTRACT.targetName);
  });

  it('fieldId is FIELD-001', () => {
    expect(buildStubFieldData(CONTRACT).fieldId).toBe('FIELD-001');
  });

  it('result has exactly fieldId, siteName, incarnateName and no traitRoll', () => {
    const result = buildStubFieldData(CONTRACT);
    const keys = Object.keys(result).sort();
    expect(keys).toEqual(['fieldId', 'incarnateName', 'siteName'].sort());
    expect(keys).not.toContain('traitRoll');
  });
});
