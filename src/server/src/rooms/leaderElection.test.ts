import { describe, it, expect } from 'vitest';
import { reassignLeader } from './leaderElection.js';
import type { ServerPlayerEntry } from './types.js';

function makePlayer(id: string, isLeader = false): ServerPlayerEntry {
  return { playerId: id, displayName: id, socketId: `s-${id}`, isLeader, readyState: false, disconnectedAt: null, perceivedChannels: [] };
}

// T7: leader election

describe('reassignLeader', () => {
  it('assigns isLeader=true to the first player', () => {
    const result = reassignLeader([makePlayer('p1'), makePlayer('p2'), makePlayer('p3')]);
    expect(result[0]?.isLeader).toBe(true);
  });

  it('sets all other players to isLeader=false', () => {
    const result = reassignLeader([makePlayer('p1', true), makePlayer('p2', true)]);
    expect(result[1]?.isLeader).toBe(false);
  });

  it('returns empty array without throwing for empty input', () => {
    expect(reassignLeader([])).toEqual([]);
  });

  it('single-player array returns that player as leader', () => {
    const result = reassignLeader([makePlayer('p1')]);
    expect(result[0]?.isLeader).toBe(true);
  });
});
