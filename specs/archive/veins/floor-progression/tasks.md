# Tasks — Floor Progression

Order: shared event -> floor-aware seeding -> descendFloor + RoomManager -> Socket.io handler.
Each task cites R# and names its test.

---

- [x] T1 [R5] — Add `FloorAdvancedEvent` to `src/shared/src/events.ts`; export from index.
  Test: `src/shared/src/floorProgression.test.ts`
  - type compiles under strict mode; carries `floor` and `dungeon`

- [x] T2 [R2, P1] — Extend `generateDungeon` in `src/server/src/dungeon/bsp.ts` with an optional `floor` (default 1) folded into the seed (`runId#floor`). Layout `runId` unchanged.
  Test: `src/server/src/dungeon/bsp.test.ts` (extended)
  - same `(runId, floor)` -> deeply-equal layout
  - different floors of the same run -> different layouts
  - `floor` omitted behaves as floor 1; `layout.runId` is still the bare runId

- [x] T3 [R1, R3, R4, R6, P2, P3] — Implement `descendFloor(room, config?)` in `src/server/src/floor/progression.ts` and `RoomManager.descendRoom(code)`.
  Test: `src/server/src/floor/progression.test.ts` and `src/server/src/room/manager.test.ts` (extended)
  - floor increments; drain rate rises to `drainRateForFloor(newFloor)`
  - board deeply-equal across descend; `bleedClock.current` unchanged
  - dungeon equals `generateDungeon(runId, config, newFloor)`
  - phase becomes `combat`
  - descend on a non-in-progress room -> `{ ok: false }`, no mutation
  - `descendRoom` on unknown code -> `{ ok: false }`

- [x] T4 [R4, R5] — Wire the `descend` socket handler in `src/server/src/index.ts`: validates active room, calls `descendRoom`, broadcasts `FLOOR_ADVANCED`; targeted error otherwise.
  Test: `src/server/src/index.test.ts` (extended)
  - `descend` broadcasts `FLOOR_ADVANCED` with the new floor + dungeon to the room
  - rejects when the socket is not in a room (targeted `LOBBY_ERROR`, no broadcast)
