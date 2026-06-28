import { describe, it, expect } from 'vitest';
import type { DungeonLayout, Corridor } from '@testament/shared';
import { CORRIDOR_HALF_WIDTH } from '@testament/shared';
import { isWalkable, corridorRects, clampToWalkable } from './collision.js';

// Two rooms separated in both x and y, connected by an L-shaped corridor.
// Designed so that the wall-gap between the two rooms is clearly outside all
// corridor rects even at the wider CORRIDOR_HALF_WIDTH=20.
//
// room-0 [0,120]×[0,120], room-1 [240,360]×[240,360]
// corridor: from=(60,60) to=(300,300)
//   horiz rect: x=60..300, y=(60-hw)..(60+hw)
//   vert  rect: x=(300-hw)..(300+hw), y=60..300
function makeTestDungeon(): DungeonLayout {
  return {
    runId: 'test',
    width: 400,
    height: 400,
    rooms: [
      { id: 'room-0', rect: { x: 0,   y: 0,   width: 120, height: 120 } },
      { id: 'room-1', rect: { x: 240, y: 240, width: 120, height: 120 } },
    ],
    corridors: [{
      fromRoomId: 'room-0', toRoomId: 'room-1',
      from: { x: 60,  y: 60  }, // centre of room-0
      to:   { x: 300, y: 300 }, // centre of room-1
    }],
  };
}

// ─── corridorRects ─────────────────────────────────────────────────────────

describe('corridorRects (T1, R4)', () => {
  it('pure horizontal corridor produces one rect', () => {
    const c: Corridor = { fromRoomId: 'a', toRoomId: 'b', from: { x: 0, y: 60 }, to: { x: 200, y: 60 } };
    const rects = corridorRects(c);
    expect(rects).toHaveLength(1);
    expect(rects[0]!.width).toBe(200);
    expect(rects[0]!.height).toBe(CORRIDOR_HALF_WIDTH * 2);
  });

  it('pure vertical corridor produces one rect', () => {
    const c: Corridor = { fromRoomId: 'a', toRoomId: 'b', from: { x: 60, y: 0 }, to: { x: 60, y: 200 } };
    const rects = corridorRects(c);
    expect(rects).toHaveLength(1);
    expect(rects[0]!.width).toBe(CORRIDOR_HALF_WIDTH * 2);
    expect(rects[0]!.height).toBe(200);
  });

  it('diagonal (L-shape) corridor produces two rects', () => {
    const c: Corridor = { fromRoomId: 'a', toRoomId: 'b', from: { x: 60, y: 60 }, to: { x: 300, y: 300 } };
    const rects = corridorRects(c);
    expect(rects).toHaveLength(2);
  });

  it('horizontal rect spans the correct x range', () => {
    const c: Corridor = { fromRoomId: 'a', toRoomId: 'b', from: { x: 60, y: 60 }, to: { x: 300, y: 300 } };
    const [h] = corridorRects(c);
    expect(h!.x).toBe(60);
    expect(h!.x + h!.width).toBe(300);
  });

  it('vertical rect uses to.x as centre x', () => {
    const c: Corridor = { fromRoomId: 'a', toRoomId: 'b', from: { x: 60, y: 60 }, to: { x: 300, y: 300 } };
    const [, v] = corridorRects(c);
    expect(v!.x).toBe(300 - CORRIDOR_HALF_WIDTH);
    expect(v!.x + v!.width).toBe(300 + CORRIDOR_HALF_WIDTH);
  });
});

// ─── isWalkable ────────────────────────────────────────────────────────────

describe('isWalkable (T1, R4, P1)', () => {
  const dungeon = makeTestDungeon();
  // With hw=20: horiz rect x=60..300, y=40..80; vert rect x=280..320, y=60..300.

  it('returns true for a point inside room-0', () => {
    expect(isWalkable(60, 60, dungeon)).toBe(true);
  });

  it('returns true for a point inside room-1', () => {
    expect(isWalkable(300, 300, dungeon)).toBe(true);
  });

  it('returns false for a point in the wall gap between the two rooms', () => {
    // (180, 5): outside room-0 (x>120), outside room-1 (y<240),
    // outside horiz corridor (y=5 < 60-20=40), outside vert (x=180 < 300-20=280).
    expect(isWalkable(180, 5, dungeon)).toBe(false);
  });

  it('returns true for a point in the horizontal corridor segment', () => {
    // (180, 60): x=180 in [60,300], y=60 in [40,80]
    expect(isWalkable(180, 60, dungeon)).toBe(true);
  });

  it('returns true for a point in the vertical corridor segment', () => {
    // (300, 180): x=300 in [280,320], y=180 in [60,300]
    expect(isWalkable(300, 180, dungeon)).toBe(true);
  });

  it('returns false for a point outside the dungeon bounds entirely', () => {
    expect(isWalkable(500, 500, dungeon)).toBe(false);
  });

  it('is deterministic — same input always returns same result (P1)', () => {
    const a = isWalkable(60, 60, dungeon);
    const b = isWalkable(60, 60, dungeon);
    expect(a).toBe(b);
  });
});

// ─── clampToWalkable ───────────────────────────────────────────────────────

describe('clampToWalkable (T2, R1, P2)', () => {
  const dungeon = makeTestDungeon();
  const inside = { x: 60, y: 60 };       // inside room-0
  const inWall  = { x: 180, y: 5 };      // wall gap (confirmed false above)

  it('returns target if it is walkable', () => {
    const result = clampToWalkable(inside.x, inside.y, 90, 90, dungeon);
    expect(result).toEqual({ x: 90, y: 90 });
  });

  it('slides along Y when target x is blocked but (toX, fromY) is walkable', () => {
    // From (60,60), move to (180, 5) — in wall.
    // y-slide: (toX=180, fromY=60): horiz corridor x=60..300, y=40..80 → (180,60) ✓
    const result = clampToWalkable(inside.x, inside.y, inWall.x, inWall.y, dungeon);
    expect(result).toEqual({ x: 180, y: 60 });
  });

  it('result is always walkable when source is walkable (P2)', () => {
    const from = { x: 300, y: 300 }; // inside room-1
    const to   = { x: 180, y: 5  }; // wall gap
    const result = clampToWalkable(from.x, from.y, to.x, to.y, dungeon);
    expect(isWalkable(result.x, result.y, dungeon)).toBe(true);
  });

  it('returns source when fully blocked and source is walkable (P2)', () => {
    // Tiny dungeon with one small room; move entity off-grid.
    const smallDungeon: DungeonLayout = {
      runId: 't', width: 50, height: 50,
      rooms: [{ id: 'r0', rect: { x: 20, y: 20, width: 10, height: 10 } }],
      corridors: [],
    };
    const result = clampToWalkable(25, 25, -100, -100, smallDungeon);
    expect(result).toEqual({ x: 25, y: 25 });
  });

  it('allows movement when source is also in a wall (prevents permanent trap)', () => {
    // (180, 5) is in the wall. (181, 6) is also in the wall.
    // Since source is not walkable, escape is allowed unconditionally.
    const result = clampToWalkable(180, 5, 181, 6, dungeon);
    expect(result).toEqual({ x: 181, y: 6 });
  });
});
