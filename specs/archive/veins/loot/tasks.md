# Tasks — Per-Floor Loot Drops

---

- [x] T1 [R1] — Implement `generateLootPool` in
  `src/server/src/loot/pool.ts`.
  Test: `src/server/src/loot/pool.test.ts` (new)
  - same inputs always produce the same pool (determinism check)
  - pool contains only unplaced relics
  - pool size is min(LOOT_POOL_SIZE, unplacedCount)
  - empty pool when all relics are placed

- [x] T2 [R2, R3, R4] — Add `lootPool` to Room state; wire into `startRun`,
  `PHASE_CHANGED`, and `place-relic`; extend shared types.
  Test: `src/server/src/room/manager.test.ts` (extended) +
        `src/server/src/index.test.ts` (extended)
  - `createRoom` has `lootPool: []`
  - `startRun` populates `lootPool` with generated pool (≤ 3 relics)
  - `RUN_STARTED` event includes `lootPool`
  - `PHASE_CHANGED` event includes `lootPool` when phase is 'loot'
  - `place-relic` rejects with `RELIC_NOT_IN_POOL` if relic not in pool
  - successful placement removes the relic from `room.lootPool`

- [x] T3 [R5] — Update `BoardPanel` to track and display the loot pool.
  Test: `src/client/src/components/BoardPanel.test.tsx` (extended)
  - tray shows only lootPool relics after `RUN_STARTED`
  - tray updates when `PHASE_CHANGED` carries a new `lootPool`
  - placed relic is removed from tray after `RELIC_PLACED`
