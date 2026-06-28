# Requirements — Descend / Extract Buttons

The server already has `descend` and `extract` socket handlers. The client
has no UI to trigger them, making it impossible to progress past the first
loot phase. This spec adds that UI.

Out of scope: confirmation dialogs, vote-to-descend, host-only restrictions
(the server already allows any player to call either action).

---

**R1**: A `DescendPanel` component appears during loot phase and is hidden
during all other phases.
- AC: `data-testid="descend-panel"` is in the DOM when `phase === 'loot'`.
- AC: `data-testid="descend-panel"` is NOT in the DOM when `phase === 'combat'`.

**R2**: Clicking "Descend" emits `descend` to the server.
- AC: `data-testid="descend-btn"` is rendered inside `descend-panel`.
- AC: Clicking it calls `socket.emit('descend')`.

**R3**: Clicking "Extract" emits `extract` to the server.
- AC: `data-testid="extract-btn"` is rendered inside `descend-panel`.
- AC: Clicking it calls `socket.emit('extract')`.

**R4**: Buttons are disabled while a request is in flight (prevent double-tap).
- AC: After clicking either button, both buttons gain the `disabled` attribute
  until a `FLOOR_ADVANCED`, `RUN_ENDED`, or `LOBBY_ERROR` event is received.
- AC: On `LOBBY_ERROR`, the error message is shown in
  `data-testid="descend-error"` and buttons re-enable.

**R5**: `DescendPanel` is mounted from `App` during the game screen and
receives `socketRef` and `phase` as props.
