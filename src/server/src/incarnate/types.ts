import type { Tier } from '@testament/shared';

export type TraitAxis =
  | 'ASPECT' | 'FRAILTY' | 'WARD'
  | 'DISPOSITION' | 'RITE_KEY' | 'TELL';

export type AspectValue      = 'EMBER' | 'FROST' | 'ROT'  | 'MIRE';
export type FrailtyValue     = 'FLAME' | 'COLD'  | 'SALT' | 'LIGHT';
export type WardValue        = 'FLAME' | 'COLD'  | 'SALT' | 'LIGHT';
export type DispositionValue = 'STALKER' | 'AMBUSHER' | 'TERRITORIAL' | 'FRENZIED';
export type RiteKeyValue     = 'PENANCE' | 'IMMOLATION' | 'INTERMENT' | 'SILENCE';
export type TellValue        = 'LUNGE'   | 'SWEEP'      | 'RECOIL'    | 'SHUDDER';

export type TraitRoll = {
  aspect:       AspectValue;
  frailty:      FrailtyValue;
  tell:         TellValue;
  ward?:        WardValue;
  disposition?: DispositionValue;
  riteKey?:     RiteKeyValue;
};

export const ACTIVE_AXES: Record<Tier, ReadonlyArray<TraitAxis>> = {
  APPRENTICE: ['ASPECT', 'FRAILTY', 'TELL'],
  JOURNEYMAN: ['ASPECT', 'FRAILTY', 'TELL', 'WARD', 'DISPOSITION'],
  MASTER:     ['ASPECT', 'FRAILTY', 'TELL', 'WARD', 'DISPOSITION', 'RITE_KEY'],
};

// Axes whose signs ship ambiently in FIELD_STARTED / FieldSnapshot. WARD is
// excluded at every tier: the REACTION channel is probe-gated (R58, TD-025).
export const AMBIENT_AXES: Record<Tier, ReadonlyArray<TraitAxis>> = {
  APPRENTICE: ['ASPECT', 'FRAILTY', 'TELL'],
  JOURNEYMAN: ['ASPECT', 'FRAILTY', 'TELL', 'DISPOSITION'],
  MASTER:     ['ASPECT', 'FRAILTY', 'TELL', 'DISPOSITION', 'RITE_KEY'],
};
