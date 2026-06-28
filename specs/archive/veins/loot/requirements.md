# Requirements — Per-Floor Loot Drops

Each floor clear triggers a loot phase where players choose relics from a
randomly generated pool. This replaces the previous "all relics available
from run start" prototype behaviour.

Out of scope: player-specific offers, relic rarities, multi-pick loot,
relic removal from the pool when picked by another player, relic upgrades.

---

**R1**: `generateLootPool` is a seeded-deterministic pure function in
`src/server/src/loot/pool.ts`.
- AC: Same `(runId, floor, registry, board)` inputs always produce the same
  output (deterministic via seeded RNG, invariant I3)
- AC: The pool contains only relics in `registry` that are NOT already placed
  on the board (`slot.relicId !== null`)
- AC: Pool size is `min(LOOT_POOL_SIZE, unplacedCount)` where
  `LOOT_POOL_SIZE = 3`
- AC: When no relics remain unplaced, the pool is empty (`[]`)

**R2**: `room.lootPool: RelicId[]` tracks the current floor's available
relics.
- AC: `createRoom` initialises `lootPool` to `[]`
- AC: `startRun` calls `generateLootPool` and stores the result as the
  initial `lootPool` (floor 1 starts in loot phase immediately)

**R3**: `PHASE_CHANGED` to `'loot'` regenerates and broadcasts the loot pool.
- AC: When `res.phaseChanged` in `runCombatTick`, the server calls
  `generateLootPool` for the new loot phase and stores it in `room.lootPool`
- AC: The `PHASE_CHANGED` event includes `lootPool: RelicId[]`
- AC: The updated `RUN_STARTED` event also includes `lootPool: RelicId[]`

**R4**: `place-relic` validates that the requested relic is in `room.lootPool`.
- AC: If `!room.lootPool.includes(req.relicId)`, the server emits
  `RELIC_PLACE_ERROR` with code `'RELIC_NOT_IN_POOL'` to the requesting
  socket only; room state is unchanged
- AC: On successful placement, the relic is removed from `room.lootPool`
  (so it cannot be placed twice)

**R5**: `BoardPanel` `RelicTray` shows only relics in the current `lootPool`.
- AC: After `RUN_STARTED`, the tray shows only relics whose IDs appear in
  the received `lootPool` and are not yet placed
- AC: After `PHASE_CHANGED` (with `lootPool`), the tray updates to show
  the new floor's pool
- AC: After a relic is placed (`RELIC_PLACED`), its card is removed from
  the tray (no longer in placed-free pool)
