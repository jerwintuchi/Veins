// T47: generateContract and toContractIntel
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateContract, toContractIntel } from './generateContract.js';
import { createRng, hashSeed } from '../rng/seeded.js';

const PRIMARY_VERBS = ['INVESTIGATE', 'ELIMINATE', 'CAPTURE', 'BANISH'] as const;
const TARGET_NAMES  = ['The Ashen Warden', 'The Weeping Mire', 'The Frost Penitent', 'The Rot-Bloom'];
const SITE_NAMES    = ['The Collapsed Chancel', 'The Salt Marsh', 'The Ember Reach', 'The Sunken Nave'];

describe('generateContract', () => {
  it('determinism: same seed → same output (P18/R44)', () => {
    const seed = hashSeed('contract-determinism');
    const a = generateContract(createRng(seed), 'APPRENTICE', 'c-001', 'seed-a');
    const b = generateContract(createRng(seed), 'APPRENTICE', 'c-001', 'seed-a');
    expect(a).toEqual(b);
  });

  it('targetName falls within the 4-entry pool', () => {
    for (let i = 0; i < 20; i++) {
      const { targetName } = generateContract(createRng(hashSeed(`t-${i}`)), 'APPRENTICE', `c-${i}`, `s-${i}`);
      expect(TARGET_NAMES).toContain(targetName);
    }
  });

  it('siteName falls within the 4-entry pool', () => {
    for (let i = 0; i < 20; i++) {
      const { siteName } = generateContract(createRng(hashSeed(`s-${i}`)), 'APPRENTICE', `c-${i}`, `s-${i}`);
      expect(SITE_NAMES).toContain(siteName);
    }
  });

  it('primaryVerb falls within the 4 PrimaryVerb literals', () => {
    for (let i = 0; i < 20; i++) {
      const { primaryVerb } = generateContract(createRng(hashSeed(`v-${i}`)), 'JOURNEYMAN', `c-${i}`, `s-${i}`);
      expect(PRIMARY_VERBS).toContain(primaryVerb);
    }
  });

  it('embedded traitRoll is tier-correct (Apprentice has no ward/disposition/riteKey)', () => {
    const contract = generateContract(createRng(hashSeed('tier-check')), 'APPRENTICE', 'c', 's');
    const keys = Object.keys(contract.traitRoll);
    expect(keys).toContain('aspect');
    expect(keys).toContain('frailty');
    expect(keys).toContain('tell');
    expect(keys).not.toContain('ward');
    expect(keys).not.toContain('disposition');
    expect(keys).not.toContain('riteKey');
  });

  it('embedded traitRoll is Master-complete for Master tier', () => {
    const contract = generateContract(createRng(hashSeed('master-check')), 'MASTER', 'c', 's');
    const keys = Object.keys(contract.traitRoll);
    expect(keys).toContain('ward');
    expect(keys).toContain('disposition');
    expect(keys).toContain('riteKey');
  });

  it('source file does not import node:crypto or call Math.random (R44)', () => {
    const src = fileURLToPath(new URL('./generateContract.ts', import.meta.url));
    const content = readFileSync(src, 'utf-8');
    expect(content).not.toMatch(/Math\.random/);
    expect(content).not.toMatch(/['"]node:crypto['"]/);
    expect(content).not.toMatch(/randomUUID/);
  });
});

describe('toContractIntel', () => {
  it('returns exactly 5 keys — no expeditionSeed or traitRoll (P17/R48)', () => {
    const contract = generateContract(createRng(hashSeed('strip-test')), 'APPRENTICE', 'c-001', 'seed-xyz');
    const intel = toContractIntel(contract);
    const keys = Object.keys(intel).sort();
    expect(keys).toEqual(['contractId', 'primaryVerb', 'siteName', 'targetName', 'tier']);
    expect(keys).not.toContain('expeditionSeed');
    expect(keys).not.toContain('traitRoll');
  });

  it('preserves contractId, tier, targetName, siteName, primaryVerb', () => {
    const contract = generateContract(createRng(hashSeed('preserve-test')), 'JOURNEYMAN', 'my-id', 'my-seed');
    const intel = toContractIntel(contract);
    expect(intel.contractId).toBe('my-id');
    expect(intel.tier).toBe('JOURNEYMAN');
    expect(typeof intel.targetName).toBe('string');
    expect(typeof intel.siteName).toBe('string');
    expect(typeof intel.primaryVerb).toBe('string');
  });
});
