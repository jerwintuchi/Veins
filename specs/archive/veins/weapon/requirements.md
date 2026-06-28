# Requirements — Weapon / Attack System

Players attack automatically. The server fires a projectile from each alive,
non-downed player every `WEAPON_COOLDOWN_MS` milliseconds during combat. The
projectile travels toward the player's current aim target (auto mode) or their
stored aim direction (manual mode). This closes the deferred `ENEMY_DAMAGED`
emission path from the Enemy Combat spec and the `move-player` rate-limiting
exploit documented in the DECISION_LOG.

Out of scope: multiple weapon types, per-relic damage modifiers (weapon spec),
area-of-effect projectiles (relic synergy spec), hit-stun or knockback.

---

**R1**: The shared layer exports `ProjectileState` and weapon constants so both
server logic and client rendering have a single source of truth.
- AC: `ProjectileState` is defined in `src/shared/src/combat.ts` as
  `{ id: string; ownerId: string; x: number; y: number; dx: number; dy: number; distanceTravelled: number }`
- AC: Constants exported from the same file: `WEAPON_COOLDOWN_MS = 500`,
  `PROJECTILE_SPEED = 400`, `PROJECTILE_DAMAGE = 20`, `PROJECTILE_HIT_RADIUS = 20`,
  `PROJECTILE_MAX_RANGE = 600`
- AC: All new symbols exported from `src/shared/src/index.ts`

**R2**: Three delta events are added to the shared event catalog.
- AC: `ProjectileFiredEvent = { projectileId: string; playerId: string; x: number; y: number; dx: number; dy: number }` in `src/shared/src/events.ts`
- AC: `ProjectileRemovedEvent = { projectileId: string; reason: 'hit' | 'range' }` in `src/shared/src/events.ts`
- AC: `EnemyMovedEvent = { enemyId: string; x: number; y: number }` in `src/shared/src/events.ts`
- AC: All three exported from `src/shared/src/index.ts`

**R3**: `Room` tracks active projectiles, per-player weapon cooldowns, and
stored player move-direction inputs.
- AC: `Room.projectiles: Map<string, ProjectileState>` (added to `src/server/src/room/state.ts`)
- AC: `Room.weaponCooldowns: Map<PlayerId, number>` — milliseconds remaining until next shot per player; starts at 0 so each player fires immediately on their first eligible tick
- AC: `Room.playerMoveInputs: Map<PlayerId, { dx: number; dy: number }>` — latest direction from `move-player`; starts at `{ dx: 0, dy: 0 }` for every player
- AC: All three maps initialised in `RoomManager.startRun` alongside the existing `aimStates` init

**R4**: The `move-player` handler stores the direction vector instead of applying
movement immediately, closing the event-flood speed exploit.
- AC: The `move-player` handler in `src/server/src/index.ts` no longer calls
  `movePlayer`; it only validates the payload and updates
  `room.playerMoveInputs.set(playerId, { dx, dy })`
- AC: `runCombatTick` moves each alive player using their stored input:
  `movePlayer(ps, inputs.dx, inputs.dy, COMBAT_TICK_MS/1000, dungeon)`, regardless
  of how many `move-player` events arrived between ticks
- AC: `PLAYER_MOVED` is emitted once per tick per player (not per `move-player` event)

**R5**: The server auto-fires one projectile per eligible player each
`WEAPON_COOLDOWN_MS` interval during the combat tick.
- AC: `tryAutoFire` in `src/server/src/combat/weapon.ts` accepts `(room, playerId, dt)` and:
  - decrements `room.weaponCooldowns.get(playerId)` by `dt * 1000`
  - if cooldown <= 0 and player is alive and not downed: fires a projectile, resets cooldown to `WEAPON_COOLDOWN_MS`
  - returns the `ProjectileState` created, or `null` if no shot was fired
- AC: Aim direction resolved from `room.aimStates.get(playerId)`:
  - `mode: 'auto'` + `targetId != null`: normalize vector from player pos to enemy pos
  - `mode: 'auto'` + `targetId == null`: no shot (returns `null`)
  - `mode: 'manual'`: use stored `(dx, dy)` directly (already normalized)
- AC: Each projectile gets a unique id: `proj-${room.nextProjectileId++}` (Room gains `nextProjectileId: number` initialised to 0)
- AC: `tryAutoFire` is a pure-ish function — no I/O; callers emit events after collecting results

**R6**: Each combat tick, all active projectiles advance and are checked for
collisions.
- AC: `stepProjectiles(room, dt)` in `src/server/src/combat/weapon.ts` advances
  each projectile by `(dx * PROJECTILE_SPEED * dt, dy * PROJECTILE_SPEED * dt)` and
  increments `distanceTravelled` by the same magnitude
- AC: After advancing, for each alive enemy within `PROJECTILE_HIT_RADIUS` of the
  projectile: enemy `hp` is decremented by `PROJECTILE_DAMAGE` (minimum 0),
  `downed` is set to `false` (enemies don't down, they die), the projectile is
  removed from `room.projectiles`, and the result carries `{ hit: true, enemyId, newHp }`
- AC: A projectile whose `distanceTravelled > PROJECTILE_MAX_RANGE` is removed and
  carries `{ hit: false }`
- AC: `stepProjectiles` returns an array of `{ projectileId, hit: boolean, enemyId?: string, newHp?: number }`
  for each removed projectile; callers emit the appropriate events
- AC: Does not mutate `enemies` beyond hp; does not kill enemies (hp reaching 0 is
  handled by the existing `stepCombat` result processing)

**R7**: Projectile lifecycle events are broadcast as deltas.
- AC: When `tryAutoFire` fires a shot, `PROJECTILE_FIRED` is emitted to the room with
  `{ projectileId, playerId, x, y, dx, dy }`
- AC: When `stepProjectiles` reports a hit, `ENEMY_DAMAGED { enemyId, hp: newHp }` and
  `PROJECTILE_REMOVED { projectileId, reason: 'hit' }` are emitted to the room
- AC: When a projectile expires by range, `PROJECTILE_REMOVED { projectileId, reason: 'range' }`
  is emitted (no `ENEMY_DAMAGED`)
- AC: All emissions happen in `runCombatTick` after collecting results from the pure functions

**R8**: After `stepCombat` runs each tick, all alive enemies broadcast their
current position.
- AC: `runCombatTick` emits `ENEMY_MOVED { enemyId, x, y }` for every alive enemy
  after `stepCombat` completes
- AC: Dead enemies (`enemy.alive === false`) are not included
- AC: This gives clients up-to-date positions for auto-aim ring placement and
  collision feedback without a full state resync

**R9**: Client `GameScene` renders projectiles and tracks live enemy positions.
- AC: `GameScene.spawnProjectile(id, x, y, dx, dy)` creates a small white circle
  (radius 4) at `(x, y)` and stores it in a `projectiles: Map<string, ...>` field
- AC: `GameScene.removeProjectile(id)` destroys the circle and removes the map entry
- AC: `GameScene.moveEnemy(id, x, y)` updates the position of the enemy rectangle
  and HP bar origin for enemy `id`; no-ops if enemy is not in the scene map
- AC: `GameScene.bindSocketEvents` wires `PROJECTILE_FIRED` → `spawnProjectile`,
  `PROJECTILE_REMOVED` → `removeProjectile`, `ENEMY_MOVED` → `moveEnemy`
