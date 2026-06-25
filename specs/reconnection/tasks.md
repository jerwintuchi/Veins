# Reconnection / Resync — Tasks

All tasks: R# cited → test named → implementation → mark done. **All complete (2026-06-25).**

---

- [x] T1 [R4, P2] — Add `StateResyncEvent` + `PlayerConnectionChangedEvent` to
  `src/shared/src/events.ts`; add `CANNOT_REJOIN` to `LobbyErrorEvent` in `src/shared/src/lobby.ts`.
  Test: covered by `sync` + handler tests in T3/T4 that construct/emit the payload.

- [x] T2 [R2, R3, P3] — `Room.disconnectedPlayers` (state.ts) + `RoomManager.markDisconnected` and
  `RoomManager.rejoin` (manager.ts); init the set in `createRoom`.
  Test: `src/server/src/room/reconnection.test.ts`
  - in-progress disconnect retains the player + records them, board/players unchanged
  - lobby disconnect removes the player (mode 'left'), reassigns host / deletes empty room
  - all-disconnected in-progress room is deleted
  - rejoin succeeds for a member of an in-progress room and clears the flag
  - rejoin fails (CANNOT_REJOIN) for a non-member / non-in-progress room

- [x] T3 [R4, P1, P2] — `buildStateResync(room)` + `syncResyncToSocket` in `src/server/src/room/sync.ts`.
  Test: `reconnection.test.ts`
  - snapshot contains board, synergy, registry, lootPool, phase, floor, bleedClock, bleedStage,
    alive-only enemies, projectiles, playerStates, aimStates, room summary, disconnectedPlayers
  - determinism: two calls on the same room produce equal snapshots (P1)
  - `syncResyncToSocket` emits exactly one `STATE_RESYNC` to the single socket (P2)

- [x] T4 [R1, R3, R4, R5] — `index.ts`: handshake identity; `rejoin` handler (emit `STATE_RESYNC`
  + broadcast `PLAYER_CONNECTION_CHANGED {connected:true}`); `disconnect` retention branch
  (broadcast `PLAYER_CONNECTION_CHANGED {connected:false}` in-progress; `ROOM_UPDATE` in lobby).
  Test: `reconnection.test.ts` (fake io/socket harness, mirroring index.test.ts)
  - handshake auth playerId is used as identity
  - rejoin emits STATE_RESYNC to the requesting socket only + broadcasts connection:true
  - rejoin on a bad code emits LOBBY_ERROR, no STATE_RESYNC
  - in-progress disconnect broadcasts connection:false and does NOT remove the player

- [x] T5 [R1, R6] — Client: `getStablePlayerId()` + `auth` in `useSocket.ts`; `App` uses the stable
  id as `localPlayerId`.
  Test: `src/client/src/App.reconnect.test.tsx` — connecting passes a stable auth id; localPlayerId
  is the stable id (not socket.id).

- [x] T6 [R6] — Client: persist room code (sessionStorage); auto-`rejoin` on connect; `STATE_RESYNC`
  handler restores the game screen + board/dungeon/phase.
  Test: `App.reconnect.test.tsx` — with a stored code, `connect` emits `rejoin`; a `STATE_RESYNC`
  event switches to the game screen with the snapshot's board/phase.
