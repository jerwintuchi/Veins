# Tasks — Multiplayer Lobby + Rooms

Order: shared types -> room codes -> hex board layout -> placement hardening -> RoomManager (incl. run lifecycle) -> Socket.io wiring.
Each task cites R# and names its test.

---

- [x] T1 [R1, R2, R4] — Define lobby types + constants in `src/shared/src/lobby.ts` (`RoomCode`, `RoomStatus`, `RoomSummary`, request/event types, `MAX_PLAYERS`, `MIN_PLAYERS_TO_START`, `HEX_BOARD_RADIUS`); export from index.
  Test: `src/shared/src/lobby.test.ts`
  - types compile under strict mode; constants have expected values (MAX_PLAYERS=4, MIN=2, RADIUS=2)

- [x] T2 [R1, P1] — Implement `generateRoomCode()` in `src/server/src/room/roomCode.ts` (unambiguous alphabet, node:crypto).
  Test: `src/server/src/room/roomCode.test.ts`
  - returns a non-empty string of the expected length
  - uses only allowed alphabet characters
  - produces no collisions across many generations (statistical)

- [x] T3 [R5, P4] — Implement hex board construction in `src/server/src/board/layout.ts`: `buildHexCoords(radius)`, `assignHomeQuadrants(coords, players)`, `buildInitialBoard(players, radius)`.
  Test: `src/server/src/board/layout.test.ts`
  - `buildHexCoords(2)` returns exactly 19 unique coords, all within hex-distance 2
  - every slot is owned by exactly one player; all players receive at least one slot
  - at least one adjacent slot pair has different owners (cross-player adjacency, P4)
  - deterministic for the same players list

- [x] T4 [R6, P5] — Harden `placeRelic` in `src/server/src/board/placement.ts`: take authoritative `playerId`, drop trusted `ownerId` from request, reject `NOT_OWNER`, emit `slot.ownerId`. Update `PlaceRelicRequest` + existing placement tests.
  Test: `src/server/src/board/placement.test.ts` (updated)
  - placing into own empty slot succeeds; event reports slot owner
  - placing into another player's slot rejected with `NOT_OWNER`, no mutation
  - existing SLOT_OCCUPIED / WRONG_PHASE / INVALID_COORD paths still hold

- [x] T5 [R1, R2, R3, R4, P1, P2, P3] — Implement `RoomManager` in `src/server/src/room/manager.ts`: `createRoom`, `joinRoom`, `leaveRoom`, `startRun`, `getRoom`. Extend `Room` with `code`, `hostId`, `status`, `runId`.
  Test: `src/server/src/room/manager.test.ts`
  - createRoom -> lobby room with host as sole player; unique codes
  - joinRoom success + all four rejections (ROOM_NOT_FOUND, ROOM_FULL, ALREADY_STARTED, ALREADY_IN_ROOM)
  - leaveRoom removes player; empty room deleted; host reassigned when host leaves
  - startRun rejects < 2 players; on success status in-progress, dungeon generated, board initialized & fully owned
  - startRun dungeon deterministic for a fixed runId

- [x] T6 [R7] — Wire Socket.io server in `src/server/src/index.ts`: connection/auth, handlers for create-room/join-room/leave-room/start-run/place-relic/revive, broadcasting delta events and targeted errors. Thin plumbing over T1-T5 + existing board/dungeon logic.
  Test: integration/manual (documented). Logic paths it calls are unit-tested in T3-T5 and the Circulatory Board suite. A smoke test asserts the wiring module imports and constructs without throwing.
