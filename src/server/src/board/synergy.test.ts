import { describe, it, expect } from 'vitest';
import type { Relic, RelicSlot, RelicTag } from '@veins/shared';
import { hexCoordKey } from '@veins/shared';
import { evaluateSynergies } from './synergy.js';

// --- test helpers ---

function makeRelic(id: string, tags: RelicTag[]): Relic {
  return {
    id,
    name: id,
    tags,
    baseEffect: { description: '' },
    synergyEffect: { description: '' },
  };
}

function makeBoard(slots: RelicSlot[]) {
  return {
    slots: Object.fromEntries(slots.map(s => [hexCoordKey(s.coord), s])),
  };
}

function makeRegistry(...relics: Relic[]) {
  return new Map(relics.map(r => [r.id, r]));
}

// --- tests ---

describe('evaluateSynergies', () => {
  it('returns an empty map for an empty board', () => {
    expect(evaluateSynergies({ slots: {} }, new Map())).toEqual({});
  });

  it('returns false for a single relic with no neighbors', () => {
    const r1 = makeRelic('r1', ['fire']);
    const board = makeBoard([{ coord: { q: 0, r: 0 }, ownerId: 'p1', relicId: 'r1' }]);
    expect(evaluateSynergies(board, makeRegistry(r1))).toEqual({ r1: false });
  });

  // P1 — Determinism
  it('P1: returns identical result when called twice with the same inputs', () => {
    const r1 = makeRelic('r1', ['fire']);
    const r2 = makeRelic('r2', ['fire']);
    const board = makeBoard([
      { coord: { q: 0, r: 0 }, ownerId: 'p1', relicId: 'r1' },
      { coord: { q: 1, r: 0 }, ownerId: 'p2', relicId: 'r2' },
    ]);
    const registry = makeRegistry(r1, r2);
    expect(evaluateSynergies(board, registry)).toEqual(evaluateSynergies(board, registry));
  });

  // P2 — Owner isolation
  it('P2: does not fire synergy when adjacent relics belong to the same player', () => {
    const r1 = makeRelic('r1', ['fire']);
    const r2 = makeRelic('r2', ['fire']);
    const board = makeBoard([
      { coord: { q: 0, r: 0 }, ownerId: 'p1', relicId: 'r1' },
      { coord: { q: 1, r: 0 }, ownerId: 'p1', relicId: 'r2' },
    ]);
    const result = evaluateSynergies(board, makeRegistry(r1, r2));
    expect(result['r1']).toBe(false);
    expect(result['r2']).toBe(false);
  });

  // P3 — Mutual synergy
  it('P3: fires synergy for both relics when cross-player adjacent relics share a tag', () => {
    const r1 = makeRelic('r1', ['fire']);
    const r2 = makeRelic('r2', ['fire']);
    const board = makeBoard([
      { coord: { q: 0, r: 0 }, ownerId: 'p1', relicId: 'r1' },
      { coord: { q: 1, r: 0 }, ownerId: 'p2', relicId: 'r2' },
    ]);
    const result = evaluateSynergies(board, makeRegistry(r1, r2));
    expect(result['r1']).toBe(true);
    expect(result['r2']).toBe(true);
  });

  // P4 — Tag specificity
  it('P4: does not fire when adjacent cross-player relics share no tags', () => {
    const r1 = makeRelic('r1', ['fire']);
    const r2 = makeRelic('r2', ['poison']);
    const board = makeBoard([
      { coord: { q: 0, r: 0 }, ownerId: 'p1', relicId: 'r1' },
      { coord: { q: 1, r: 0 }, ownerId: 'p2', relicId: 'r2' },
    ]);
    const result = evaluateSynergies(board, makeRegistry(r1, r2));
    expect(result['r1']).toBe(false);
    expect(result['r2']).toBe(false);
  });

  // P5 — Order independence
  it('P5: produces the same result regardless of slot insertion order', () => {
    const r1 = makeRelic('r1', ['fire']);
    const r2 = makeRelic('r2', ['fire']);
    const registry = makeRegistry(r1, r2);
    const boardAB = makeBoard([
      { coord: { q: 0, r: 0 }, ownerId: 'p1', relicId: 'r1' },
      { coord: { q: 1, r: 0 }, ownerId: 'p2', relicId: 'r2' },
    ]);
    const boardBA = makeBoard([
      { coord: { q: 1, r: 0 }, ownerId: 'p2', relicId: 'r2' },
      { coord: { q: 0, r: 0 }, ownerId: 'p1', relicId: 'r1' },
    ]);
    expect(evaluateSynergies(boardAB, registry)).toEqual(evaluateSynergies(boardBA, registry));
  });

  it('does not fire for non-adjacent cross-player relics even with matching tags', () => {
    const r1 = makeRelic('r1', ['fire']);
    const r2 = makeRelic('r2', ['fire']);
    const board = makeBoard([
      { coord: { q: 0, r: 0 }, ownerId: 'p1', relicId: 'r1' },
      { coord: { q: 3, r: 0 }, ownerId: 'p2', relicId: 'r2' },
    ]);
    const result = evaluateSynergies(board, makeRegistry(r1, r2));
    expect(result['r1']).toBe(false);
    expect(result['r2']).toBe(false);
  });

  it('fires when at least one tag matches, even if not all tags match', () => {
    const r1 = makeRelic('r1', ['fire', 'aoe']);
    const r2 = makeRelic('r2', ['fire', 'poison']);
    const board = makeBoard([
      { coord: { q: 0, r: 0 }, ownerId: 'p1', relicId: 'r1' },
      { coord: { q: 1, r: 0 }, ownerId: 'p2', relicId: 'r2' },
    ]);
    const result = evaluateSynergies(board, makeRegistry(r1, r2));
    expect(result['r1']).toBe(true);
    expect(result['r2']).toBe(true);
  });

  it('ignores empty slots when evaluating neighbors', () => {
    const r1 = makeRelic('r1', ['fire']);
    const board = makeBoard([
      { coord: { q: 0, r: 0 }, ownerId: 'p1', relicId: 'r1' },
      { coord: { q: 1, r: 0 }, ownerId: 'p2', relicId: null },
    ]);
    expect(evaluateSynergies(board, makeRegistry(r1))).toEqual({ r1: false });
  });

  it('handles 3-player board: only pairs with shared tags and different owners synergize', () => {
    const r1 = makeRelic('r1', ['fire']);       // p1
    const r2 = makeRelic('r2', ['fire', 'aoe']); // p2 — adjacent to r1 (fire match) and r3 (aoe match)
    const r3 = makeRelic('r3', ['aoe']);        // p3 — adjacent to r2
    const board = makeBoard([
      { coord: { q: 0, r: 0 }, ownerId: 'p1', relicId: 'r1' },
      { coord: { q: 1, r: 0 }, ownerId: 'p2', relicId: 'r2' },
      { coord: { q: 2, r: 0 }, ownerId: 'p3', relicId: 'r3' },
    ]);
    const result = evaluateSynergies(board, makeRegistry(r1, r2, r3));
    expect(result['r1']).toBe(true);  // fire matches r2's fire
    expect(result['r2']).toBe(true);  // fire matches r1, aoe matches r3
    expect(result['r3']).toBe(true);  // aoe matches r2's aoe
  });
});
