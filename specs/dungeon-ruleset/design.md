# Dungeon Ruleset — Design

## Scope
All changes are confined to `src/server/src/combat/spawn.ts`. No new types, no new events, no shared changes. The existing `spawnEnemies(runId, floor, dungeon, rng?)` signature is preserved.

## Enemy Count Range — `countRange(floor)`
```
floor 1-2 → min=1, max=2
floor 3-4 → min=2, max=3
floor 5+  → min=3, max=4  (capped)
```
Formula: `extra = min(Math.floor((floor-1)/2), 2)`; `min=1+extra`, `max=2+extra`.

## Enemy Type Distribution — `pickEnemyType(floor, rng)`
Spitter probability: `min(0.7, 0.15 + 0.1 * (floor - 1))`
```
floor 1 → 15% spitter / 85% shambler
floor 2 → 25% spitter
floor 3 → 35% spitter
floor 5 → 55% spitter
floor 7+ → 70% spitter (cap)
```
Implementation: `rng.float() < spitterProb ? 'spitter' : 'shambler'`

## Elite Room — Designation
The elite room is `dungeon.rooms[dungeon.rooms.length - 1]`, i.e. the last room in BSP traversal order. This is always the spatially furthest leaf from room-0 in the spanning tree.

Guard: if `dungeon.rooms.length < 2` (only room-0), no elite room exists.
If the last room IS room-0 (single-room dungeon), no elite room.

## Elite Room — Stats
```
eliteHpMult   = 2.0  (stacks multiplicatively with floorHpMultiplier)
eliteDmgMult  = 1.5  (stacks multiplicatively with floorDmgMultiplier)
eliteCountBonus = +1 (added to max count; min unchanged)
```

## spawnEnemies — Updated Logic
```
spawnRooms = dungeon.rooms.slice(1)  // skip room-0
eliteRoom  = last room that is not room-0 (dungeon.rooms[dungeon.rooms.length-1])

for each room in spawnRooms:
  isElite = (room === eliteRoom)
  { min, max } = countRange(floor)
  count = rng.int(min, isElite ? max + 1 : max)
  for i in range(count):
    typeId = pickEnemyType(floor, rng)
    hp     = Math.round(def.baseHp  * floorHpMult  * (isElite ? 2.0 : 1.0))
    damage = Math.round(def.damage  * floorDmgMult  * (isElite ? 1.5 : 1.0))
    ...
```

## Invariants
- I1: server-only — no shared type changes.
- I3: seeded RNG — same (runId#floor#spawn) seed always yields same result.
- spawn.test.ts: all new ACs have named tests.
