# Requirements — Player HP HUD + lootPool initialisation fix

Two things being addressed together because both touch the socket→UI data path:

1. The `lootPool` from `RUN_STARTED` is dropped by `App` (RunData type missing the field).
   This means the BoardPanel starts the loot phase with an empty tray, requiring a
   PHASE_CHANGED event to get the loot pool — but PHASE_CHANGED isn't emitted on run start,
   only on combat→loot transition.  Players can't place relics on floor 1 as a result.

2. `PLAYER_DAMAGED` is broadcast by the server but no client component reads it.
   Players have no way to see their own HP during combat.

---

**R1**: `App` forwards the `lootPool` from `RUN_STARTED` to `BoardPanel`.
- AC: `RunData` in `App.tsx` includes `lootPool: string[]`.
- AC: `initialLootPool` prop is passed to `BoardPanel` from `runData`.
- AC: After `RUN_STARTED`, the relic tray in `BoardPanel` shows the correct
  loot pool (not an empty list).

**R2**: `HUD` displays the local player's current HP.
- AC: `data-testid="player-hp"` element is rendered in the HUD during a run.
- AC: Its text reflects the current HP value received from `PLAYER_DAMAGED`.
- AC: On `RUN_STARTED`, HP is initialised to `PLAYER_MAX_HP`.
- AC: On `PLAYER_DOWNED`, the display shows `0`.

**R3**: HP is sourced from server events, never client-computed.
- AC: HUD subscribes to `PLAYER_DAMAGED` filtered to `localPlayerId` only.
- AC: No health arithmetic is performed in the client.
