# Collision + Pathfinding — Design

## Types (all from @veins/shared)
```
DungeonLayout { rooms: DungeonRoom[], corridors: Corridor[], width, height, runId }
DungeonRoom   { id, rect: Rect }
Corridor      { fromRoomId, toRoomId, from: Point, to: Point }
Rect          { x, y, width, height }
Point         { x, y }
```

## Walkable Area

Walkable area = union of:
1. Each `DungeonRoom.rect` (inclusive bounds: `x >= rect.x && x <= rect.x + rect.width`)
2. Each `Corridor`'s L-shaped pair of rectangles (see below)

### Corridor L-Shape

Corridors connect two room centers with an L-shaped path: first horizontal, then vertical.
Each segment is `CORRIDOR_WIDTH = 2` tiles wide (`CORRIDOR_HALF_WIDTH = 1`).

```
corridorRects(c: Corridor): Rect[]
  horizontal segment: { x: min(c.from.x, c.to.x),  y: c.from.y - 1,  width: |Δx|, height: 2 }
  vertical segment:   { x: c.to.x - 1,  y: min(c.from.y, c.to.y),  width: 2,  height: |Δy| }
  (omit a segment if its corresponding Δ is 0)
```

## Pure Functions — `src/server/src/dungeon/collision.ts`

### `isWalkable(x, y, dungeon)`
Pure predicate. Returns true if (x,y) falls inside any room rect or corridor rect.

### `clampToWalkable(fromX, fromY, toX, toY, dungeon)`
Wall-slide movement clamp. Priority:
1. If (toX, toY) walkable → return it
2. If (toX, fromY) walkable → slide along Y-axis
3. If (fromX, toY) walkable → slide along X-axis
4. If source itself is in a wall → allow movement (prevents permanently trapped entities)
5. Fully blocked → return (fromX, fromY)

## A* Pathfinding — `src/server/src/dungeon/pathfinding.ts`

### `findNextWaypoint(startX, startY, goalX, goalY, dungeon)`
Returns the centre of the first tile step toward `goal`, or `null` if:
- start and goal are in the same tile (`Math.floor` quantization)
- no path exists (unreachable or MAX_ITERATIONS exceeded)

**Algorithm:**
- Quantize positions to integer tiles via `Math.floor`
- A* with Manhattan-distance heuristic on a 4-directional grid
- Walkability of each tile checked via `isWalkable(tx + 0.5, ty + 0.5, dungeon)` (tile centre)
- Start tile added to open set unconditionally (even if in a wall) so entities starting in walls can still path
- Path reconstruction: trace `parent` map from goal to start; return centre of first step tile
- `MAX_ITERATIONS = 2000` hard guard

## Integration

### `movement.ts`
Replace `Math.max/min` bounds clamp with `clampToWalkable`. Same signature.

### `weapon.ts → stepProjectiles`
After advancing projectile position, before enemy collision:
```
if (room.dungeon && !isWalkable(proj.x, proj.y, room.dungeon)) → remove, push hit:false result
```

### `tick.ts → tickEnemies`
Activate `dungeon` parameter (was `_dungeon`). In the movement branch:
```
waypoint = findNextWaypoint(enemy.x, enemy.y, nearest.x, nearest.y, dungeon) ?? nearest (direct fallback)
move toward waypoint centre, then clamp with clampToWalkable
```

## Socket Events
No new events. All changes are server-internal.

## Invariants
- I1: server-only. Collision + pathfinding are purely server-side.
- I4: no logic added to shared. `DungeonLayout` type unchanged.
