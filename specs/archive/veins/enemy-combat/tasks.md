# Tasks — Enemy System + Combat

Order: shared types and constants first, then pure server functions (spawn, tick,
movement), then room integration (stepCombat, wipe, phase transition), then socket
wiring (move-player, revive phase guard, combat tick loop, spawn on descend).

---

- [x] T1 [R1, R2] — Add `EnemyTypeDef`, `EnemyTypeId`, `ENEMY_TYPES`, `SHAMBLER_DEF`,
  `SPITTER_DEF`, `PlayerState`, and `PLAYER_MAX_HP` to `src/shared/src/combat.ts`;
  export from `src/shared/src/index.ts`.
  Test: `src/shared/src/combat.test.ts`
  - `ENEMY_TYPES` contains entries for `'shambler'` and `'spitter'`
  - Shambler `speed` is strictly less than Spitter `speed`
  - Spitter `attackRange` is strictly greater than Shambler `attackRange`
  - `PlayerState` type compiles under strict mode with `hp`, `maxHp`, `downed`, `x`, `y`
  - `PLAYER_MAX_HP` is a positive number

- [x] T2 [R10] — Add `EnemySpawnedEvent`, `EnemyDamagedEvent`, `EnemyDiedEvent`,
  `PlayerDamagedEvent`, `PlayerDownedEvent`, `PlayerRevivedEvent`, `PlayerMovedEvent`,
  and `PhaseChangedEvent` to `src/shared/src/events.ts`; export from index.
  Test: `src/shared/src/events.test.ts` (extended or new)
  - each event type compiles under strict mode
  - `EnemySpawnedEvent` carries `enemyId`, `typeId`, `x`, `y`, `hp`
  - `PhaseChangedEvent` carries `phase` typed as `GamePhase`

- [x] T3 [R9] — Define `EnemyId`, `EnemyState`, and `CombatEvent` in
  `src/server/src/combat/types.ts`.
  Test: `src/server/src/combat/types.test.ts`
  - types compile under strict mode
  - `EnemyState` has `id`, `typeId`, `x`, `y`, `hp`, `maxHp`, `alive`,
    `attackCooldownRemaining`
  - `CombatEvent` has `kind: 'attack'`, `enemyId`, `targetId`, `damage`

- [x] T4 [R2] — Extend `Room` in `src/server/src/room/state.ts` to add
  `enemies: Map<EnemyId, EnemyState>` and `playerStates: Map<PlayerId, PlayerState>`.
  Test: `src/server/src/room/state.test.ts` (extended)
  - a freshly constructed room has an empty `enemies` map
  - a freshly constructed room has a `playerStates` map with one entry per player,
    each with `hp === maxHp` and `downed === false`

- [x] T5 [R3, P1] — Implement `spawnEnemies(runId, floor, dungeon)` in
  `src/server/src/combat/spawn.ts`.
  Test: `src/server/src/combat/spawn.test.ts`
  - same `(runId, floor, dungeon)` inputs produce deeply-equal maps (determinism)
  - different floors of the same `runId` produce different maps (enemy count or
    positions differ)
  - all spawned enemy positions fall within the bounds of some dungeon room
    (not in corridors, not outside dungeon width/height)
  - every spawned enemy has `alive === true` and `hp === maxHp`
  - no `Math.random()` is called (spy/replace it in the test; call must not occur)

- [x] T6 [R4, P2] — Implement `tickEnemies(enemies, players, dungeon, dt)` and the
  `findNearest` helper in `src/server/src/combat/tick.ts`.
  Test: `src/server/src/combat/tick.test.ts`
  - same inputs produce deeply-equal outputs (determinism / P2)
  - an enemy with no active players within `detectionRange` does not change position
  - an enemy within `detectionRange` but outside `attackRange` moves toward nearest
    active player by at most `speed * dt` units; position changes by the correct
    vector direction
  - an enemy within `attackRange` with cooldown at 0 generates a `CombatEvent`
    attack and resets `attackCooldownRemaining` to `def.attackCooldown`
  - an enemy within `attackRange` with `attackCooldownRemaining > 0` does NOT
    generate an attack event; cooldown ticks down by `dt`
  - downed players are excluded from targeting (nearest-search skips them)
  - input maps are not mutated (reference check on original values)

- [x] T7 [R5, P2] — Implement `applyEnemyAttacks(players, combatEvents)` in
  `src/server/src/combat/tick.ts`.
  Test: `src/server/src/combat/tick.test.ts` (same file, extended)
  - player HP is reduced by `damage`, clamped to 0
  - player whose HP hits 0 has `downed` set to `true`
  - a player with `downed === true` already is not modified by further attack events
  - input map is not mutated (reference check)
  - returns `wiped: true` when all players are downed; `wiped: false` otherwise

- [x] T8 [R7] — Implement `allEnemiesDead(enemies)` in
  `src/server/src/combat/tick.ts`.
  Test: `src/server/src/combat/tick.test.ts` (same file, extended)
  - returns `true` when every entry has `alive === false`
  - returns `false` when at least one entry has `alive === true`
  - returns `true` for an empty map (vacuously all dead; no enemies = floor clear)

- [x] T9 [R8] — Implement `movePlayer(playerState, dx, dy, dt, dungeon, speed?)` in
  `src/server/src/combat/movement.ts`.
  Test: `src/server/src/combat/movement.test.ts`
  - zero vector input returns the original state unchanged (no mutation)
  - diagonal input is normalized (resulting speed equals `PLAYER_SPEED * dt`, not
    `sqrt(2) * PLAYER_SPEED * dt`)
  - result position is clamped to `[0, dungeon.width]` x `[0, dungeon.height]`
  - input `PlayerState` is not mutated

- [x] T10 [R3, R5, R6, R7, P3, P5] — Implement `stepCombat(room, dt)` in
  `src/server/src/combat/roomCombat.ts`.
  Test: `src/server/src/combat/roomCombat.test.ts`
  - a non-in-progress or non-combat-phase room returns `{ ok: false }` and mutates
    nothing
  - enemy positions update per `tickEnemies` after one step
  - player HP decreases when an attack event is generated
  - when all players are downed after attack application, `room.status === 'ended'`
    and `room.outcome === 'wiped'`
  - when all enemies are dead after a step, `room.phase === 'loot'` and
    `phaseChanged === true` in the result
  - calling `stepCombat` on an already-ended room returns `{ ok: false }` (P5)

- [x] T11 [R3, R10, R12] — Integrate enemy spawning into
  `RoomManager.descendRoom` (and run-start) in `src/server/src/room/manager.ts`.
  Extend `descendRoom` to call `spawnEnemies` and store the result in `room.enemies`;
  also initialize `room.playerStates` on run start.
  Test: `src/server/src/room/manager.test.ts` (extended)
  - after `descendRoom`, `room.enemies` is non-empty (at least one enemy)
  - enemy map from `descendRoom` on the same room code + same floor is deeply equal
    to a direct `spawnEnemies` call with the same `(runId, floor, dungeon)` inputs
  - all players in `room.players` have a corresponding entry in `room.playerStates`
    with `hp === PLAYER_MAX_HP` and `downed === false` after a run starts

- [x] T12 [R11, P6] — Add the phase guard to the `revive` socket handler in
  `src/server/src/index.ts`. On a revive attempt when `room.phase !== 'combat'`,
  emit a targeted `LOBBY_ERROR` (code `WRONG_PHASE`) and mutate nothing. On success
  set `downed = false`, `hp = maxHp` on the revived player's `PlayerState`, and
  broadcast `PLAYER_REVIVED`.
  Test: `src/server/src/combat/tickLoop.test.ts` and `src/server/src/index.test.ts`
  - revive in `loot` phase emits `LOBBY_ERROR` with code `WRONG_PHASE`; no state
    change and no broadcast
  - revive in `combat` phase succeeds: revived player has `downed === false` and
    `hp === maxHp`; `PLAYER_REVIVED` is broadcast to the room; `RELIC_REMOVED` and
    `RELIC_PLACED` events are also emitted (Linked Fates relic transfer, unchanged
    from existing spec)

- [x] T13 [R8, R10, P3] — Add the `move-player` socket handler in
  `src/server/src/index.ts`.
  Test: `src/server/src/combat/tickLoop.test.ts`
  - payload missing `dx` or `dy` (or non-numeric) emits a targeted `LOBBY_ERROR`
    (code `INVALID_REQUEST`) and does not broadcast
  - socket not in a room emits targeted `LOBBY_ERROR` and does not broadcast
  - valid payload in a non-combat phase still moves the player (movement is not
    phase-gated in this spec; note this)
  - valid payload updates the player's position in `room.playerStates` and broadcasts
    `PLAYER_MOVED` to the room with `{ playerId, x, y }`

- [x] T14 [R9, R10, R12, P4, P7] — Implement the combat tick driver
  `runCombatTick(io, manager, dt)` in `src/server/src/index.ts` and wire
  it into `startServer` via `setInterval` at `COMBAT_TICK_MS` (100 ms default).
  The driver calls `stepCombat` for every room in `manager.activeRooms` where
  `phase === 'combat'`, then fans out delta events per the `CombatStepResult`.
  Test: `src/server/src/combat/tickLoop.test.ts`
  - one tick with one room in combat phase: `PLAYER_DAMAGED` and `PLAYER_DOWNED`
    emitted for any attack events; `PHASE_CHANGED` emitted when all enemies die in
    that tick
  - one tick with a room in `loot` phase: no events broadcast (P7)
  - one tick with a room in `ended` status: no events broadcast (P5)
  - a room whose `stepCombat` result has `wiped === true` receives a `RUN_ENDED`
    event (reuse existing event shape) with `outcome: 'wiped'`
  - exactly one `PHASE_CHANGED` is emitted per floor-clear tick, not more (delta,
    not resync)
