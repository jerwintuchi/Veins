# Dungeon Ruleset — Requirements

## R1 — Enemy count scales with floor depth
Each non-entry room spawns more enemies as the party descends deeper.

- AC: Floor 1 rooms spawn 1–2 enemies each
- AC: Floor 3 rooms spawn 2–3 enemies each
- AC: Floor 5+ rooms spawn 3–4 enemies each (cap)
- AC: The count progression is deterministic: same floor → same range

## R2 — Enemy type distribution shifts with depth
Early floors are shambler-dominant (slow, melee). Deeper floors introduce more spitters (fast, ranged).

- AC: On floor 1, the probability of spawning a spitter is ≤ 25%
- AC: On floor 5+, the probability of spawning a spitter is ≥ 55%
- AC: Distribution is seeded: same runId + floor → same types every time

## R3 — One elite room per floor
The deepest room in each floor's dungeon layout (last room in BSP traversal order, never room-0) is designated the elite room.

- AC: Elite room enemies have 2× HP (on top of floor multiplier) and 1.5× damage (on top of floor multiplier)
- AC: Elite room spawns +1 enemy compared to the normal count for that floor
- AC: Room-0 is never the elite room (even if the dungeon has only 2 rooms)
- AC: Elite room designation is deterministic (based on room array index, no extra RNG)

## R4 — Entry room stays clear
Room-0 is always the party entry point. It never spawns enemies.

- AC: spawnEnemies never places an enemy with a room-0 id prefix
- AC: A dungeon with only 1 room (room-0) spawns zero enemies

## Correctness Properties

**P1** — Determinism: same (runId, floor, dungeon) always yields the same enemy map.
**P2** — All spawned enemies are in alive=true state with positive hp and maxHp.
**P3** — No enemy spawns in room-0.
