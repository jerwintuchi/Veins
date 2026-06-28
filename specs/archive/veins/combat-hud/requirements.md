# Requirements — Combat HUD: Enemy Count + Teammate HP

Two small additions to the HUD that improve combat legibility.

---

**R1**: HUD shows remaining enemy count during combat.
- AC: `data-testid="enemy-count"` is rendered in the HUD.
- AC: Count increments on each `ENEMY_SPAWNED` event.
- AC: Count decrements on each `ENEMY_DIED` event (min 0).
- AC: Count resets to 0 on `FLOOR_ADVANCED` (before new spawns) and on
  `RUN_STARTED`.
- AC: Count resets to 0 when `PHASE_CHANGED` delivers `phase === 'loot'`
  (all enemies cleared).

**R2**: HUD shows HP for all players, not just local.
- AC: For each player ID in the `players` prop, a
  `data-testid="teammate-hp-{playerId}"` element is rendered.
- AC: On `RUN_STARTED`, all players initialise at `PLAYER_MAX_HP`.
- AC: `PLAYER_DAMAGED` updates the correct player's HP regardless of whether
  they are local or remote.
- AC: `PLAYER_DOWNED` sets the correct player's HP to 0.
- AC: `PLAYER_REVIVED` restores the correct player's HP to `PLAYER_MAX_HP`.
- AC: The existing `data-testid="player-hp"` element remains for the local
  player (backwards-compatible).

**R3**: No client-side HP arithmetic — all values come from server events.
