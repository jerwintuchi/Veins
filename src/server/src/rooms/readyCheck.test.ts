import { describe, it, expect } from 'vitest';
import { allReady } from './readyCheck.js';
import type { ServerPlayerEntry } from './types.js';

function p(ready: boolean): ServerPlayerEntry {
  return { playerId: 'x', displayName: 'x', socketId: 'x', isLeader: false, readyState: ready, disconnectedAt: null, perceivedChannels: [] };
}

// T8: all-ready check

describe('allReady', () => {
  it('returns true when all players are ready', () => {
    expect(allReady([p(true), p(true)])).toBe(true);
  });

  it('returns false when any player is not ready', () => {
    expect(allReady([p(true), p(false)])).toBe(false);
  });

  it('returns true for a single ready player', () => {
    expect(allReady([p(true)])).toBe(true);
  });

  it('returns true for an empty array (vacuous)', () => {
    expect(allReady([])).toBe(true);
  });
});
