# Tasks — Dungeon Generation

Order: seeded RNG -> shared types -> BSP rooms -> corridors/connectivity -> top-level assembly.
Each task cites R# and names its test before implementation.

---

- [x] T1 [R5, R7, P1, P5] — Implement seeded RNG in `src/server/src/rng/seeded.ts`: `hashSeed(str)`, `createRng(seed)` (mulberry32) exposing `float()`, `int(min,max)`, `pick(array)`.
  Test: `src/server/src/rng/seeded.test.ts`
  - same seed produces an identical sequence (determinism)
  - different seeds produce different sequences
  - `float()` always in [0, 1)
  - `int(min,max)` always within [min,max] inclusive, hits both endpoints over many draws
  - `hashSeed` deterministic; distinct typical strings produce distinct seeds
  - no `Math.random` / `Date.now` references in the module

- [x] T2 [R1, R2] — Define `Point`, `Rect`, `DungeonRoom`, `Corridor`, `DungeonLayout`, `DungeonConfig` types in `src/shared/src/dungeon.ts`; export from index.
  Test: `src/shared/src/dungeon.test.ts`
  - types compile under strict mode (compile-time smoke test instantiating each type)

- [x] T3 [R2, R3, P2, P3] — Implement BSP split + room placement (rooms only, no corridors yet) in `src/server/src/dungeon/bsp.ts`.
  Test: `src/server/src/dungeon/bsp.test.ts`
  - produces >= 2 rooms for a standard config
  - every room rect is within map bounds (P2)
  - no two rooms overlap (P3) — checked pairwise across the full room list
  - room count is stable for a fixed seed

- [x] T4 [R4, P4] — Implement corridor connection so the room graph is a spanning tree, in `src/server/src/dungeon/bsp.ts`.
  Test: `src/server/src/dungeon/bsp.test.ts`
  - corridor count >= room count - 1
  - the rooms+corridors graph is fully connected (BFS/union-find reachability from room 0 reaches all rooms)
  - each corridor references two distinct existing room ids

- [x] T5 [R1, R6, P1] — Implement `generateDungeon(runId, config)` top-level assembly in `src/server/src/dungeon/bsp.ts`; export public API.
  Test: `src/server/src/dungeon/bsp.test.ts`
  - same runId + config -> deeply-equal layout (P1 determinism)
  - different runIds -> different layouts
  - generation completes well under the 5ms budget for a standard config (loose perf assertion)
