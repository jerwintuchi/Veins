# Tasks — Combat HUD

---

- [x] T1 [R1, R2, R3] — Add enemy count + all-player HP to HUD; add `players`
  prop; wire new socket events.
  Test: `src/client/src/components/HUD.test.tsx` (extended)
  - ENEMY_SPAWNED increments enemy-count
  - ENEMY_DIED decrements enemy-count (floor at 0)
  - FLOOR_ADVANCED resets count to 0
  - PHASE_CHANGED loot resets count to 0
  - RUN_STARTED resets count to 0
  - teammate-hp-{id} rendered for each player in players prop
  - PLAYER_DAMAGED updates correct player's element
  - PLAYER_DOWNED sets hp to 0 for correct player
  - PLAYER_REVIVED restores hp to PLAYER_MAX_HP for correct player
  - existing player-hp element still present for localPlayerId
