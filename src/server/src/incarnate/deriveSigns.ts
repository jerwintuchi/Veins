import type { Sign, Tier } from '@testament/shared';
import type { TraitAxis, TraitRoll } from './types.js';
import { ACTIVE_AXES, AMBIENT_AXES } from './types.js';
import { SIGN_LEXICON } from './lexicon.js';

const AXIS_TO_FIELD: Record<TraitAxis, keyof TraitRoll> = {
  ASPECT:      'aspect',
  FRAILTY:     'frailty',
  TELL:        'tell',
  WARD:        'ward',
  DISPOSITION: 'disposition',
  RITE_KEY:    'riteKey',
};

function signsForAxes(traits: TraitRoll, axes: ReadonlyArray<TraitAxis>): Sign[] {
  const signs: Sign[] = [];
  for (const axis of axes) {
    const field = AXIS_TO_FIELD[axis];
    const value = traits[field] as string | undefined;
    const entry = SIGN_LEXICON.find(e => e.axis === axis && e.value === value);
    if (!entry) {
      throw new Error(`Sign lexicon missing entry: axis=${axis} value=${String(value)}`);
    }
    signs.push({ channel: entry.channel, token: entry.token });
  }
  return signs;
}

// All signs for the tier's active axes, WARD included. Lexicon-completeness reference.
export function deriveSigns(traits: TraitRoll, tier: Tier): Sign[] {
  return signsForAxes(traits, ACTIVE_AXES[tier]);
}

// Signs delivered ambiently at field start. Excludes WARD: the REACTION channel
// is only revealed by a probe (R58, P22).
export function deriveAmbientSigns(traits: TraitRoll, tier: Tier): Sign[] {
  return signsForAxes(traits, AMBIENT_AXES[tier]);
}
