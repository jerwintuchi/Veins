# Tasks — Relic Board UI

Order: shared relic data first, then server wiring, then client component.

---

- [x] T1 [R1] — Add `STARTER_RELICS` and `STARTER_RELIC_IDS` to
  `src/shared/src/relics.ts`; export from `src/shared/src/index.ts`.
  Test: `src/shared/src/relics.test.ts` (new)
  - `STARTER_RELICS` has exactly 6 entries, each with unique id
  - All 6 entries have at least one `RelicTag`, non-empty name and effect descriptions
  - 2 relics have `'fire'` tag, 2 have `'chain'` tag, 2 have `'shield'` tag
  - `STARTER_RELIC_IDS` matches `STARTER_RELICS.map(r => r.id)`
  - All symbols re-exported from `src/shared/src/index.ts`

- [x] T2 [R2, R3] — `startRun` populates `room.registry` with `STARTER_RELICS`;
  `RUN_STARTED` payload carries `relicRegistry`.
  Test: `src/server/src/room/manager.test.ts` (extended) +
        `src/server/src/index.test.ts` (extended)
  - after `startRun`, `room.registry.size === STARTER_RELICS.length`
  - every relic in `room.registry` matches the corresponding `STARTER_RELICS` entry
  - `RUN_STARTED` event includes `relicRegistry` field (plain object keyed by id)
  - existing `board` and `synergyMap` fields still present in `RUN_STARTED`

- [x] T3 [R4, R5, R6, R7, R8] — Implement `BoardPanel` in
  `src/client/src/components/BoardPanel.tsx`; mount in `App.tsx`; `App`
  tracks `phase` via `PHASE_CHANGED`.
  Test: `src/client/src/components/BoardPanel.test.tsx` (new)
  - hidden when `phase !== 'loot'`; visible when `phase === 'loot'`
  - renders one polygon element per slot in the board
  - a slot owned by the local player gets fill `#4488ff`
  - a synergized slot gets a yellow stroke (`#ffff00`)
  - a placed relic's name appears as text inside its slot
  - an unplaced relic appears as a button in the relic tray
  - clicking a tray button selects it (button gains `data-selected="true"`)
  - clicking the same tray button again deselects it
  - clicking an owned empty slot with a selected relic emits `place-relic`
  - clicking an unowned slot with a selected relic does NOT emit `place-relic`
  - `RELIC_PLACED` updates the slot so the relic name is now rendered and the
    card is removed from the tray
  - `BOARD_STATE_SYNC` replaces board + synergy state
