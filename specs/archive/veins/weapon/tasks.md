# Tasks — Weapon / Attack System

Order: shared types first, then room state extension, then server pure functions
(weapon.ts), then index.ts wiring (move-player fix + tick integration), then
client rendering additions.

---

- [x] T1 [R1, R2] — Add `ProjectileState`, weapon constants, and three new events
  to shared; export from index.
  Test: `src/shared/src/combat.test.ts` (extended) + `src/shared/src/events.test.ts` (extended)
  - `ProjectileState` compiles under strict mode with all seven fields
  - `WEAPON_COOLDOWN_MS`, `PROJECTILE_SPEED`, `PROJECTILE_DAMAGE`, `PROJECTILE_HIT_RADIUS`,
    `PROJECTILE_MAX_RANGE` exported and are numbers
  - `ProjectileFiredEvent`, `ProjectileRemovedEvent`, `EnemyMovedEvent` compile
  - existing exports still compile (no regressions)

- [x] T2 [R3] — Add `projectiles`, `weaponCooldowns`, `playerMoveInputs`, and
  `nextProjectileId` to `Room`; initialise in `RoomManager.startRun`.
  Test: `src/server/src/room/state.test.ts` (extended) + `src/server/src/room/manager.test.ts` (extended)
  - a freshly started room has `projectiles` as an empty Map
  - `weaponCooldowns` has one entry per player, all starting at 0
  - `playerMoveInputs` has one entry per player, all starting at `{dx:0, dy:0}`
  - `nextProjectileId` starts at 0
  - existing Room fields unchanged (no regressions)

- [x] T3 [R1, R2] — Implement `tryAutoFire` and `stepProjectiles` in
  `src/server/src/combat/weapon.ts`.
  Test: `src/server/src/combat/weapon.test.ts` (new)
  - `tryAutoFire` returns null when player is downed
  - `tryAutoFire` returns null when cooldown > 0
  - `tryAutoFire` returns null when mode is auto and targetId is null
  - `tryAutoFire` fires toward the auto-aim target (normalized direction)
  - `tryAutoFire` fires in the stored manual direction
  - `tryAutoFire` resets cooldown to `WEAPON_COOLDOWN_MS` after firing
  - `tryAutoFire` assigns a unique id using `room.nextProjectileId`
  - `stepProjectiles` advances projectile position by `PROJECTILE_SPEED * dt`
  - `stepProjectiles` returns hit result when projectile reaches within `PROJECTILE_HIT_RADIUS`
  - `stepProjectiles` returns range result when `distanceTravelled > PROJECTILE_MAX_RANGE`
  - `stepProjectiles` does not hit dead enemies
  - `stepProjectiles` does not decrement enemy hp below 0

- [x] T4 [R4, P2] — Fix `move-player` handler to store direction; move player
  movement into `runCombatTick`.
  Test: `src/server/src/index.test.ts` (extended)
  - after `move-player { dx: 1, dy: 0 }`, no `PLAYER_MOVED` is emitted immediately
  - after the next `runCombatTick`, `PLAYER_MOVED` is emitted with x advanced by
    `PLAYER_SPEED × COMBAT_TICK_MS/1000`
  - sending 10 `move-player` events between ticks results in exactly one `PLAYER_MOVED`
    per tick (not 10 movements per tick)

- [x] T5 [R5, R6, R7, P1, P3, P4] — Wire `tryAutoFire`, `stepProjectiles`, and
  `ENEMY_MOVED` into `runCombatTick`.
  Test: `src/server/src/combat/tickLoop.test.ts` (extended)
  - after one tick with a player in auto-aim targeting an enemy within range, a
    `PROJECTILE_FIRED` event is emitted with correct position and direction
  - after the projectile reaches the enemy (simulated over multiple ticks or by
    placing it within hit radius), `ENEMY_DAMAGED` and `PROJECTILE_REMOVED (reason: 'hit')` are emitted
  - after a projectile exceeds `PROJECTILE_MAX_RANGE`, `PROJECTILE_REMOVED (reason: 'range')`
    is emitted (no `ENEMY_DAMAGED`)
  - a player in manual mode (no target) fires in their stored manual direction
  - `ENEMY_MOVED` is emitted for every alive enemy after each tick
  - dead enemies are not included in `ENEMY_MOVED`

- [x] T6 [R9, P5] — Add `spawnProjectile`, `removeProjectile`, and `moveEnemy`
  to `GameScene`; wire `PROJECTILE_FIRED`, `PROJECTILE_REMOVED`, `ENEMY_MOVED` in
  `bindSocketEvents`.
  Test: `src/client/src/game/GameScene.test.ts` (extended)
  - `spawnProjectile` creates a circle stored in `projectiles` map
  - `removeProjectile` destroys the circle and removes the map entry
  - `moveEnemy` updates the enemy rect and HP bar position
  - `moveEnemy` for an unknown id is a no-op (does not throw)
