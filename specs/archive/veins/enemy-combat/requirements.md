# Requirements — Enemy System + Combat

The enemy and combat system introduces active floor encounters. Entering combat phase
(on descend or run start) spawns enemies on the new floor. The server ticks enemy AI,
resolves attacks against players, and tracks per-player HP. When the last enemy on the
floor dies, the phase flips from `combat` to `loot`. This closes the open thread from
the Floor Progression spec: descend sets `phase = 'combat'` but nothing yet flips it
back.

Out of scope for this spec: relic synergy damage effects, loot drops, player attacks
originating from input, mobile joystick rendering.

---

**R1**: As a game system, there are at least two enemy types (Shambler and Spitter), each
defined by a fixed stat block so implementers have concrete, testable values to target.
- AC: `ENEMY_TYPES` registry in shared contains entries for `'shambler'` and `'spitter'`
  with fields: `typeId`, `baseHp`, `damage`, `speed` (units/sec), `detectionRange`,
  `attackRange`, and `attackCooldown` (seconds)
- AC: Shambler stats satisfy: `speed` < Spitter `speed`; Shambler `attackRange` < Spitter
  `detectionRange` (melee vs ranged distinction is expressible in these fields)
- AC: Spitter `attackRange` > Shambler `attackRange` (Spitter attacks from further away)

**R2**: As a game system, each player in a room has a current HP and max HP tracked
server-side so that attacks and revives have a concrete numerical state to modify.
- AC: `Room` carries a `Map<PlayerId, PlayerState>` where `PlayerState` has `hp: number`,
  `maxHp: number`, and `downed: boolean`
- AC: `PlayerState` is defined in `src/shared/` as a type only (no logic, satisfies I4)
- AC: all players start a run with `hp === maxHp` and `downed === false`

**R3**: As a game system, enemies spawn on the current floor when a floor is entered,
deterministically from `(runId, floor)`, so the same run always produces the same
enemy layout and bug reproduction holds (invariant I3).
- AC: `spawnEnemies(runId, floor, dungeon)` is a pure function that returns a
  `Map<EnemyId, EnemyState>` derived only from its inputs and the seeded RNG
- AC: calling it twice with identical inputs produces deeply-equal maps
- AC: calling it with different floors of the same `runId` produces different maps
  (enemy count or positions differ)
- AC: enemies are placed inside dungeon room bounds, not in corridors

**R4**: As a game system, the AI tick is a pure function so that server logic is fully
testable without a running server (invariant I1, board-logic purity precedent).
- AC: `tickEnemies(enemies, players, dungeon, dt)` takes current state and returns a
  new `Map<EnemyId, EnemyState>` and a list of `CombatEvent`s (attacks that landed)
  without mutating its inputs
- AC: called twice with identical inputs it returns deeply-equal outputs (deterministic
  movement; no randomness in pathing)
- AC: an enemy outside detection range of all players does not move (stays idle)
- AC: an enemy within detection range but outside attack range moves toward the nearest
  player by at most `speed * dt` units
- AC: an enemy within attack range and with expired cooldown generates an attack
  `CombatEvent`; its `attackCooldownRemaining` resets to `attackCooldown`

**R5**: As a game system, enemy attacks reduce the targeted player's HP server-side.
When a player's HP reaches 0 that player becomes downed. Downed players cannot be
attacked further (invariants I1, I2).
- AC: `applyEnemyAttacks(players, combatEvents)` reduces the target player's `hp` by
  the attack's `damage` value, clamped to a minimum of 0
- AC: a player whose `hp` reaches 0 has `downed` set to `true`
- AC: a downed player (`downed === true`) is skipped as an attack target in subsequent
  `tickEnemies` calls (enemies do not attack downed players)
- AC: `applyEnemyAttacks` does not mutate its input; it returns a new player map

**R6**: As a game system, a wipe (all players downed simultaneously) ends the run with
`outcome: 'wiped'` so the run has a definitive failure state (design requirement).
- AC: when every player in `room.players` has `downed === true`, the room transitions
  to `status: 'ended'` and `outcome: 'wiped'`
- AC: the wipe check happens after each `applyEnemyAttacks` result is applied
- AC: a room that has already ended is not ended again (terminal once)

**R7**: As a game system, when the last enemy on the current floor is dead the phase
transitions from `combat` to `loot` and a `PHASE_CHANGED` delta event is broadcast,
so relic placement is re-enabled without a full resync (invariants I1, I6).
- AC: when `room.enemies` contains no entry with `alive === true`, `room.phase` is
  set to `'loot'`
- AC: `PHASE_CHANGED` is emitted to the room with `{ phase: 'loot' }`
- AC: no full game-state resync is sent alongside `PHASE_CHANGED` (delta only)

**R8**: As a player, I can send a `move-player` intention (direction vector) and the
server validates and applies it, moving my character within dungeon bounds, so movement
feels responsive while remaining server-authoritative (invariants I1, I2).
- AC: `move-player` handler validates payload has `{ dx: number, dy: number }` before
  applying; malformed payloads emit a targeted error and mutate nothing
- AC: the handler rejects a socket that is not in an active room
- AC: movement is clamped so the resulting position stays within dungeon bounds
- AC: a valid move emits `PLAYER_MOVED` delta event to the room carrying
  `{ playerId, x, y }`

**R9**: As a game system, enemy spawning and the AI tick are server-only and authoritative.
No enemy state originates from client input (invariant I1).
- AC: `EnemyState` and all combat resolution live in `src/server/`; no enemy position
  or HP field is accepted from a client socket message
- AC: the server AI loop (not the client) determines when attacks land and at what damage

**R10**: As a game system, enemy spawn events and attack outcomes are broadcast as
targeted delta events so clients can render enemies and damage numbers without receiving
full room state (invariant I6).
- AC: on floor entry, one `ENEMY_SPAWNED` event is emitted per enemy to the room
- AC: when an enemy takes damage, `ENEMY_DAMAGED` is emitted with `{ enemyId, hp }`
- AC: when an enemy dies, `ENEMY_DIED` is emitted with `{ enemyId }`
- AC: when a player takes damage, `PLAYER_DAMAGED` is emitted with `{ playerId, hp }`
- AC: when a player is downed, `PLAYER_DOWNED` is emitted with `{ playerId }`
- AC: none of these events include the full room state object

**R11**: As a game system, Linked Fates (revive) is phase-gated to `combat` so players
can only sacrifice a relic to revive a downed teammate during active combat (where the
trade-off is meaningful).
- AC: the existing `revive` socket handler rejects the request when `room.phase !== 'combat'`,
  emitting a targeted error and mutating nothing
- AC: a successful revive in `combat` phase restores the downed player's `hp` to `maxHp`
  and sets `downed` to `false`, then emits `PLAYER_REVIVED` with `{ playerId, hp }`

**R12**: As a game system, the server AI tick loop runs at a fixed interval while a room
is in `combat` phase and stops when the room leaves `combat` (phase change or room end),
so compute is not wasted on idle rooms.
- AC: the server tick interval is a configurable constant (`COMBAT_TICK_MS`, default 100ms)
- AC: the tick loop is cleared when `room.phase` leaves `combat` or `room.status` becomes
  `'ended'`
- AC: a room in `loot` or `transition` phase does not tick AI
