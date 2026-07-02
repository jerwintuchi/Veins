import { describe, it, expect } from 'vitest';
import { assertPhase } from './phaseGuard.js';
import type { EmitFn, RoomRecord, ServerPlayerEntry } from './types.js';

function makeEmit(): { fn: EmitFn; calls: Array<[string, unknown]> } {
  const calls: Array<[string, unknown]> = [];
  return { fn: (t, p) => calls.push([t, p]), calls };
}

function makeRoom(phase: RoomRecord['phase'] = 'DEPLOYING'): RoomRecord {
  const p: ServerPlayerEntry = {
    playerId: 'p1', displayName: 'A', socketId: 's1',
    isLeader: true, readyState: false, disconnectedAt: null,
  };
  return { code: 'ABC123', phase, players: [p], contract: null, fieldData: null, exposure: 0, revealedSigns: [] };
}

// T32: assertPhase phase guard

describe('assertPhase', () => {
  it('returns false and emits NOT_IN_ROOM when room is undefined', () => {
    const { fn: emit, calls } = makeEmit();
    const result = assertPhase(undefined, 'DEPLOYING', emit);
    expect(result).toBe(false);
    expect((calls[0]?.[1] as { code: string }).code).toBe('NOT_IN_ROOM');
  });

  it('returns false and emits WRONG_PHASE when room phase does not match', () => {
    const { fn: emit, calls } = makeEmit();
    const result = assertPhase(makeRoom('WAITING'), 'DEPLOYING', emit);
    expect(result).toBe(false);
    expect((calls[0]?.[1] as { code: string }).code).toBe('WRONG_PHASE');
  });

  it('returns true and emits nothing when room is defined and phase matches', () => {
    const { fn: emit, calls } = makeEmit();
    const result = assertPhase(makeRoom('DEPLOYING'), 'DEPLOYING', emit);
    expect(result).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it('WRONG_PHASE message includes expected and actual phase', () => {
    const { fn: emit, calls } = makeEmit();
    assertPhase(makeRoom('WAITING'), 'FIELD', emit);
    const msg = (calls[0]?.[1] as { message: string }).message;
    expect(msg).toContain('FIELD');
    expect(msg).toContain('WAITING');
  });
});
