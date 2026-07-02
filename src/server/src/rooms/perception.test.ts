// T63: perception assignment — channelsForTier, assignPerception, filterSigns (R60, P25–P27)
import { describe, it, expect } from 'vitest';
import { channelsForTier, assignPerception, filterSigns, MIN_CHANNELS_PER_PLAYER } from './perception.js';
import { createRng, hashSeed } from '../rng/seeded.js';
import type { Channel, Sign, Tier } from '@testament/shared';
import { CHANNELS } from '@testament/shared';

const TIERS: Tier[] = ['APPRENTICE', 'JOURNEYMAN', 'MASTER'];

function playerIds(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `p${i + 1}`);
}

function canonicalIndex(c: Channel): number {
  return CHANNELS.indexOf(c);
}

describe('channelsForTier', () => {
  it('Apprentice: ambient channels plus REACTION, canonical order', () => {
    expect(channelsForTier('APPRENTICE')).toEqual(['RESIDUE', 'STRESS_MARK', 'REACTION', 'OMEN']);
  });

  it('Journeyman: adds SPOOR', () => {
    expect(channelsForTier('JOURNEYMAN')).toEqual(['RESIDUE', 'STRESS_MARK', 'REACTION', 'SPOOR', 'OMEN']);
  });

  it('Master: all six channels', () => {
    expect(channelsForTier('MASTER')).toEqual(CHANNELS);
  });
});

describe('assignPerception', () => {
  it('is deterministic: same seed → identical assignment (P25)', () => {
    const ids = playerIds(3);
    const chans = channelsForTier('MASTER');
    const a = assignPerception(createRng(hashSeed('seed-x:perception')), ids, chans);
    const b = assignPerception(createRng(hashSeed('seed-x:perception')), ids, chans);
    expect([...a.entries()]).toEqual([...b.entries()]);
  });

  it('different seeds can produce different assignments', () => {
    const ids = playerIds(3);
    const chans = channelsForTier('MASTER');
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const m = assignPerception(createRng(hashSeed(`seed-${i}:perception`)), ids, chans);
      seen.add(JSON.stringify([...m.entries()]));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('union of all sets equals the input channels at every party size and tier (P26)', () => {
    for (const tier of TIERS) {
      const chans = channelsForTier(tier);
      for (let n = 1; n <= 4; n++) {
        const m = assignPerception(createRng(hashSeed(`u-${tier}-${n}`)), playerIds(n), chans);
        const union = new Set([...m.values()].flat());
        expect([...union].sort()).toEqual([...chans].sort());
      }
    }
  });

  it('every player holds at least MIN_CHANNELS_PER_PLAYER channels (P27)', () => {
    for (const tier of TIERS) {
      const chans = channelsForTier(tier);
      for (let n = 2; n <= 4; n++) {
        const m = assignPerception(createRng(hashSeed(`m-${tier}-${n}`)), playerIds(n), chans);
        for (const set of m.values()) {
          expect(set.length).toBeGreaterThanOrEqual(MIN_CHANNELS_PER_PLAYER);
          expect(new Set(set).size).toBe(set.length); // no duplicates within a set
        }
      }
    }
  });

  it('solo player receives all channels (P27)', () => {
    for (const tier of TIERS) {
      const chans = channelsForTier(tier);
      const m = assignPerception(createRng(hashSeed(`s-${tier}`)), ['solo'], chans);
      expect(m.get('solo')).toEqual(chans);
    }
  });

  it('each assigned list is sorted in canonical CHANNELS order', () => {
    const m = assignPerception(createRng(hashSeed('order')), playerIds(4), channelsForTier('MASTER'));
    for (const set of m.values()) {
      const idx = set.map(canonicalIndex);
      expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    }
  });

  it('4 Seekers at Apprentice (4 channels): every player gets exactly 2 via overlap', () => {
    const m = assignPerception(createRng(hashSeed('ov')), playerIds(4), channelsForTier('APPRENTICE'));
    for (const set of m.values()) {
      expect(set).toHaveLength(2);
    }
  });
});

describe('filterSigns', () => {
  const signs: Sign[] = [
    { channel: 'RESIDUE',     token: 'scorched-wax' },
    { channel: 'STRESS_MARK', token: 'flinch-from-flame' },
    { channel: 'OMEN',        token: 'drawn-breath-and-lean' },
    { channel: 'REACTION',    token: 'drinks-cold' },
  ];

  it('keeps exactly the in-set signs, preserving order (P28)', () => {
    expect(filterSigns(signs, ['RESIDUE', 'REACTION'])).toEqual([
      { channel: 'RESIDUE',  token: 'scorched-wax' },
      { channel: 'REACTION', token: 'drinks-cold' },
    ]);
  });

  it('returns everything when the set covers all channels, nothing for an empty set', () => {
    expect(filterSigns(signs, [...CHANNELS])).toEqual(signs);
    expect(filterSigns(signs, [])).toEqual([]);
  });
});
