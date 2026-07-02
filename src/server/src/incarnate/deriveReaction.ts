import type { Sign, Stimulus, Tier } from '@testament/shared';
import type { TraitRoll } from './types.js';
import { ACTIVE_AXES } from './types.js';
import { SIGN_LEXICON } from './lexicon.js';

// A non-matching probe returns the same sign as a ward-less Incarnate: a null
// result is deliberately ambiguous evidence (R55, R56).
export const NO_REACTION_SIGN: Sign = { channel: 'REACTION', token: 'no-reaction' };

export const PROBE_EXPOSURE_COST = 1;

export function deriveReaction(traits: TraitRoll, tier: Tier, stimulus: Stimulus): Sign {
  if (!ACTIVE_AXES[tier].includes('WARD')) return NO_REACTION_SIGN;
  if (traits.ward !== stimulus) return NO_REACTION_SIGN;

  const entry = SIGN_LEXICON.find(e => e.axis === 'WARD' && e.value === stimulus);
  if (!entry) {
    throw new Error(`Sign lexicon missing entry: axis=WARD value=${stimulus}`);
  }
  return { channel: entry.channel, token: entry.token };
}
