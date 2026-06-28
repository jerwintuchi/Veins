# Tasks — Bleed Clock

Order: shared types -> pure tick math -> room transitions -> RoomManager integration -> Socket.io loop + extract handler.
Each task cites R# and names its test.

---

- [x] T1 [R1, R4, R7] — Define `BleedClockState`, `RunOutcome`, `BLEED_TICK_INTERVAL_MS` in `src/shared/src/bleedClock.ts`; add `BleedClockTickEvent`, `RunEndedEvent` to `src/shared/src/events.ts`; export from index. Retype `Room.bleedClock` to shared `BleedClockState` and add `Room.outcome`.
  Test: `src/shared/src/bleedClock.test.ts`
  - types compile under strict mode; `BLEED_TICK_INTERVAL_MS` === 1000

- [x] T2 [R1, R5, R8, P1, P2] — Implement `tickBleedClock(clock, dt)` in `src/server/src/bleed/clock.ts`.
  Test: `src/server/src/bleed/clock.test.ts`
  - reduces current by drainPerSecond * dt
  - clamps current to >= 0 (never negative), even for large dt
  - reports `depleted` true exactly when current reaches 0
  - same (clock, dt) called twice -> identical output (determinism); original clock not mutated

- [x] T3 [R2, R3, R6, P3, P4, P5] — Implement `advanceBleedForRoom(room, dt)` and `extractRun(room)` in `src/server/src/bleed/clock.ts`.
  Test: `src/server/src/bleed/clock.test.ts`
  - depletion sets status `ended` + outcome `wiped`, returns RUN_ENDED(wiped) with finalFloor
  - a non-depleting tick returns `ended: null` and leaves status `in-progress`
  - an already-`ended` room is not re-ended by a further tick (terminal once, P5)
  - `extractRun` on an in-progress room -> ended + outcome `extracted`, RUN_ENDED(extracted)
  - `extractRun` on a non-in-progress room -> { ok: false }, no state change
  - `drainRateForFloor` strictly increasing (P3); `advanceFloor` preserves current, raises drain (P4)

- [x] T4 [R3, R7] — Add `activeRooms()`, `tickRoom(code, dt)`, `extractRoom(code)` to `RoomManager`.
  Test: `src/server/src/room/manager.test.ts` (extended)
  - `activeRooms` returns only in-progress rooms (lobby/ended excluded)
  - `tickRoom` drains the room's clock; depletion ends the run
  - `extractRoom` ends an in-progress run as `extracted`; rejects otherwise

- [x] T5 [R3, R4, R7] — Wire the bleed game loop + `extract` handler in `src/server/src/index.ts`: interval ticks active rooms, broadcasts `BLEED_CLOCK_TICK` and `RUN_ENDED`; `extract` handler broadcasts `RUN_ENDED`. Export a `runBleedTick(io, manager, dt)` step function for testability; start the interval in `startServer`.
  Test: `src/server/src/index.test.ts` (extended)
  - `runBleedTick` broadcasts `BLEED_CLOCK_TICK` to an active room
  - a tick that depletes the clock broadcasts `RUN_ENDED` (wiped)
  - the `extract` handler broadcasts `RUN_ENDED` (extracted) and rejects when not in a room
