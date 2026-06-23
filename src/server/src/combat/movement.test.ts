import { describe, it, expect } from 'vitest';
import { movePlayer } from './movement.js';
import { PLAYER_SPEED } from '@veins/shared';
import type { PlayerState, DungeonLayout } from '@veins/shared';

// Large flat room — all positions in [0,512]×[0,512] are walkable.
const DUNGEON: DungeonLayout = {
  runId: 'flat', width: 512, height: 512,
  rooms: [{ id: 'room-0', rect: { x: 0, y: 0, width: 512, height: 512 } }],
  corridors: [],
};

function makePlayer(x: number, y: number): PlayerState {
  return { hp: 100, maxHp: 100, downed: false, x, y };
}

describe('movePlayer (T9, R8)', () => {
  it('zero vector returns the original state unchanged (no mutation)', () => {
    const ps = makePlayer(50, 50);
    const result = movePlayer(ps, 0, 0, 0.1, DUNGEON);
    expect(result).toBe(ps); // same reference: no clone on no-op
  });

  it('pure cardinal movement (dx=1, dy=0) moves exactly speed * dt units', () => {
    const ps = makePlayer(0, 0);
    const dt = 0.1;
    const result = movePlayer(ps, 1, 0, dt, DUNGEON);
    expect(result.x).toBeCloseTo(PLAYER_SPEED * dt, 5);
    expect(result.y).toBeCloseTo(0, 5);
  });

  it('diagonal input is normalized: speed is PLAYER_SPEED * dt, not sqrt(2) * that', () => {
    const ps = makePlayer(0, 0);
    const dt = 0.1;
    const result = movePlayer(ps, 1, 1, dt, DUNGEON);
    const dist = Math.sqrt(result.x ** 2 + result.y ** 2);
    expect(dist).toBeCloseTo(PLAYER_SPEED * dt, 4);
  });

  it('clamps x to dungeon.width at the right edge', () => {
    const ps = makePlayer(DUNGEON.width - 1, 0);
    const result = movePlayer(ps, 1, 0, 1, DUNGEON, 100);
    expect(result.x).toBeLessThanOrEqual(DUNGEON.width);
  });

  it('clamps x to 0 at the left edge', () => {
    const ps = makePlayer(1, 0);
    const result = movePlayer(ps, -1, 0, 1, DUNGEON, 100);
    expect(result.x).toBeGreaterThanOrEqual(0);
  });

  it('clamps y to dungeon.height at the bottom edge', () => {
    const ps = makePlayer(0, DUNGEON.height - 1);
    const result = movePlayer(ps, 0, 1, 1, DUNGEON, 100);
    expect(result.y).toBeLessThanOrEqual(DUNGEON.height);
  });

  it('does not mutate the input PlayerState', () => {
    const ps = makePlayer(10, 10);
    const before = { ...ps };
    movePlayer(ps, 1, 0, 0.1, DUNGEON);
    expect(ps).toEqual(before);
  });
});
