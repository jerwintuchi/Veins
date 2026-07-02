// T44: Completeness cross-check — every reachable (axis, value) pair has a lexicon entry
// and deriveSigns never throws for any valid generated roll.
import { describe, it, expect } from 'vitest';
import { SIGN_LEXICON } from './lexicon.js';
import { ACTIVE_AXES } from './types.js';
import { deriveSigns } from './deriveSigns.js';
import { generateTraitRoll } from './generateTraitRoll.js';
import { createRng, hashSeed } from '../rng/seeded.js';
import type { TraitRoll } from './types.js';

const ASPECT_VALUES      = ['EMBER', 'FROST', 'ROT', 'MIRE'] as const;
const FRAILTY_VALUES     = ['FLAME', 'COLD', 'SALT', 'LIGHT'] as const;
const TELL_VALUES        = ['LUNGE', 'SWEEP', 'RECOIL', 'SHUDDER'] as const;
const WARD_VALUES        = ['FLAME', 'COLD', 'SALT', 'LIGHT'] as const;
const DISPOSITION_VALUES = ['STALKER', 'AMBUSHER', 'TERRITORIAL', 'FRENZIED'] as const;
const RITE_KEY_VALUES    = ['PENANCE', 'IMMOLATION', 'INTERMENT', 'SILENCE'] as const;

describe('completeness cross-check', () => {
  it('every (axis, value) pair in ACTIVE_AXES.MASTER has a SIGN_LEXICON entry (P13)', () => {
    const axisValuePairs: Array<[string, string]> = [
      ...ASPECT_VALUES.map(v => ['ASPECT', v] as [string, string]),
      ...FRAILTY_VALUES.map(v => ['FRAILTY', v] as [string, string]),
      ...TELL_VALUES.map(v => ['TELL', v] as [string, string]),
      ...WARD_VALUES.map(v => ['WARD', v] as [string, string]),
      ...DISPOSITION_VALUES.map(v => ['DISPOSITION', v] as [string, string]),
      ...RITE_KEY_VALUES.map(v => ['RITE_KEY', v] as [string, string]),
    ];

    for (const [axis, value] of axisValuePairs) {
      const entry = SIGN_LEXICON.find(e => e.axis === axis && e.value === value);
      expect(entry, `missing lexicon entry for axis=${axis} value=${value}`).toBeDefined();
    }
  });

  it('deriveSigns does not throw for 100 randomly seeded Master rolls', () => {
    for (let i = 0; i < 100; i++) {
      const rng = createRng(hashSeed(`completeness-${i}`));
      const roll = generateTraitRoll(rng, 'MASTER');
      expect(() => deriveSigns(roll, 'MASTER')).not.toThrow();
      expect(() => deriveSigns(roll, 'JOURNEYMAN')).not.toThrow();
      expect(() => deriveSigns(roll, 'APPRENTICE')).not.toThrow();
    }
  });

  it('SIGN_LEXICON has exactly 24 unique tokens (P14 regression guard)', () => {
    const tokens = SIGN_LEXICON.map(e => e.token);
    expect(new Set(tokens).size).toBe(24);
  });

  it('ACTIVE_AXES.MASTER covers all 6 axes from the lexicon', () => {
    const lexiconAxes = new Set(SIGN_LEXICON.map(e => e.axis));
    const activeAxes = new Set(ACTIVE_AXES.MASTER);
    for (const axis of lexiconAxes) {
      expect(activeAxes.has(axis)).toBe(true);
    }
    expect(lexiconAxes.size).toBe(activeAxes.size);
  });
});
