# Tasks — Lobby UI

Order: components first (no App wiring needed to test them), then App
refactor which pulls everything together.

---

- [x] T1 [R1] — Implement `LobbyScreen` in
  `src/client/src/components/LobbyScreen.tsx`.
  Test: `src/client/src/components/LobbyScreen.test.tsx` (new)
  - renders `data-testid="lobby-screen"`
  - "Create Room" button emits `create-room`
  - "Join Room" button emits `join-room` with the typed code (uppercased)
  - `LOBBY_ERROR` event renders an error message with `role="alert"`
  - error clears when "Create Room" is clicked again

- [x] T2 [R2] — Implement `WaitingRoom` in
  `src/client/src/components/WaitingRoom.tsx`.
  Test: `src/client/src/components/WaitingRoom.test.tsx` (new)
  - renders room code in `data-testid="room-code"`
  - renders all players in `data-testid="player-list"`
  - "Start Run" button is present when `localPlayerId === room.hostId`
  - "Start Run" button is absent when local player is NOT the host
  - clicking "Start Run" emits `start-run`
  - clicking "Leave Room" emits `leave-room`
  - `ROOM_UPDATE` updates the displayed player list

- [x] T3 [R3, R4, R5] — Refactor `App.tsx` to screen state machine; fix
  `ROOM_UPDATE` payload destructuring; pass `RUN_STARTED` data to
  `BoardPanel` as initial props; update `BoardPanel` to accept them;
  update `App.test.tsx`.
  Test: `src/client/src/App.test.tsx` (extended) +
        `src/client/src/components/BoardPanel.test.tsx` (updated)
  - App renders `LobbyScreen` initially (no `#game-container`)
  - App renders `WaitingRoom` after `ROOM_UPDATE`
  - App renders `#game-container` after `RUN_STARTED`
  - `Phaser.Game` is only constructed when `screen === 'game'`
  - `BoardPanel` populated on first render using `initialBoard` prop
    (no re-fire of `RUN_STARTED` needed)
  - `ROOM_UPDATE` handler reads `ev.room.players` (not `ev.players`)
