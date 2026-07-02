import type { Channel, SignToken } from '@testament/shared';
import type { TraitAxis } from './types.js';

export type LexiconEntry = {
  axis:    TraitAxis;
  value:   string;
  channel: Channel;
  token:   SignToken;
};

export const SIGN_LEXICON: ReadonlyArray<LexiconEntry> = [
  // ASPECT → RESIDUE
  { axis: 'ASPECT', value: 'EMBER', channel: 'RESIDUE',     token: 'scorched-wax'       },
  { axis: 'ASPECT', value: 'FROST', channel: 'RESIDUE',     token: 'frost-rime'          },
  { axis: 'ASPECT', value: 'ROT',   channel: 'RESIDUE',     token: 'rot-bloom'           },
  { axis: 'ASPECT', value: 'MIRE',  channel: 'RESIDUE',     token: 'weeping-clay'        },
  // FRAILTY → STRESS_MARK
  { axis: 'FRAILTY', value: 'FLAME', channel: 'STRESS_MARK', token: 'flinch-from-flame'  },
  { axis: 'FRAILTY', value: 'COLD',  channel: 'STRESS_MARK', token: 'flinch-from-cold'   },
  { axis: 'FRAILTY', value: 'SALT',  channel: 'STRESS_MARK', token: 'flinch-from-salt'   },
  { axis: 'FRAILTY', value: 'LIGHT', channel: 'STRESS_MARK', token: 'flinch-from-light'  },
  // WARD → REACTION (probe-driven)
  { axis: 'WARD', value: 'FLAME', channel: 'REACTION', token: 'drinks-flame'             },
  { axis: 'WARD', value: 'COLD',  channel: 'REACTION', token: 'drinks-cold'              },
  { axis: 'WARD', value: 'SALT',  channel: 'REACTION', token: 'drinks-salt'              },
  { axis: 'WARD', value: 'LIGHT', channel: 'REACTION', token: 'drinks-light'             },
  // DISPOSITION → SPOOR
  { axis: 'DISPOSITION', value: 'STALKER',     channel: 'SPOOR', token: 'trailing-spoor' },
  { axis: 'DISPOSITION', value: 'AMBUSHER',    channel: 'SPOOR', token: 'still-spoor'    },
  { axis: 'DISPOSITION', value: 'TERRITORIAL', channel: 'SPOOR', token: 'boundary-marks' },
  { axis: 'DISPOSITION', value: 'FRENZIED',    channel: 'SPOOR', token: 'erratic-spoor'  },
  // RITE_KEY → LITURGY
  { axis: 'RITE_KEY', value: 'PENANCE',    channel: 'LITURGY', token: 'kneeling-sigil'  },
  { axis: 'RITE_KEY', value: 'IMMOLATION', channel: 'LITURGY', token: 'flame-rune'      },
  { axis: 'RITE_KEY', value: 'INTERMENT',  channel: 'LITURGY', token: 'burial-mark'     },
  { axis: 'RITE_KEY', value: 'SILENCE',    channel: 'LITURGY', token: 'voided-glyph'    },
  // TELL → OMEN
  { axis: 'TELL', value: 'LUNGE',   channel: 'OMEN', token: 'drawn-breath-and-lean'     },
  { axis: 'TELL', value: 'SWEEP',   channel: 'OMEN', token: 'wide-shoulder-coil'        },
  { axis: 'TELL', value: 'RECOIL',  channel: 'OMEN', token: 'backward-step-brace'       },
  { axis: 'TELL', value: 'SHUDDER', channel: 'OMEN', token: 'full-body-tremor'          },
];
