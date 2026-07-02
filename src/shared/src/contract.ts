import type { Tier } from './signs.js';

export type PrimaryVerb = 'INVESTIGATE' | 'ELIMINATE' | 'CAPTURE' | 'BANISH';

export type ContractIntel = {
  contractId:  string;
  tier:        Tier;
  targetName:  string;
  siteName:    string;
  primaryVerb: PrimaryVerb;
};
