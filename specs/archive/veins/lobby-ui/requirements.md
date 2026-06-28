# Requirements — Lobby UI

Players need a way to create and join rooms before the game begins. The
existing server handlers (`create-room`, `join-room`, `start-run`) already
work; this spec adds the client-side UI screens that drive them.

Out of scope: authentication, persistent player names, spectator mode,
rematch flow.

---

**R1**: `LobbyScreen` React component lets a player create or join a room.
- AC: "Create Room" button emits `create-room` to the server
- AC: A text input and "Join Room" button emit `join-room { code }` with the
  entered (uppercased) code
- AC: `LOBBY_ERROR` events render an error message with `role="alert"` so it
  is accessible
- AC: `data-testid="lobby-screen"` on the root element for test targeting

**R2**: `WaitingRoom` React component shows the pre-run room state.
- AC: Displays the room code prominently (`data-testid="room-code"`)
- AC: Lists all players in the room (`data-testid="player-list"`)
- AC: The "Start Run" button (`data-testid="start-run-btn"`) is only rendered
  when `localPlayerId === room.hostId`; it emits `start-run`
- AC: A "Leave" button (`data-testid="leave-btn"`) emits `leave-room`
- AC: `ROOM_UPDATE` events update the displayed player list

**R3**: `App.tsx` manages a top-level screen state machine.
- AC: Initial screen is `'lobby'` — `LobbyScreen` is rendered, no Phaser, no
  `#game-container` in the DOM
- AC: On `ROOM_UPDATE`, screen transitions to `'waiting'` —
  `WaitingRoom` is rendered
- AC: On `RUN_STARTED`, screen transitions to `'game'` — `#game-container`
  appears and `Phaser.Game` is instantiated
- AC: `Phaser.Game` is only created when `screen === 'game'` (lazy mount);
  destroying the component destroys the game instance

**R4**: `RUN_STARTED` board data flows to `BoardPanel` without a race
condition.
- AC: App captures the `RUN_STARTED` payload (board, synergyMap, relicRegistry)
  and passes it to `BoardPanel` as initial props, so the panel is populated
  on first render even though the socket event has already been consumed
- AC: `BoardPanel` accepts optional `initialBoard`, `initialSynergyMap`,
  `initialRegistry` props and uses them as `useState` initial values
- AC: `RELIC_PLACED` and `BOARD_STATE_SYNC` continue to work as incremental
  updates after the initial render

**R5**: The `ROOM_UPDATE` handler in `App.tsx` correctly reads the `{ room }`
wrapper in the event payload.
- AC: `ev.room.players` is used (not `ev.players`) — the `RoomUpdateEvent`
  type confirms the nested shape
- AC: `players` prop to `BoardPanel` is derived from `roomSummary.players`
  (no separate `players` state in App)
