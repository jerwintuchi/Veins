# Body Collision — Tasks

All tasks must satisfy the chain: R# cited → test named → implementation → mark done.

---

- [ ] T1 [R1] — Add `PLAYER_RADIUS`, `ENEMY_RADIUS_SHAMBLER`, `ENEMY_RADIUS_SPITTER` to
  `src/shared/src/combat.ts`; add `DESIGN_VIEW_HEIGHT` to `src/shared/src/dungeon.ts`.
  Test: `src/shared/src/combat.test.ts` — constants exported, positive, and
  `CORRIDOR_HALF_WIDTH * 2 >= PLAYER_RADIUS * 2`.

- [ ] T2 [R2, R3, R4, R5, P1, P2, P3] — Implement `separateBodies` in
  `src/server/src/combat/separation.ts`.
  Test: `src/server/src/combat/separation.test.ts`
  - overlapping player+enemy pair: after call, dist >= PLAYER_RADIUS + ENEMY_RADIUS_SHAMBLER
  - overlapping enemy+enemy pair: after call, dist >= combined radii
  - overlapping player+player pair: positions UNCHANGED (R3)
  - pushed position against wall: result is walkable (R4, P3)
  - coincident entities (dist=0): no throw, positions differ after call
  - determinism: two calls with same input → same output (P1)

- [ ] T3 [R2] — Call `separateBodies` at end of `tickEnemies` in
  `src/server/src/combat/tick.ts`.
  Test: `src/server/src/combat/tick.test.ts` addition — after one tick where an enemy
  starts overlapping a player (dist < combined radii), post-tick distance >= combined radii.

- [ ] T4 [R1] — Remove local `PLAYER_RADIUS`, `ENEMY_SIZE_SHAMBLER`, `ENEMY_SIZE_SPITTER`
  consts from `src/client/src/game/GameScene.ts`; import `PLAYER_RADIUS`,
  `ENEMY_RADIUS_SHAMBLER`, `ENEMY_RADIUS_SPITTER`, `DESIGN_VIEW_HEIGHT` from `@veins/shared`;
  replace fixed `setZoom(3)` with dynamic `this.scale.height / DESIGN_VIEW_HEIGHT`; add
  resize listener.
  Test: `src/client/src/game/GameScene.test.ts` — `setZoom` called with
  `mockScale.height / DESIGN_VIEW_HEIGHT` (not the hardcoded value 3).
