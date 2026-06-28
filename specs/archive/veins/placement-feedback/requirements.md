# Requirements — Placement Error Feedback + Empty Tray Hint

## Part 1: RELIC_PLACE_ERROR feedback

**R1**: When `RELIC_PLACE_ERROR` is received, an error message is shown in the board panel.
- AC: `data-testid="placement-error"` becomes visible with the server's `message` string.
- AC: The error clears when a new `place-relic` event is emitted (next attempt).
- AC: The error clears when `RELIC_PLACED` is received (success from another player).

## Part 2: Empty tray hint

**R2**: When the loot pool is exhausted (all offered relics placed), a hint replaces the empty tray.
- AC: `data-testid="tray-ready-hint"` is visible when `phase === 'loot'` and `available.length === 0`.
- AC: The hint is NOT shown when `available.length > 0`.
- AC: The hint is NOT shown when `phase !== 'loot'`.
