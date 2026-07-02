// T40: Server-only trait types — TraitRoll, ACTIVE_AXES
import { describe, it, expect } from 'vitest';
import { ACTIVE_AXES } from './types.js';
import type { TraitRoll, TraitAxis } from './types.js';

// T40(a): TraitRoll requires aspect, frailty, tell (compile-time check).
const _minimalRoll = {
  aspect:  'EMBER',
  frailty: 'FLAME',
  tell:    'LUNGE',
} satisfies TraitRoll;

// Optional fields are not required (compile-time: Apprentice roll is valid without ward etc.)
const _apprenticeRoll: TraitRoll = { aspect: 'FROST', frailty: 'COLD', tell: 'SWEEP' };

describe('ACTIVE_AXES', () => {
  it('APPRENTICE has exactly 3 axes', () => {
    expect(ACTIVE_AXES.APPRENTICE).toHaveLength(3);
  });

  it('JOURNEYMAN has exactly 5 axes', () => {
    expect(ACTIVE_AXES.JOURNEYMAN).toHaveLength(5);
  });

  it('MASTER has exactly 6 axes', () => {
    expect(ACTIVE_AXES.MASTER).toHaveLength(6);
  });

  it('every axis appears exactly once in MASTER', () => {
    const masterAxes = ACTIVE_AXES.MASTER;
    const unique = new Set(masterAxes);
    expect(unique.size).toBe(masterAxes.length);
  });

  it('APPRENTICE axes are a strict subset of MASTER axes', () => {
    const masterSet = new Set<TraitAxis>(ACTIVE_AXES.MASTER);
    for (const axis of ACTIVE_AXES.APPRENTICE) {
      expect(masterSet.has(axis)).toBe(true);
    }
    expect(ACTIVE_AXES.APPRENTICE.length).toBeLessThan(ACTIVE_AXES.MASTER.length);
  });

  it('JOURNEYMAN axes are a strict subset of MASTER axes and a superset of APPRENTICE', () => {
    const masterSet = new Set<TraitAxis>(ACTIVE_AXES.MASTER);
    const apprenticeSet = new Set<TraitAxis>(ACTIVE_AXES.APPRENTICE);
    for (const axis of ACTIVE_AXES.JOURNEYMAN) {
      expect(masterSet.has(axis)).toBe(true);
    }
    for (const axis of ACTIVE_AXES.APPRENTICE) {
      expect(ACTIVE_AXES.JOURNEYMAN).toContain(axis);
    }
    expect(ACTIVE_AXES.JOURNEYMAN.length).toBeGreaterThan(apprenticeSet.size);
    expect(ACTIVE_AXES.JOURNEYMAN.length).toBeLessThan(ACTIVE_AXES.MASTER.length);
  });
});
