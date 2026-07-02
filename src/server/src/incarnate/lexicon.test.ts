// T41: SIGN_LEXICON — completeness, uniqueness, shape
import { describe, it, expect } from 'vitest';
import { SIGN_LEXICON } from './lexicon.js';
import type { TraitAxis } from './types.js';

const AXIS_VALUE_LITERALS = [
  'EMBER', 'FROST', 'ROT', 'MIRE',
  'FLAME', 'COLD', 'SALT', 'LIGHT',
  'STALKER', 'AMBUSHER', 'TERRITORIAL', 'FRENZIED',
  'PENANCE', 'IMMOLATION', 'INTERMENT', 'SILENCE',
  'LUNGE', 'SWEEP', 'RECOIL', 'SHUDDER',
];

describe('SIGN_LEXICON', () => {
  it('has exactly 24 entries (4 values × 6 axes)', () => {
    expect(SIGN_LEXICON).toHaveLength(24);
  });

  it('all token values are unique (P14)', () => {
    const tokens = SIGN_LEXICON.map(e => e.token);
    const unique = new Set(tokens);
    expect(unique.size).toBe(tokens.length);
  });

  it('every entry channel is a valid Channel string', () => {
    const validChannels = new Set(['RESIDUE', 'STRESS_MARK', 'REACTION', 'SPOOR', 'LITURGY', 'OMEN']);
    for (const entry of SIGN_LEXICON) {
      expect(validChannels.has(entry.channel)).toBe(true);
    }
  });

  it('groups by axis yield exactly 6 axes each with exactly 4 entries', () => {
    const byAxis = new Map<TraitAxis, number>();
    for (const entry of SIGN_LEXICON) {
      byAxis.set(entry.axis, (byAxis.get(entry.axis) ?? 0) + 1);
    }
    expect(byAxis.size).toBe(6);
    for (const [, count] of byAxis) {
      expect(count).toBe(4);
    }
  });

  it('no token string equals any axis value literal (P12 data-level guard)', () => {
    const axisValueSet = new Set(AXIS_VALUE_LITERALS);
    for (const entry of SIGN_LEXICON) {
      expect(axisValueSet.has(entry.token)).toBe(false);
    }
  });
});
