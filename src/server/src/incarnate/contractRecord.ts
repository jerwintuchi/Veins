import type { ContractIntel } from '@testament/shared';
import type { TraitRoll } from './types.js';

export type ContractRecord = ContractIntel & {
  expeditionSeed: string;
  traitRoll:      TraitRoll;
};
