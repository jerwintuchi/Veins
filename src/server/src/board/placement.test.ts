import { describe, it, expect } from 'vitest';
import type { Relic, RelicSlot, RelicTag, GamePhase } from '@veins/shared';
import { hexCoordKey } from '@veins/shared';
import { placeRelic } from './placement.js';

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

const LOOT: GamePhase = 'loot';
const COMBAT: GamePhase = 'combat';

// p1 owns slot (0,0); p2 owns slot (1,0). Both empty.
const emptyBoard = makeBoard([
  { coord: { q: 0, r: 0 }, ownerId: 'p1', relicId: null },
  { coord: { q: 1, r: 0 }, ownerId: 'p2', relicId: null },
]);

// ---

describe('placeRelic — happy path', () => {
  it('returns ok:true with updated board and RELIC_PLACED event on valid placement', () => {
    const r1 = makeRelic('r1', ['fire']);
    const result = placeRelic(emptyBoard, { coord: { q: 0, r: 0 }, relicId: 'r1' }, 'p1', LOOT, makeRegistry(r1));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.board.slots[hexCoordKey({ q: 0, r: 0 })]?.relicId).toBe('r1');
    expect(result.event.coord).toEqual({ q: 0, r: 0 });
    expect(result.event.relicId).toBe('r1');
    expect(result.event.ownerId).toBe('p1');
  });

  it('reports the slot true owner in the event, not a client claim', () => {
    const r1 = makeRelic('r1', ['fire']);
    // p2 places into their own slot (1,0)
    const result = placeRelic(emptyBoard, { coord: { q: 1, r: 0 }, relicId: 'r1' }, 'p2', LOOT, makeRegistry(r1));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.ownerId).toBe('p2');
  });

  it('does not mutate the original board', () => {
    const r1 = makeRelic('r1', ['fire']);
    const before = emptyBoard.slots[hexCoordKey({ q: 0, r: 0 })]?.relicId;
    placeRelic(emptyBoard, { coord: { q: 0, r: 0 }, relicId: 'r1' }, 'p1', LOOT, makeRegistry(r1));
    expect(emptyBoard.slots[hexCoordKey({ q: 0, r: 0 })]?.relicId).toBe(before);
  });

  it('synergyMap in event includes ALL relics on the board, not just the placed one', () => {
    const r1 = makeRelic('r1', ['fire']);
    const r2 = makeRelic('r2', ['fire']);

    // r2 already placed in p2's slot (1,0); p1 places r1 in their slot (0,0)
    const boardWithR2 = makeBoard([
      { coord: { q: 0, r: 0 }, ownerId: 'p1', relicId: null },
      { coord: { q: 1, r: 0 }, ownerId: 'p2', relicId: 'r2' },
    ]);

    const result = placeRelic(boardWithR2, { coord: { q: 0, r: 0 }, relicId: 'r1' }, 'p1', LOOT, makeRegistry(r1, r2));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.synergyMap['r1']).toBe(true);
    expect(result.event.synergyMap['r2']).toBe(true);
  });
});

describe('placeRelic — error paths (no state mutation)', () => {
  it('returns WRONG_PHASE when phase is combat', () => {
    const result = placeRelic(emptyBoard, { coord: { q: 0, r: 0 }, relicId: 'r1' }, 'p1', COMBAT, new Map());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('WRONG_PHASE');
  });

  it('returns WRONG_PHASE when phase is transition', () => {
    const result = placeRelic(emptyBoard, { coord: { q: 0, r: 0 }, relicId: 'r1' }, 'p1', 'transition', new Map());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('WRONG_PHASE');
  });

  it('returns INVALID_COORD when coord is not on the board', () => {
    const result = placeRelic(emptyBoard, { coord: { q: 99, r: 99 }, relicId: 'r1' }, 'p1', LOOT, new Map());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_COORD');
  });

  it('returns NOT_OWNER when placing into another player slot', () => {
    // p1 tries to place into p2's slot (1,0)
    const result = placeRelic(emptyBoard, { coord: { q: 1, r: 0 }, relicId: 'r1' }, 'p1', LOOT, new Map());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOT_OWNER');
  });

  it('returns SLOT_OCCUPIED when own slot already has a relic', () => {
    const boardWithRelic = makeBoard([{ coord: { q: 0, r: 0 }, ownerId: 'p1', relicId: 'r_existing' }]);
    const result = placeRelic(boardWithRelic, { coord: { q: 0, r: 0 }, relicId: 'r_new' }, 'p1', LOOT, new Map());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('SLOT_OCCUPIED');
  });

  it('does not mutate board on NOT_OWNER', () => {
    const snapshot = JSON.stringify(emptyBoard);
    placeRelic(emptyBoard, { coord: { q: 1, r: 0 }, relicId: 'r1' }, 'p1', LOOT, new Map());
    expect(JSON.stringify(emptyBoard)).toBe(snapshot);
  });

  it('does not mutate board on WRONG_PHASE', () => {
    const snapshot = JSON.stringify(emptyBoard);
    placeRelic(emptyBoard, { coord: { q: 0, r: 0 }, relicId: 'r1' }, 'p1', COMBAT, new Map());
    expect(JSON.stringify(emptyBoard)).toBe(snapshot);
  });

  it('does not mutate board on INVALID_COORD', () => {
    const snapshot = JSON.stringify(emptyBoard);
    placeRelic(emptyBoard, { coord: { q: 99, r: 99 }, relicId: 'r1' }, 'p1', LOOT, new Map());
    expect(JSON.stringify(emptyBoard)).toBe(snapshot);
  });

  it('does not mutate board on SLOT_OCCUPIED', () => {
    const boardWithRelic = makeBoard([{ coord: { q: 0, r: 0 }, ownerId: 'p1', relicId: 'r_existing' }]);
    const snapshot = JSON.stringify(boardWithRelic);
    placeRelic(boardWithRelic, { coord: { q: 0, r: 0 }, relicId: 'r_new' }, 'p1', LOOT, new Map());
    expect(JSON.stringify(boardWithRelic)).toBe(snapshot);
  });
});
