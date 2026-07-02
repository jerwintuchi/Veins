// T43: generateTraitRoll — tier-gating, determinism, value set membership, no Math.random
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateTraitRoll } from './generateTraitRoll.js';
import { createRng, hashSeed } from '../rng/seeded.js';

const ASPECT_VALUES      = ['EMBER', 'FROST', 'ROT', 'MIRE'] as const;
const FRAILTY_VALUES     = ['FLAME', 'COLD', 'SALT', 'LIGHT'] as const;
const TELL_VALUES        = ['LUNGE', 'SWEEP', 'RECOIL', 'SHUDDER'] as const;
const WARD_VALUES        = ['FLAME', 'COLD', 'SALT', 'LIGHT'] as const;
const DISPOSITION_VALUES = ['STALKER', 'AMBUSHER', 'TERRITORIAL', 'FRENZIED'] as const;
const RITE_KEY_VALUES    = ['PENANCE', 'IMMOLATION', 'INTERMENT', 'SILENCE'] as const;

describe('generateTraitRoll', () => {
  it('Apprentice roll has aspect, frailty, tell and no optional axes', () => {
    const rng = createRng(hashSeed('apprentice-test'));
    const roll = generateTraitRoll(rng, 'APPRENTICE');
    const keys = Object.keys(roll);
    expect(keys).toContain('aspect');
    expect(keys).toContain('frailty');
    expect(keys).toContain('tell');
    expect(keys).not.toContain('ward');
    expect(keys).not.toContain('disposition');
    expect(keys).not.toContain('riteKey');
  });

  it('Journeyman roll adds ward and disposition, still no riteKey', () => {
    const rng = createRng(hashSeed('journeyman-test'));
    const roll = generateTraitRoll(rng, 'JOURNEYMAN');
    const keys = Object.keys(roll);
    expect(keys).toContain('ward');
    expect(keys).toContain('disposition');
    expect(keys).not.toContain('riteKey');
  });

  it('Master roll has all six fields', () => {
    const rng = createRng(hashSeed('master-test'));
    const roll = generateTraitRoll(rng, 'MASTER');
    const keys = Object.keys(roll);
    expect(keys).toContain('aspect');
    expect(keys).toContain('frailty');
    expect(keys).toContain('tell');
    expect(keys).toContain('ward');
    expect(keys).toContain('disposition');
    expect(keys).toContain('riteKey');
  });

  it('determinism: same seed + tier → same roll (P15/R36)', () => {
    const seed = hashSeed('determinism-seed');
    const rollA = generateTraitRoll(createRng(seed), 'MASTER');
    const rollB = generateTraitRoll(createRng(seed), 'MASTER');
    expect(rollA).toEqual(rollB);
  });

  it('different seeds produce different rolls (probabilistic)', () => {
    const rollA = generateTraitRoll(createRng(hashSeed('seed-alpha')), 'MASTER');
    const rollB = generateTraitRoll(createRng(hashSeed('seed-beta')), 'MASTER');
    // With 4^6 = 4096 possibilities, collision probability is ~0.024%; accept the test.
    expect(rollA).not.toEqual(rollB);
  });

  it('all generated values fall within v1 enum sets — checked across 20 seeds', () => {
    for (let i = 0; i < 20; i++) {
      const rng = createRng(hashSeed(`value-check-${i}`));
      const roll = generateTraitRoll(rng, 'MASTER');
      expect(ASPECT_VALUES).toContain(roll.aspect);
      expect(FRAILTY_VALUES).toContain(roll.frailty);
      expect(TELL_VALUES).toContain(roll.tell);
      expect(WARD_VALUES).toContain(roll.ward);
      expect(DISPOSITION_VALUES).toContain(roll.disposition);
      expect(RITE_KEY_VALUES).toContain(roll.riteKey);
    }
  });

  it('source file does not import crypto or call Math.random (R41)', () => {
    const src = fileURLToPath(new URL('./generateTraitRoll.ts', import.meta.url));
    const content = readFileSync(src, 'utf-8');
    expect(content).not.toMatch(/Math\.random/);
    expect(content).not.toMatch(/['"]node:crypto['"]/);
    expect(content).not.toMatch(/require\(['"]crypto['"]\)/);
  });
});
