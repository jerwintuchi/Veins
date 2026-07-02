// T46: ContractRecord — server-only type
import { describe, it, expect } from 'vitest';
import type { ContractRecord } from './contractRecord.js';
import type { ContractIntel } from '@testament/shared';

// T46(a): ContractRecord is assignable from ContractIntel + server-only fields.
const _record = {
  contractId:     'c-001',
  tier:           'APPRENTICE',
  targetName:     'The Ashen Warden',
  siteName:       'The Collapsed Chancel',
  primaryVerb:    'INVESTIGATE',
  expeditionSeed: 'seed-uuid',
  traitRoll:      { aspect: 'EMBER', frailty: 'FLAME', tell: 'LUNGE' },
} satisfies ContractRecord;

describe('ContractRecord', () => {
  it('includes all ContractIntel fields plus expeditionSeed and traitRoll', () => {
    const record: ContractRecord = {
      contractId:     'test-id',
      tier:           'MASTER',
      targetName:     'The Frost Penitent',
      siteName:       'The Ember Reach',
      primaryVerb:    'BANISH',
      expeditionSeed: 'seed-abc',
      traitRoll: {
        aspect: 'FROST', frailty: 'COLD', tell: 'SWEEP',
        ward: 'SALT', disposition: 'STALKER', riteKey: 'PENANCE',
      },
    };
    const keys = Object.keys(record);
    expect(keys).toContain('expeditionSeed');
    expect(keys).toContain('traitRoll');
    expect(keys).toContain('contractId');
    expect(keys).toContain('tier');
    expect(keys).toContain('targetName');
  });

  it('is not exported from @testament/shared (structural check)', () => {
    // ContractRecord has expeditionSeed and traitRoll — ContractIntel does not.
    // This test ensures a ContractRecord cannot be assigned to ContractIntel without stripping.
    const record: ContractRecord = {
      contractId: 'c', tier: 'APPRENTICE', targetName: 't', siteName: 's',
      primaryVerb: 'CAPTURE', expeditionSeed: 'e',
      traitRoll: { aspect: 'ROT', frailty: 'SALT', tell: 'RECOIL' },
    };
    // Destructuring strips server-only fields to get ContractIntel.
    const { expeditionSeed: _, traitRoll: __, ...intel } = record;
    const typedIntel: ContractIntel = intel;
    expect(Object.keys(typedIntel)).not.toContain('expeditionSeed');
    expect(Object.keys(typedIntel)).not.toContain('traitRoll');
  });
});
