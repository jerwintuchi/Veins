# Tasks — Circulatory Board

Tasks are ordered: shared types → server pure logic → server event handlers → client rendering.
Each task cites R# and names its test before implementation begins.

---

- [x] T1 [R1, R4, R7] — Define `HexCoord`, `RelicSlot`, `RelicBoard`, `Relic`, `SynergyMap`, `RelicTag` types in `src/shared/src/board.ts`. Implement `hexCoordKey(coord)` and `hexNeighbors(coord)`.
  Test: `src/shared/src/board.test.ts`
  - `hexNeighbors` returns exactly 6 coords for any input
  - `hexNeighbors` returns the correct 6 axial offsets
  - `hexCoordKey` is injective: different coords produce different keys for all reasonable integer inputs
  - All types compile under `strict: true`

- [x] T2 [R3, R7, P1, P2, P3, P4, P5] — Implement `evaluateSynergies(board, registry)` in `src/server/src/board/synergy.ts`.
  Test: `src/server/src/board/synergy.test.ts`
  - Same board + registry called twice → identical SynergyMap (P1 determinism)
  - Solo player with adjacent own-relics: no synergy fires (P2)
  - Two players with adjacent matching-tag relics: both get `true` (P3 mutual)
  - Two players adjacent but no shared tags: neither fires (P4)
  - Result is identical regardless of slot insertion order (P5)
  - Empty board returns empty SynergyMap

- [x] T3 [R2, R4] — Implement relic placement handler in `src/server/src/board/placement.ts`. Validates input, mutates board, re-evaluates synergies, emits `RELIC_PLACED` to room.
  Test: `src/server/src/board/placement.test.ts`
  - Valid placement: board slot updated, `RELIC_PLACED` emitted to room with correct `synergyMap`
  - Occupied slot: no state mutation, `RELIC_PLACE_ERROR` emitted to requesting socket only, `code: 'SLOT_OCCUPIED'`
  - Wrong game phase: no state mutation, `RELIC_PLACE_ERROR` emitted, `code: 'WRONG_PHASE'`
  - Invalid coord (not on board): no state mutation, error emitted, `code: 'INVALID_COORD'`
  - Placement updates synergy for ALL relics on board, not just the newly placed one

- [x] T4 [R6] — Implement Linked Fates revive mechanic in `src/server/src/board/linkedFates.ts`. Validates reviver has a relic to sacrifice, removes it from reviver slot, places it in downed player slot, emits events.
  Test: `src/server/src/board/linkedFates.test.ts`
  - `RELIC_REMOVED` emitted (with `reason: 'linked-fates'`) before `RELIC_PLACED`
  - Sacrificed relic is absent from reviver's slot after operation
  - Sacrificed relic is present in downed player's target slot after operation
  - Reviver with no relics: revive rejected, no state mutation, error to requesting socket
  - Synergy re-evaluated and included in `RELIC_PLACED` event

- [ ] T5 [R1, R5] — Implement `BOARD_STATE_SYNC` emission on room join in `src/server/src/room/sync.ts`. Sends full board snapshot to joining socket only.
  Test: `src/server/src/room/sync.test.ts`
  - Joining player receives `BOARD_STATE_SYNC` with complete `board`, `synergyMap`, `relicRegistry`
  - Only the joining socket receives this event (not the whole room)
  - `synergyMap` in the sync event is computed fresh (not cached from last event)

- [ ] T6 [R5] — Verify floor transition does not mutate board in `src/server/src/room/state.ts`. Add floor transition logic if not present; add guard ensuring board is not reset.
  Test: `src/server/src/room/state.test.ts`
  - Board state before floor transition === board state after floor transition (deep equality)
  - Floor number increments; board slots unchanged
  - Bleed Clock drain rate updates on floor transition (out of scope for board spec, just ensure board is untouched)
