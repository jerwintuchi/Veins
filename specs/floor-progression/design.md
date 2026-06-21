# Design — Floor Progression

## Data Models

### Shared events (`src/shared/src/events.ts`)
```typescript
type FloorAdvancedEvent = { floor: number; dungeon: DungeonLayout };
```

## Algorithms

### Floor-aware dungeon seeding (`src/server/src/dungeon/bsp.ts`)
`generateDungeon` gains an optional `floor` (default 1). The seed folds the floor
into the run id so each floor of a run is a distinct-but-deterministic dungeon,
while the layout's `runId` field stays the bare run id.
```
generateDungeon(runId, config = STANDARD, floor = 1): DungeonLayout
  rng = createRng(hashSeed(`${runId}#${floor}`))
  ... (unchanged BSP)
  return { runId, width, height, rooms, corridors }
```
Floor 1 still seeds deterministically (`runId#1`); existing call sites that omit
`floor` are unaffected in behaviour (same inputs -> same output).

### descendFloor (`src/server/src/floor/progression.ts`)
Mutates the room in place (the manager holds the reference). Reuses the pure
`advanceFloor` for the floor/drain/board/clock carry-over, then generates the new
floor's dungeon and sets the combat phase.
```
descendFloor(room, config = STANDARD): { ok: true; event: FloorAdvancedEvent } | { ok: false }
  if room.status !== 'in-progress': return { ok: false }   // R4
  next = advanceFloor(room)                 // floor+1, drain raised, board + clock.current preserved
  room.floor = next.floor
  room.bleedClock = next.bleedClock
  room.phase = 'combat'                      // R6
  dungeon = generateDungeon(room.runId, config, room.floor)  // R2
  return { ok: true, event: { floor: room.floor, dungeon } }
```
`room.board` is never touched (R3). `bleedClock.current` is carried by
`advanceFloor` (only `drainPerSecond` changes).

## RoomManager integration (`src/server/src/room/manager.ts`)
- `descendRoom(code)` — looks up the room and wraps `descendFloor`; returns
  `{ ok: false }` for an unknown room.

## Socket.io wiring (`src/server/src/index.ts`)
- New inbound handler `descend`: requires the socket be in an active room, calls
  `manager.descendRoom(code)`, and on success broadcasts `FLOOR_ADVANCED` to the
  room; on failure emits a targeted `LOBBY_ERROR`.

## Correctness Properties
**P1 (Determinism)**: per-floor dungeon is a pure function of `(runId, floor, config)`.
**P2 (Carry-over)**: descending preserves `board` and `bleedClock.current`; only floor, drain rate, phase, and dungeon change.
**P3 (Server authority)**: only an in-progress room descends; rejection mutates nothing.
**P4 (Delta)**: `FLOOR_ADVANCED` is a delta event, not a full resync.

## Satisfies Requirements
R1, R2, R3, R4, R5, R6
