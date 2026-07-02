import type { Tier } from '@testament/shared';
import type { Rng } from '../rng/seeded.js';
import type {
  TraitRoll,
  AspectValue,
  FrailtyValue,
  WardValue,
  DispositionValue,
  RiteKeyValue,
  TellValue,
} from './types.js';

const ASPECT_VALUES:      readonly AspectValue[]      = ['EMBER', 'FROST', 'ROT', 'MIRE'];
const FRAILTY_VALUES:     readonly FrailtyValue[]     = ['FLAME', 'COLD', 'SALT', 'LIGHT'];
const TELL_VALUES:        readonly TellValue[]        = ['LUNGE', 'SWEEP', 'RECOIL', 'SHUDDER'];
const WARD_VALUES:        readonly WardValue[]        = ['FLAME', 'COLD', 'SALT', 'LIGHT'];
const DISPOSITION_VALUES: readonly DispositionValue[] = ['STALKER', 'AMBUSHER', 'TERRITORIAL', 'FRENZIED'];
const RITE_KEY_VALUES:    readonly RiteKeyValue[]     = ['PENANCE', 'IMMOLATION', 'INTERMENT', 'SILENCE'];

export function generateTraitRoll(rng: Rng, tier: Tier): TraitRoll {
  const roll: TraitRoll = {
    aspect:  rng.pick(ASPECT_VALUES),
    frailty: rng.pick(FRAILTY_VALUES),
    tell:    rng.pick(TELL_VALUES),
  };
  if (tier === 'JOURNEYMAN' || tier === 'MASTER') {
    roll.ward        = rng.pick(WARD_VALUES);
    roll.disposition = rng.pick(DISPOSITION_VALUES);
  }
  if (tier === 'MASTER') {
    roll.riteKey = rng.pick(RITE_KEY_VALUES);
  }
  return roll;
}
