# Body Collision — Requirements

## Functional Requirements

**R1** — As a server, entity radii and the design viewport height are exported from `@veins/shared`
so the server collision system and client rendering both reference one source of truth.
- AC: `PLAYER_RADIUS`, `ENEMY_RADIUS_SHAMBLER`, `ENEMY_RADIUS_SPITTER`, `DESIGN_VIEW_HEIGHT`
  are exported from `@veins/shared` and reachable by both `src/server/` and `src/client/`.
- AC: `CORRIDOR_HALF_WIDTH >= PLAYER_RADIUS` (already true; verified by assertion in tests).

**R2** — After all entity movement in a combat tick, overlapping entity pairs (player+enemy,
enemy+enemy) are pushed apart so no two bodies occupy the same space.
- AC: after `separateBodies` runs, for every non-exempt pair the Euclidean distance between
  their centres is >= their combined radii (within 0.01 tolerance).
- AC: shamblers with `ENEMY_RADIUS_SHAMBLER=12` fill a 40-unit corridor
  (two shamblers side-by-side have combined diameter 48 > 40, so only one can block the path).

**R3** — Player-to-player pairs are exempt from body separation.
- AC: two players whose circles overlap are NOT pushed apart by `separateBodies`.
- Reason: co-op teammates should be able to stand next to each other in tight corridors
  without fighting for position.

**R4** — Body separation never pushes an entity into a wall.
- AC: after each push, the entity's new position is verified walkable via `clampToWalkable`;
  if the pushed position is inside a wall, the entity is clamped back to its last walkable
  position instead of being pushed further.

**R5** — Body separation is position-only; it causes no damage and emits no events.
- AC: `separateBodies` modifies only `.x` and `.y` on `PlayerState` / `EnemyState` objects.
- AC: the function returns `void` and has no side effects beyond position mutation.

## Correctness Properties

**P1** — Determinism: given the same entity positions and dungeon, `separateBodies` produces
the same output every call (no random element, no timing dependency).

**P2** — Post-separation guarantee: for every non-exempt pair that was overlapping before the
call, distance(a, b) >= combinedRadii(a, b) - 0.01 after the call. (Single-pass; extreme
cluster scenarios may require the next tick to fully resolve, which is acceptable.)

**P3** — Wall safety: no entity ends a separation step inside a wall. `clampToWalkable` is
applied per-entity per-push to enforce this.
