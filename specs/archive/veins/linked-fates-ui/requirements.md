# Requirements — Linked Fates Client UI

The server already implements the `revive` socket handler and emits
`RELIC_REMOVED`, `RELIC_PLACED`, and `PLAYER_REVIVED`. This spec covers
what the client must do to drive and reflect those events.

Out of scope: server-side revive logic (already complete in
`src/server/src/board/linkedFates.ts`), post-run screen, spectator mode.

---

**R1**: `BoardPanel` handles `RELIC_REMOVED`.
- AC: When `RELIC_REMOVED` is received, the slot at `ev.coord` has its
  `relicId` set to `null` in local state.
- AC: The synergy pulse animation is removed for that slot (synergized
  state re-evaluated from board state).

**R2**: `BoardPanel` shows a revive overlay when a teammate is downed during combat.
- AC: When `PLAYER_DOWNED` is received for a player other than
  `localPlayerId`, a `data-testid="revive-panel"` element becomes visible.
- AC: When the local player themselves is downed, no revive panel is shown
  (can't revive yourself).
- AC: When `PLAYER_REVIVED` is received for the downed player, the revive
  panel is hidden.

**R3**: Clicking the revive button enters relic-selection mode.
- AC: A `data-testid="revive-btn"` button triggers selection mode.
- AC: In selection mode, only the local player's slots that have a relic
  are selectable (highlighted), indicated by `data-revive-source="true"`.
- AC: Clicking a highlighted source slot advances to target-slot selection:
  a `data-testid="revive-target-hint"` prompt is shown.

**R4**: Selecting a target slot sends 'revive' to the server.
- AC: After source selection, only the downed player's empty slots are
  selectable as targets, indicated by `data-revive-target="true"`.
- AC: Clicking a valid target slot emits `socket.emit('revive', { sourceCoord, targetCoord })`
  (note: `reviverId` is omitted — the server derives it from the socket).
- AC: After emitting, selection mode is cleared and the panel hides
  optimistically (server will broadcast result or error).

**R5**: `LINKED_FATES_ERROR` displays an inline error message.
- AC: An error string becomes visible in `data-testid="linked-fates-error"`.
- AC: The error clears on the next revive attempt or when the panel hides.
