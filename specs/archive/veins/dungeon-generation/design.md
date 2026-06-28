# Design — Dungeon Generation

## Data Models
> These types live in `src/shared/src/dungeon.ts` (types only, per invariant I4)

```typescript
type Point = { x: number; y: number };

type Rect = { x: number; y: number; width: number; height: number };

type DungeonRoomId = string; // "room-0", "room-1", ... assigned by traversal order

type DungeonRoom = {
  id: DungeonRoomId;
  rect: Rect;
};

// A corridor connects two rooms. It carries both the room ids (for graph /
// connectivity reasoning) and the geometric endpoints (room centers) so the
// client can render an L-shaped passage between them.
type Corridor = {
  fromRoomId: DungeonRoomId;
  toRoomId: DungeonRoomId;
  from: Point;
  to: Point;
};

type DungeonLayout = {
  runId: string;
  width: number;
  height: number;
  rooms: DungeonRoom[];
  corridors: Corridor[];
};

type DungeonConfig = {
  width: number;
  height: number;
  minLeafSize: number; // a leaf smaller than this is not split further
  maxDepth: number;    // hard cap on BSP recursion depth
  roomPadding: number; // gap between a room and its leaf boundary (>= 1)
};
```

## Algorithms

### Seeded RNG (`src/server/src/rng/seeded.ts`)
Server-only (invariant I3). No `Math.random()`.

```
hashSeed(str): number
  - Deterministic string -> uint32 hash (xfnv1a-style). Maps the runId (UUID
    string) to a numeric seed.

createRng(seed: number): Rng
  - Returns a mulberry32 PRNG closure. Same seed -> identical value sequence.
  - Rng exposes: float() in [0,1), int(min,max) inclusive, pick(array).
```

mulberry32 is chosen for being tiny, fast, deterministic, and dependency-free.

### BSP Generation (`src/server/src/dungeon/bsp.ts`)

```
generateDungeon(runId, config): DungeonLayout
  rng = createRng(hashSeed(runId))
  root = { x:0, y:0, width:config.width, height:config.height }
  result = buildNode(root, depth=0, config, rng, idCounter)
  return { runId, width, height, rooms: result.rooms, corridors: result.corridors }

buildNode(rect, depth, config, rng, idCounter): { rooms, corridors, rep }
  if depth >= maxDepth OR rect too small to split into two valid leaves:
    room = placeRoomInLeaf(rect, config, rng)   // leaf -> one room
    return { rooms:[room], corridors:[], rep: room }

  (axis, splitPos) = chooseSplit(rect, rng, config)
  (left, right) = split rect along axis at splitPos
  L = buildNode(left, depth+1, ...)
  R = buildNode(right, depth+1, ...)
  corridor = connect(L.rep, R.rep)             // L-shaped between room centers
  return {
    rooms: [...L.rooms, ...R.rooms],
    corridors: [...L.corridors, ...R.corridors, corridor],
    rep: L.rep
  }
```

- **placeRoomInLeaf**: room rect inset from the leaf by `roomPadding` on all
  sides, with a randomized smaller size/offset inside the padded area. Room is
  always strictly within the leaf, so rooms in disjoint leaves never overlap.
- **chooseSplit**: pick axis (prefer splitting the longer side; tie broken by
  rng) and a split position in the middle band of the rect so both halves stay
  >= minLeafSize.
- **connect**: builds a `Corridor` linking the two subtree representative rooms
  using their centers as `from`/`to`. Because every internal node connects its
  two children, the final room+corridor graph is a spanning tree -> fully
  connected (R4).

## Correctness Properties

**P1 (Determinism)**: `generateDungeon(runId, config)` is a pure function of its arguments. Identical inputs produce a deeply-equal `DungeonLayout`. All randomness flows from `createRng(hashSeed(runId))`.

**P2 (In-bounds)**: every room rect is fully contained in `[0,0]..[width,height]`.

**P3 (Non-overlap)**: no two room rects overlap. Guaranteed because BSP leaves are pairwise-disjoint and each room sits strictly inside its leaf.

**P4 (Connectivity)**: the graph (rooms = nodes, corridors = edges) is connected. Guaranteed because generation emits a spanning tree of corridors over the rooms.

**P5 (RNG purity)**: the RNG and generation read no global state, call no `Math.random()` / `Date.now()`, and have no side effects on their inputs.

## Socket.io Events
Generation runs server-side at run start. The resulting `DungeonLayout` is sent to clients via a `DUNGEON_LAYOUT` event (full snapshot, once per floor, analogous to `BOARD_STATE_SYNC`). The seed/runId-to-layout mapping stays on the server; clients receive only the resulting geometry. Wiring is deferred to the multiplayer/rooms spec.

**DUNGEON_LAYOUT** (server -> client, on floor start):
```typescript
{ layout: DungeonLayout }
```

## Satisfies Requirements
R1, R2, R3, R4, R5, R6, R7
