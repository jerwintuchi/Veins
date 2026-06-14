# Design — Circulatory Board

## Data Models
> These types live in `src/shared/src/board.ts`

```typescript
// Axial hex coordinates. Six neighbors at offsets: (±1,0), (0,±1), (+1,-1), (-1,+1)
type HexCoord = { q: number; r: number };

type RelicId = string;   // UUID
type PlayerId = string;  // UUID, matches Supabase auth id

type RelicTag = 'fire' | 'aoe' | 'party' | 'poison' | 'shield' | 'chain';
// Tags are additive; new tags added to this union as relics are designed

type Effect = {
  description: string;
  // Concrete effect data (damage, heal amount, duration, etc.) defined per-relic
};

type Relic = {
  id: RelicId;
  name: string;
  tags: RelicTag[];
  baseEffect: Effect;      // Always active while on board
  synergyEffect: Effect;   // Active only when synergy fires
};

type RelicSlot = {
  coord: HexCoord;
  ownerId: PlayerId;       // Which player "owns" this slot (determines player color in UI)
  relicId: RelicId | null; // null = slot is empty
};

// Key: hexCoordKey(q, r). Lives in src/server/ as a Map; serialized to object for events.
type RelicBoard = {
  slots: Record<string, RelicSlot>; // key = hexCoordKey(coord)
};

// Result of synergy evaluation: which relics currently have synergy active
type SynergyMap = Record<RelicId, boolean>;
```

## Algorithms

### hexCoordKey(coord)
```
input:  HexCoord { q, r }
output: string — canonical key for Map/Record lookup
impl:   `${q},${r}`
```
Pure. Bijective for integer coords. Lives in `src/shared/src/board.ts`.

### hexNeighbors(coord)
```
input:  HexCoord { q, r }
output: HexCoord[6] — the six axial neighbors
offsets: (+1,0), (-1,0), (0,+1), (0,-1), (+1,-1), (-1,+1)
```
Pure. Lives in `src/shared/src/board.ts`.

### evaluateSynergies(board, registry)
```
input:  RelicBoard, Map<RelicId, Relic>
output: SynergyMap — for each relicId on the board, whether synergy is active

for each slot in board.slots:
  if slot.relicId is null: skip
  relic = registry.get(slot.relicId)
  neighbors = hexNeighbors(slot.coord)
  synergyFires = false
  for each neighbor of neighbors:
    neighborSlot = board.slots[hexCoordKey(neighbor)]
    if neighborSlot is undefined: continue
    if neighborSlot.relicId is null: continue
    if neighborSlot.ownerId === slot.ownerId: continue  // same player, no synergy
    neighborRelic = registry.get(neighborSlot.relicId)
    if relic.tags ∩ neighborRelic.tags is non-empty:
      synergyFires = true
      break
  result[relic.id] = synergyFires

return result
```
Pure function. No side effects. Deterministic. Lives in `src/server/src/board/synergy.ts`.

## Correctness Properties

**P1 (Determinism)**: `evaluateSynergies` is a pure function. Given identical `board` and `registry` arguments, it always returns an identical `SynergyMap`. No global state, no `Math.random()`, no `Date.now()`.

**P2 (Owner isolation)**: A relic adjacent only to relics with the same `ownerId` never has `synergy = true` in the result.

**P3 (Mutual synergy)**: If `evaluateSynergies` returns `true` for relic A due to adjacency with relic B, it also returns `true` for relic B due to adjacency with relic A (assuming tags match).

**P4 (Tag specificity)**: Adjacency alone is not sufficient — there must be at least one shared tag between the two relics for synergy to fire.

**P5 (Order independence)**: The evaluation result is identical regardless of the iteration order of `board.slots`.

## Socket.io Events

**BOARD_STATE_SYNC** (server → client, on room join):
```typescript
{
  board: RelicBoard;         // full current board state
  synergyMap: SynergyMap;    // current synergy evaluation result
  relicRegistry: Record<RelicId, Relic>; // all relics on the board
}
```
Sent to the joining socket only.

**RELIC_PLACED** (server → room, after validated placement or Linked Fates transfer):
```typescript
{
  coord: HexCoord;
  relicId: RelicId;
  ownerId: PlayerId;
  synergyMap: SynergyMap;  // full re-evaluated synergy map for all board relics
}
```

**RELIC_REMOVED** (server → room, before a Linked Fates transfer):
```typescript
{
  coord: HexCoord;
  relicId: RelicId;
  reason: 'linked-fates' | 'run-end';
}
```

**RELIC_PLACE_ERROR** (server → requesting socket only):
```typescript
{
  code: 'SLOT_OCCUPIED' | 'WRONG_PHASE' | 'INVALID_COORD';
  message: string;
}
```

## Board Layout (Initial)
The board is pre-defined per run (not procedurally shaped). Starting layout: 19 hexes in a radius-2 hex grid centered at (0,0). Each player is assigned a "home quadrant" of slots at session start. Board shape is identical every run — only relic placements vary.

## Satisfies Requirements
R1, R2, R3, R4, R5, R6, R7
