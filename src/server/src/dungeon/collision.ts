import type { DungeonLayout, Corridor } from '@testament/shared';
import { CORRIDOR_HALF_WIDTH } from '@testament/shared';

type Rect = { x: number; y: number; width: number; height: number };

function pointInRect(x: number, y: number, r: Rect): boolean {
  return x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;
}

// Decomposes a corridor's L-shape into axis-aligned rectangles.
// Horizontal segment first (from.y), then vertical segment (at to.x).
// Segments with zero length are omitted.
export function corridorRects(c: Corridor): Rect[] {
  const hw = CORRIDOR_HALF_WIDTH;
  const rects: Rect[] = [];
  const dw = Math.abs(c.to.x - c.from.x);
  const dh = Math.abs(c.to.y - c.from.y);
  if (dw > 0) {
    rects.push({ x: Math.min(c.from.x, c.to.x), y: c.from.y - hw, width: dw, height: hw * 2 });
  }
  if (dh > 0) {
    rects.push({ x: c.to.x - hw, y: Math.min(c.from.y, c.to.y), width: hw * 2, height: dh });
  }
  return rects;
}

// Pure predicate — true if (x, y) is inside any room or corridor segment.
export function isWalkable(x: number, y: number, dungeon: DungeonLayout): boolean {
  for (const room of dungeon.rooms) {
    if (pointInRect(x, y, room.rect)) return true;
  }
  for (const corridor of dungeon.corridors) {
    for (const rect of corridorRects(corridor)) {
      if (pointInRect(x, y, rect)) return true;
    }
  }
  return false;
}

// Wall-slide movement clamp. Tries the full move, then each axis slide.
// If the source is itself in a wall (synthetic/test position), allows the move
// unconditionally to avoid permanently trapping the entity.
export function clampToWalkable(
  fromX: number, fromY: number,
  toX: number, toY: number,
  dungeon: DungeonLayout,
): { x: number; y: number } {
  if (isWalkable(toX, toY, dungeon)) return { x: toX, y: toY };
  if (isWalkable(toX, fromY, dungeon)) return { x: toX, y: fromY };
  if (isWalkable(fromX, toY, dungeon)) return { x: fromX, y: toY };
  if (!isWalkable(fromX, fromY, dungeon)) return { x: toX, y: toY };
  return { x: fromX, y: fromY };
}
