# Collision + Pathfinding — Tasks

- [x] T1 [R4, P1] — Implement `isWalkable` and `corridorRects` in `src/server/src/dungeon/collision.ts`
  Test: `collision.test.ts` — room interior → true; wall → false; corridor h/v segments → true; P1 determinism

- [x] T2 [R1, P2] — Implement `clampToWalkable` in `src/server/src/dungeon/collision.ts`
  Test: `collision.test.ts` — walkable target; y-slide; x-slide; fully blocked (source walkable → stay); fully blocked (source in wall → allow)

- [x] T3 [R1] — Update `movePlayer` in `movement.ts` to use `clampToWalkable` instead of Math.max/min bounds
  Test: `movement.test.ts` — update dungeon to flat-room for AI tests; add wall-blocked test

- [x] T4 [R2] — Update `stepProjectiles` in `weapon.ts` to remove projectiles that enter non-walkable area
  Test: `weapon.test.ts` — add: projectile aimed at wall terminates before reaching enemy behind it

- [x] T5 [R3, P3] — Implement `findNextWaypoint` A* in `src/server/src/dungeon/pathfinding.ts`
  Test: `pathfinding.test.ts` — same tile → null; adjacent tile → that tile; two-room dungeon → corridor waypoint; no path → null; P3 termination

- [x] T6 [R3] — Update `tickEnemies` in `tick.ts` to use `findNextWaypoint` with direct-chase fallback + `clampToWalkable`
  Test: `tick.test.ts` — update dungeon to flat-room; add: enemy in room-A paths to player in room-B via corridor
