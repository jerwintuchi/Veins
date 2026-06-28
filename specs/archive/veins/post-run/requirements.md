# Requirements — Post-Run Screen

When a run ends (wipe or extraction), the game transitions to a post-run
summary screen showing the outcome and offering a way back to the lobby.

Out of scope: meta-progression updates, cosmetics, XP display, rematch flow
(return to waiting room with same players), per-player stats.

---

**R1**: `App` transitions to a `'post-run'` screen on `RUN_ENDED`.
- AC: When `RUN_ENDED` is received, the game screen is replaced by
  `data-testid="post-run-screen"`.
- AC: The Phaser canvas and in-game overlays (HUD, BoardPanel, joystick)
  are unmounted.

**R2**: `PostRunScreen` displays run outcome and final floor.
- AC: `data-testid="run-outcome"` shows text containing `'WIPED'` when
  `outcome === 'wiped'`, or `'EXTRACTED'` when `outcome === 'extracted'`.
- AC: `data-testid="run-floor"` shows text containing the final floor
  number.

**R3**: `PostRunScreen` has a "Return to Lobby" button.
- AC: Clicking `data-testid="return-to-lobby-btn"` transitions `App` back
  to the `'lobby'` screen.
- AC: After returning, `data-testid="lobby-screen"` is visible and the
  `post-run-screen` is gone.
