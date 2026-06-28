# Requirements — Phase Transition Notifications

**R1**: A brief toast notification appears when the game phase changes.
- AC: When `PHASE_CHANGED` delivers `phase === 'combat'`, a
  `data-testid="phase-toast"` element shows text containing `'COMBAT'`.
- AC: When `PHASE_CHANGED` delivers `phase === 'loot'`, the toast shows
  text containing `'FLOOR CLEARED'`.
- AC: When `FLOOR_ADVANCED` is received, the toast shows text containing
  `'FLOOR'` and the new floor number.
- AC: The toast auto-dismisses after 2.5 seconds (no user interaction needed).
- AC: A new event while a toast is showing replaces it and restarts the timer.
