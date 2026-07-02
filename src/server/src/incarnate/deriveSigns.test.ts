// T42: deriveSigns — correct count per tier, sign opacity, stability
// T55: deriveAmbientSigns — REACTION channel is probe-gated (R58, P22)
import { describe, it, expect } from 'vitest';
import { deriveSigns, deriveAmbientSigns } from './deriveSigns.js';
import type { TraitRoll } from './types.js';
import type { Tier } from '@testament/shared';

// A full Master roll used as base fixture.
const FULL_ROLL: TraitRoll = {
  aspect:      'EMBER',
  frailty:     'FLAME',
  tell:        'LUNGE',
  ward:        'COLD',
  disposition: 'STALKER',
  riteKey:     'PENANCE',
};

// All axis value literals that must not appear in JSON output (R40).
const AXIS_VALUE_LITERALS = [
  'EMBER', 'FROST', 'ROT', 'MIRE',
  'FLAME', 'COLD', 'SALT', 'LIGHT',
  'STALKER', 'AMBUSHER', 'TERRITORIAL', 'FRENZIED',
  'PENANCE', 'IMMOLATION', 'INTERMENT', 'SILENCE',
  'LUNGE', 'SWEEP', 'RECOIL', 'SHUDDER',
];

describe('deriveSigns', () => {
  it('Apprentice: returns exactly 3 signs with channels RESIDUE, STRESS_MARK, OMEN', () => {
    const signs = deriveSigns(FULL_ROLL, 'APPRENTICE');
    expect(signs).toHaveLength(3);
    expect(signs.map(s => s.channel)).toEqual(['RESIDUE', 'STRESS_MARK', 'OMEN']);
  });

  it('Journeyman: returns exactly 5 signs adding REACTION and SPOOR', () => {
    const signs = deriveSigns(FULL_ROLL, 'JOURNEYMAN');
    expect(signs).toHaveLength(5);
    expect(signs.map(s => s.channel)).toEqual(['RESIDUE', 'STRESS_MARK', 'OMEN', 'REACTION', 'SPOOR']);
  });

  it('Master: returns exactly 6 signs adding LITURGY', () => {
    const signs = deriveSigns(FULL_ROLL, 'MASTER');
    expect(signs).toHaveLength(6);
    expect(signs.map(s => s.channel)).toEqual(['RESIDUE', 'STRESS_MARK', 'OMEN', 'REACTION', 'SPOOR', 'LITURGY']);
  });

  it('every Sign has exactly the keys channel and token (P12)', () => {
    const signs = deriveSigns(FULL_ROLL, 'MASTER');
    for (const sign of signs) {
      expect(Object.keys(sign).sort()).toEqual(['channel', 'token']);
    }
  });

  it('JSON output contains no axis value literals (R40)', () => {
    const json = JSON.stringify(deriveSigns(FULL_ROLL, 'MASTER'));
    for (const literal of AXIS_VALUE_LITERALS) {
      expect(json).not.toContain(`"${literal}"`);
      expect(json).not.toContain(`:${literal}`);
    }
  });

  it('same inputs produce identical output (stability — P15)', () => {
    const a = deriveSigns(FULL_ROLL, 'JOURNEYMAN');
    const b = deriveSigns(FULL_ROLL, 'JOURNEYMAN');
    expect(a).toEqual(b);
  });

  it('different trait values produce different tokens', () => {
    const rollA: TraitRoll = { aspect: 'EMBER', frailty: 'FLAME', tell: 'LUNGE' };
    const rollB: TraitRoll = { aspect: 'FROST', frailty: 'COLD',  tell: 'SWEEP' };
    const signsA = deriveSigns(rollA, 'APPRENTICE');
    const signsB = deriveSigns(rollB, 'APPRENTICE');
    expect(signsA).not.toEqual(signsB);
  });

  it('throws a descriptive error when a lexicon entry is missing', () => {
    const badRoll = { aspect: 'INVALID' as 'EMBER', frailty: 'FLAME', tell: 'LUNGE' };
    expect(() => deriveSigns(badRoll, 'APPRENTICE')).toThrow(/lexicon missing entry/);
  });
});

describe('deriveAmbientSigns (T55)', () => {
  it('never emits a REACTION-channel sign at any tier (P22)', () => {
    const tiers: Tier[] = ['APPRENTICE', 'JOURNEYMAN', 'MASTER'];
    for (const tier of tiers) {
      const signs = deriveAmbientSigns(FULL_ROLL, tier);
      expect(signs.every(s => s.channel !== 'REACTION')).toBe(true);
    }
  });

  it('Apprentice: 3 signs — RESIDUE, STRESS_MARK, OMEN', () => {
    const signs = deriveAmbientSigns(FULL_ROLL, 'APPRENTICE');
    expect(signs.map(s => s.channel)).toEqual(['RESIDUE', 'STRESS_MARK', 'OMEN']);
  });

  it('Journeyman: 4 signs — adds SPOOR, not REACTION', () => {
    const signs = deriveAmbientSigns(FULL_ROLL, 'JOURNEYMAN');
    expect(signs.map(s => s.channel)).toEqual(['RESIDUE', 'STRESS_MARK', 'OMEN', 'SPOOR']);
  });

  it('Master: 5 signs — adds LITURGY, not REACTION', () => {
    const signs = deriveAmbientSigns(FULL_ROLL, 'MASTER');
    expect(signs.map(s => s.channel)).toEqual(['RESIDUE', 'STRESS_MARK', 'OMEN', 'SPOOR', 'LITURGY']);
  });

  it('same inputs produce identical output (determinism)', () => {
    expect(deriveAmbientSigns(FULL_ROLL, 'MASTER')).toEqual(deriveAmbientSigns(FULL_ROLL, 'MASTER'));
  });

  it('JSON output contains no axis value literals (R40)', () => {
    const json = JSON.stringify(deriveAmbientSigns(FULL_ROLL, 'MASTER'));
    for (const literal of AXIS_VALUE_LITERALS) {
      expect(json).not.toContain(`"${literal}"`);
    }
  });
});
