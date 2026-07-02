import type { ContractIntel, PrimaryVerb, Tier } from '@testament/shared';
import type { Rng } from '../rng/seeded.js';
import type { ContractRecord } from './contractRecord.js';
import { generateTraitRoll } from './generateTraitRoll.js';

const TARGET_NAMES: readonly string[] = [
  'The Ashen Warden',
  'The Weeping Mire',
  'The Frost Penitent',
  'The Rot-Bloom',
];

const SITE_NAMES: readonly string[] = [
  'The Collapsed Chancel',
  'The Salt Marsh',
  'The Ember Reach',
  'The Sunken Nave',
];

const PRIMARY_VERBS: readonly PrimaryVerb[] = ['INVESTIGATE', 'ELIMINATE', 'CAPTURE', 'BANISH'];

export function generateContract(
  rng: Rng,
  tier: Tier,
  contractId: string,
  expeditionSeed: string,
): ContractRecord {
  return {
    contractId,
    tier,
    expeditionSeed,
    targetName:  rng.pick(TARGET_NAMES),
    siteName:    rng.pick(SITE_NAMES),
    primaryVerb: rng.pick(PRIMARY_VERBS),
    traitRoll:   generateTraitRoll(rng, tier),
  };
}

export function toContractIntel({ expeditionSeed: _, traitRoll: __, ...intel }: ContractRecord): ContractIntel {
  return intel;
}
