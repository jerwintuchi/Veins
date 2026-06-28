import { describe, it, expect } from 'vitest';
import { generateLootPool, generateLootPools, LOOT_POOL_SIZE } from './pool.js';
import type { RelicBoard } from '@veins/shared';

const EMPTY_BOARD: RelicBoard = { slots: {} };

const ALL_IDS = ['blooming-wound', 'systemic-rot', 'resonant-cord', 'synaptic-filament', 'calcified-shell', 'votive-tissue'];

describe('generateLootPool (T1, R1)', () => {
  it('is deterministic: same inputs produce the same pool', () => {
    const a = generateLootPool(ALL_IDS, EMPTY_BOARD, 'run-1', 1);
    const b = generateLootPool(ALL_IDS, EMPTY_BOARD, 'run-1', 1);
    expect(a).toEqual(b);
  });

  it('different floor yields a different pool', () => {
    const floor1 = generateLootPool(ALL_IDS, EMPTY_BOARD, 'run-1', 1);
    const floor2 = generateLootPool(ALL_IDS, EMPTY_BOARD, 'run-1', 2);
    expect(floor1).not.toEqual(floor2);
  });

  it('different runId yields a different pool', () => {
    const a = generateLootPool(ALL_IDS, EMPTY_BOARD, 'run-A', 1);
    const b = generateLootPool(ALL_IDS, EMPTY_BOARD, 'run-B', 1);
    expect(a).not.toEqual(b);
  });

  it('pool size is min(LOOT_POOL_SIZE, unplacedCount)', () => {
    const pool = generateLootPool(ALL_IDS, EMPTY_BOARD, 'run-1', 1);
    expect(pool).toHaveLength(LOOT_POOL_SIZE);
  });

  it('pool contains only unplaced relics', () => {
    const board: RelicBoard = {
      slots: {
        '0,0': { coord: { q: 0, r: 0 }, ownerId: 'p1', relicId: 'blooming-wound' },
        '1,0': { coord: { q: 1, r: 0 }, ownerId: 'p2', relicId: 'systemic-rot' },
        '-1,0': { coord: { q: -1, r: 0 }, ownerId: 'p1', relicId: 'resonant-cord' },
      },
    };
    const pool = generateLootPool(ALL_IDS, board, 'run-1', 1);
    expect(pool).not.toContain('blooming-wound');
    expect(pool).not.toContain('systemic-rot');
    expect(pool).not.toContain('resonant-cord');
  });

  it('pool is smaller than LOOT_POOL_SIZE when fewer unplaced relics remain', () => {
    const onlyTwo = ['calcified-shell', 'votive-tissue'];
    const pool = generateLootPool(onlyTwo, EMPTY_BOARD, 'run-1', 1);
    expect(pool).toHaveLength(2);
    expect(pool).toContain('calcified-shell');
    expect(pool).toContain('votive-tissue');
  });

  it('backfills with acquired relics when everything is placed (tray never empty)', () => {
    const board: RelicBoard = {
      slots: {
        '0,0': { coord: { q: 0, r: 0 }, ownerId: 'p1', relicId: 'calcified-shell' },
      },
    };
    // No unplaced relics remain, so the pool re-offers the acquired one — a full
    // board can still be refined (placement into an occupied own-slot replaces it).
    const pool = generateLootPool(['calcified-shell'], board, 'run-1', 1);
    expect(pool).toEqual(['calcified-shell']);
  });

  it('returns empty only when the registry itself is empty', () => {
    expect(generateLootPool([], { slots: {} }, 'run-1', 1)).toEqual([]);
  });

  it('all pool entries are unique', () => {
    const pool = generateLootPool(ALL_IDS, EMPTY_BOARD, 'run-1', 1);
    expect(new Set(pool).size).toBe(pool.length);
  });

  // Per-player ownerId salt: distinct, deterministic pools, and a teammate's
  // placement does not shrink another player's pool.
  it('ownerId yields a distinct, deterministic pool per player', () => {
    const a1 = generateLootPool(ALL_IDS, EMPTY_BOARD, 'run-1', 1, 'p1');
    const a2 = generateLootPool(ALL_IDS, EMPTY_BOARD, 'run-1', 1, 'p1');
    const b1 = generateLootPool(ALL_IDS, EMPTY_BOARD, 'run-1', 1, 'p2');
    expect(a1).toEqual(a2);          // deterministic per player
    expect(a1).not.toEqual(b1);      // different player → different ordering
  });

  it('per-player pool only excludes that owner’s placed relics, not teammates’', () => {
    const board: RelicBoard = {
      slots: {
        '0,0': { coord: { q: 0, r: 0 }, ownerId: 'p1', relicId: 'blooming-wound' },
        '1,0': { coord: { q: 1, r: 0 }, ownerId: 'p2', relicId: 'systemic-rot' },
      },
    };
    // p2's pool may still offer blooming-wound (only p1 placed it).
    const p2 = generateLootPool(ALL_IDS, board, 'run-1', 1, 'p2');
    expect(p2).not.toContain('systemic-rot'); // p2's own placement excluded
    // p1's pool may still offer systemic-rot (only p2 placed it).
    const p1 = generateLootPool(ALL_IDS, board, 'run-1', 1, 'p1');
    expect(p1).not.toContain('blooming-wound');
  });
});

describe('generateLootPools (per-player)', () => {
  it('returns an independent pool keyed by each player', () => {
    const pools = generateLootPools(ALL_IDS, EMPTY_BOARD, 'run-1', 1, ['p1', 'p2']);
    expect(Object.keys(pools).sort()).toEqual(['p1', 'p2']);
    expect(pools['p1']).toEqual(generateLootPool(ALL_IDS, EMPTY_BOARD, 'run-1', 1, 'p1'));
    expect(pools['p2']).toEqual(generateLootPool(ALL_IDS, EMPTY_BOARD, 'run-1', 1, 'p2'));
  });
});
