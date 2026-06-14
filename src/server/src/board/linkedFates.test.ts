import { describe, it, expect } from 'vitest';
import type { Relic, RelicSlot, RelicTag } from '@veins/shared';
import { hexCoordKey } from '@veins/shared';
import { reviveWithLinkedFates } from './linkedFates.js';

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

// Reviver p1 holds a relic at (0,0); downed teammate p2 has an empty slot at (1,0).
const baseBoard = makeBoard([
  { coord: { q: 0, r: 0 }, ownerId: 'p1', relicId: 'r1' },
  { coord: { q: 1, r: 0 }, ownerId: 'p2', relicId: null },
]);

const validRequest = {
  reviverId: 'p1',
  sourceCoord: { q: 0, r: 0 },
  targetCoord: { q: 1, r: 0 },
};

// ---

describe('reviveWithLinkedFates — happy path', () => {
  it('emits RELIC_REMOVED before RELIC_PLACED', () => {
    const result = reviveWithLinkedFates(baseBoard, validRequest, makeRegistry(makeRelic('r1', ['fire'])));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.events[0].type).toBe('RELIC_REMOVED');
    expect(result.events[1].type).toBe('RELIC_PLACED');
    expect(result.events[0].payload.reason).toBe('linked-fates');
  });

  it('removes the sacrificed relic from the reviver slot', () => {
    const result = reviveWithLinkedFates(baseBoard, validRequest, makeRegistry(makeRelic('r1', ['fire'])));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.board.slots[hexCoordKey({ q: 0, r: 0 })]?.relicId).toBe(null);
  });

  it('places the sacrificed relic into the downed teammate slot', () => {
    const result = reviveWithLinkedFates(baseBoard, validRequest, makeRegistry(makeRelic('r1', ['fire'])));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const target = result.board.slots[hexCoordKey({ q: 1, r: 0 })];
    expect(target?.relicId).toBe('r1');
    expect(target?.ownerId).toBe('p2'); // slot ownership unchanged; relic now belongs to p2's slot
  });

  it('RELIC_PLACED event reports the downed teammate as the new owner', () => {
    const result = reviveWithLinkedFates(baseBoard, validRequest, makeRegistry(makeRelic('r1', ['fire'])));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events[1].payload.ownerId).toBe('p2');
    expect(result.events[1].payload.relicId).toBe('r1');
  });

  it('re-evaluates synergy on the post-transfer board and includes it in RELIC_PLACED', () => {
    // After transfer: r1 (fire, p2's slot at 1,0) is adjacent to r2 (fire, p3 at 2,0) -> synergy.
    const board = makeBoard([
      { coord: { q: 0, r: 0 }, ownerId: 'p1', relicId: 'r1' },
      { coord: { q: 1, r: 0 }, ownerId: 'p2', relicId: null },
      { coord: { q: 2, r: 0 }, ownerId: 'p3', relicId: 'r2' },
    ]);
    const result = reviveWithLinkedFates(
      board,
      { reviverId: 'p1', sourceCoord: { q: 0, r: 0 }, targetCoord: { q: 1, r: 0 } },
      makeRegistry(makeRelic('r1', ['fire']), makeRelic('r2', ['fire']))
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events[1].payload.synergyMap['r1']).toBe(true);
    expect(result.events[1].payload.synergyMap['r2']).toBe(true);
  });

  it('does not mutate the original board', () => {
    const snapshot = JSON.stringify(baseBoard);
    reviveWithLinkedFates(baseBoard, validRequest, makeRegistry(makeRelic('r1', ['fire'])));
    expect(JSON.stringify(baseBoard)).toBe(snapshot);
  });
});

describe('reviveWithLinkedFates — error paths (no state mutation)', () => {
  it('rejects when the reviver slot has no relic (player with no relic to sacrifice)', () => {
    const board = makeBoard([
      { coord: { q: 0, r: 0 }, ownerId: 'p1', relicId: null },
      { coord: { q: 1, r: 0 }, ownerId: 'p2', relicId: null },
    ]);
    const result = reviveWithLinkedFates(board, validRequest, new Map());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NO_RELIC');
  });

  it('rejects when the reviver does not own the source slot', () => {
    const result = reviveWithLinkedFates(
      baseBoard,
      { reviverId: 'p_impostor', sourceCoord: { q: 0, r: 0 }, targetCoord: { q: 1, r: 0 } },
      makeRegistry(makeRelic('r1', ['fire']))
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOT_OWNER');
  });

  it('rejects when source coord is not on the board', () => {
    const result = reviveWithLinkedFates(
      baseBoard,
      { reviverId: 'p1', sourceCoord: { q: 9, r: 9 }, targetCoord: { q: 1, r: 0 } },
      new Map()
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_COORD');
  });

  it('rejects when target coord is not on the board', () => {
    const result = reviveWithLinkedFates(
      baseBoard,
      { reviverId: 'p1', sourceCoord: { q: 0, r: 0 }, targetCoord: { q: 9, r: 9 } },
      new Map()
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_COORD');
  });

  it('rejects when the target slot is already occupied', () => {
    const board = makeBoard([
      { coord: { q: 0, r: 0 }, ownerId: 'p1', relicId: 'r1' },
      { coord: { q: 1, r: 0 }, ownerId: 'p2', relicId: 'r_existing' },
    ]);
    const result = reviveWithLinkedFates(board, validRequest, makeRegistry(makeRelic('r1', ['fire'])));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('SLOT_OCCUPIED');
  });

  it('does not mutate the board on a NO_RELIC failure', () => {
    const board = makeBoard([
      { coord: { q: 0, r: 0 }, ownerId: 'p1', relicId: null },
      { coord: { q: 1, r: 0 }, ownerId: 'p2', relicId: null },
    ]);
    const snapshot = JSON.stringify(board);
    reviveWithLinkedFates(board, validRequest, new Map());
    expect(JSON.stringify(board)).toBe(snapshot);
  });
});
