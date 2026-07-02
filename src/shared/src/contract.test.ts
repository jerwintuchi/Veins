// T45: ContractIntel and PrimaryVerb shared types
import { describe, it, expect } from 'vitest';
import type { ContractIntel, PrimaryVerb } from './contract.js';
import type { Tier } from './signs.js';

// T45(a): PrimaryVerb is a union of exactly 4 literals.
function assertPrimaryVerbExhaustive(v: PrimaryVerb): string {
  switch (v) {
    case 'INVESTIGATE': return v;
    case 'ELIMINATE':   return v;
    case 'CAPTURE':     return v;
    case 'BANISH':      return v;
  }
}

// @ts-expect-error — 'OBSERVE' is not a valid PrimaryVerb
const _badVerb: PrimaryVerb = 'OBSERVE';

// T45(b): ContractIntel satisfies its shape.
const _intel = {
  contractId:  'abc-123',
  tier:        'APPRENTICE' as Tier,
  targetName:  'The Ashen Warden',
  siteName:    'The Collapsed Chancel',
  primaryVerb: 'INVESTIGATE' as PrimaryVerb,
} satisfies ContractIntel;

// T45(c): ContractIntel has no expeditionSeed or traitRoll field.
// @ts-expect-error — expeditionSeed is not a field of ContractIntel
const _badIntel: ContractIntel = { ..._intel, expeditionSeed: 'abc' };

describe('PrimaryVerb', () => {
  it('covers exactly 4 values', () => {
    const verbs: PrimaryVerb[] = ['INVESTIGATE', 'ELIMINATE', 'CAPTURE', 'BANISH'];
    expect(verbs).toHaveLength(4);
    verbs.forEach(v => expect(assertPrimaryVerbExhaustive(v)).toBe(v));
  });
});

describe('ContractIntel', () => {
  it('has exactly 5 fields', () => {
    const intel: ContractIntel = {
      contractId:  'test-id',
      tier:        'JOURNEYMAN',
      targetName:  'The Weeping Mire',
      siteName:    'The Salt Marsh',
      primaryVerb: 'BANISH',
    };
    expect(Object.keys(intel).sort()).toEqual(
      ['contractId', 'primaryVerb', 'siteName', 'targetName', 'tier']
    );
  });

  it('does not allow expeditionSeed (structural type check — see compile-time assertion above)', () => {
    // Runtime enforcement: no seed field on a plain ContractIntel object.
    const intel: ContractIntel = {
      contractId: 'x', tier: 'MASTER', targetName: 'Y', siteName: 'Z', primaryVerb: 'CAPTURE',
    };
    expect(Object.keys(intel)).not.toContain('expeditionSeed');
    expect(Object.keys(intel)).not.toContain('traitRoll');
  });
});
