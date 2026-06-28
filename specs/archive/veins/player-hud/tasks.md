# Tasks — Player HP HUD + lootPool fix

---

- [x] T1 [R1] — Add `lootPool` to `RunData` in App and pass as `initialLootPool` to BoardPanel.
  Test: `src/client/src/App.test.tsx` (extended)
  - after RUN_STARTED with lootPool, BoardPanel receives initialLootPool (verify via prop)

- [x] T2 [R2, R3] — Add `socketRef` + `localPlayerId` props to `HUD`; subscribe to
  `PLAYER_DAMAGED` / `PLAYER_DOWNED` / `RUN_STARTED`; render `data-testid="player-hp"`.
  Test: `src/client/src/components/HUD.test.tsx` (extended)
  - player-hp element present during render
  - PLAYER_DAMAGED for localId updates HP text
  - PLAYER_DAMAGED for other player is ignored
  - PLAYER_DOWNED for localId shows 0
  - RUN_STARTED resets HP to PLAYER_MAX_HP
