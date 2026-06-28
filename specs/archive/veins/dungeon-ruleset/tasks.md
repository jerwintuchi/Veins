# Dungeon Ruleset — Tasks

- [x] T1 [R1, P1] — Implement `countRange(floor)` and update enemy count in `spawnEnemies`
  Test: `spawn.test.ts` — floor 1 gives 1-2 enemies, floor 3 gives 2-3, floor 5 gives 3-4; determinism

- [x] T2 [R2, P1] — Implement `pickEnemyType(floor, rng)` and replace random pick in `spawnEnemies`
  Test: `spawn.test.ts` — floor 1 spitter rate ≤ 25%; floor 5+ spitter rate ≥ 55%; seeded determinism

- [x] T3 [R3, P2] — Implement elite room designation and stat multipliers in `spawnEnemies`
  Test: `spawn.test.ts` — elite room gets 2× HP, 1.5× damage, +1 enemy count; room-0 never elite; single-room dungeon has no elite

- [x] T4 [R4, P3] — Verify entry-room guard (already in code; add explicit test)
  Test: `spawn.test.ts` — single-room dungeon (only room-0) spawns zero enemies
