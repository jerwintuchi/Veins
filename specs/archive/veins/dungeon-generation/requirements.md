# Requirements — Dungeon Generation

Seeded BSP-tree dungeon generation. Runs server-side only. Deterministic from the run ID so the same run always produces the same dungeon (enables daily challenges and bug reproduction).

---

**R1**: As the server, I generate a dungeon deterministically from a run ID so the same run ID always yields the same dungeon.
- AC: `generateDungeon(runId, config)` called twice with identical arguments returns deeply-equal layouts
- AC: two different run IDs produce different layouts (room rects differ)

**R2**: As a player, the dungeon contains multiple non-overlapping rooms so the space is varied and navigable.
- AC: a generated layout contains at least 2 rooms for a standard config
- AC: no two room rectangles overlap

**R3**: As the server, every room fits entirely within the configured map bounds so nothing generates off-map.
- AC: every room rect lies fully within `[0,0]` to `[width,height]`

**R4**: As a player, every room is reachable from every other room via corridors so no area is stranded.
- AC: the graph formed by rooms (nodes) and corridors (edges) is fully connected
- AC: the number of corridors is at least (room count - 1)

**R5**: As the server, dungeon generation uses only the seeded RNG, never `Math.random()` or `Date.now()`, so determinism (netcode invariant I3) holds.
- AC: generation output depends solely on `(runId, config)`
- AC: no `Math.random()` / `Date.now()` in the generation or RNG code

**R6**: As the server, generation completes fast enough to never stall the game loop (target < 5ms for a standard dungeon).
- AC: generating a standard dungeon completes well under the time budget (loose timing assertion)

**R7**: As the server, the seeded RNG is itself deterministic and produces values in a known range so all downstream procedural systems (loot, spawns) can rely on it.
- AC: `createRng(seed)` produces an identical sequence for the same seed
- AC: `rngFloat` returns values in `[0, 1)`; `rngInt(min, max)` returns integers in `[min, max]` inclusive
- AC: `hashSeed(str)` is deterministic and maps distinct typical strings to distinct seeds
