# Collision + Pathfinding — Requirements

## R1 — Player wall collision
As a player, when I move into a dungeon wall, my movement is blocked by that wall.
Sliding along the wall perpendicular to the blocked axis is still possible (wall-slide).

- AC: `movePlayer` with a direction that ends inside a wall returns a position on the wall boundary, not past it
- AC: Diagonal movement into a wall corner slides the player along the unblocked axis
- AC: Moving into a fully-blocked corner (both axes blocked) returns the current position unchanged

## R2 — Projectile wall termination
As a server, when a projectile travels into a non-walkable area (wall), it is immediately removed.

- AC: `stepProjectiles` removes a projectile and emits a no-hit `PROJECTILE_REMOVED` when the projectile enters a wall
- AC: Projectiles already in walkable area continue to travel normally

## R3 — Enemy A* pathfinding
As an enemy, I navigate toward the player using A* on the dungeon tile grid, routing around walls.

- AC: An enemy in one room, with a player in an adjacent room, moves in the direction of the connecting corridor (not straight through the wall)
- AC: If no path exists to the player, the enemy does not move (or falls back to direct movement)
- AC: `findNextWaypoint` returns null when start and goal are in the same tile

## R4 — Walkable area definition
The server defines walkable area as the union of all room rectangles and all corridor L-shaped rectangle pairs.

- AC: `isWalkable(x, y, dungeon)` returns true for a point inside any room rect
- AC: `isWalkable` returns true for a point inside a corridor's horizontal or vertical segment rect
- AC: `isWalkable` returns false for a point outside all rooms and all corridor rects

## Correctness Properties

**P1** — `isWalkable` is a pure function: same dungeon + same point → same result, always.
**P2** — `clampToWalkable` never moves an entity into a non-walkable area when the source is walkable.
**P3** — `findNextWaypoint` always terminates (MAX_ITERATIONS guard); never throws.
