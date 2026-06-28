# Design — Per-Floor Loot Drops

## Constants

```typescript
// src/server/src/loot/pool.ts
export const LOOT_POOL_SIZE = 3;
```

## `generateLootPool`

```typescript
import { createRng, hashSeed } from '../rng/seeded.js';
import type { RelicBoard, RelicId } from '@veins/shared';

export function generateLootPool(
  registryIds: RelicId[],        // all relics in the run registry
  board: RelicBoard,
  runId: string,
  floor: number
): RelicId[] {
  const placed = new Set(
    Object.values(board.slots).map(s => s.relicId).filter((id): id is string => id !== null)
  );
  const available = registryIds.filter(id => !placed.has(id));
  const rng = createRng(hashSeed(`${runId}#${floor}#loot`));
  // Fisher-Yates shuffle with seeded RNG.
  const shuffled = [...available];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled.slice(0, LOOT_POOL_SIZE);
}
```

## Room state addition (`src/server/src/room/state.ts`)

```typescript
// Current floor's loot pool — relics available to place this floor.
// Reset by generateLootPool on run start and on each loot phase entry.
lootPool: RelicId[];
```

`createRoom` initialises `lootPool: []`.
`startRun` sets `lootPool = generateLootPool([...room.registry.keys()], board, runId, 1)`.

## Shared type additions

### `events.ts` — `RelicPlaceErrorEvent`

```typescript
export type RelicPlaceErrorEvent = {
  code: 'SLOT_OCCUPIED' | 'WRONG_PHASE' | 'INVALID_COORD' | 'NOT_OWNER' | 'RELIC_NOT_IN_POOL';
  message: string;
};
```

### `events.ts` — `PhaseChangedEvent`

```typescript
export type PhaseChangedEvent = {
  phase: GamePhase;
  lootPool?: RelicId[];  // present only when phase === 'loot'
};
```

### `lobby.ts` — `RunStartedEvent`

```typescript
export type RunStartedEvent = {
  dungeon: DungeonLayout;
  board: RelicBoard;
  synergyMap: SynergyMap;
  lootPool: RelicId[];   // added
};
```

## Server wiring (`src/server/src/index.ts`)

### `RUN_STARTED` emission

```typescript
io.to(code).emit('RUN_STARTED', {
  dungeon: res.dungeon,
  board: res.room.board,
  synergyMap: evaluateSynergies(res.room.board, res.room.registry),
  relicRegistry: Object.fromEntries(res.room.registry),
  lootPool: res.room.lootPool,
});
```

### `PHASE_CHANGED` emission

```typescript
if (res.phaseChanged) {
  room.lootPool = generateLootPool([...room.registry.keys()], room.board, room.runId, room.floor);
  io.to(room.code).emit('PHASE_CHANGED', { phase: 'loot', lootPool: room.lootPool });
}
```

### `place-relic` handler — loot pool validation

```typescript
// After existing req validation, before calling placeRelic:
if (!room.lootPool.includes(req.relicId)) {
  socket.emit('RELIC_PLACE_ERROR', {
    code: 'RELIC_NOT_IN_POOL',
    message: 'That relic is not in the current loot pool.',
  });
  return;
}
// On success, remove from pool:
room.lootPool = room.lootPool.filter(id => id !== req.relicId);
```

## Client changes (`src/client/src/components/BoardPanel.tsx`)

### State

```typescript
const [lootPool, setLootPool] = useState<string[]>(initialLootPool ?? []);
```

### Socket events

| Event | Action |
|---|---|
| `RUN_STARTED` | `setLootPool(ev.lootPool ?? [])` |
| `BOARD_STATE_SYNC` | `setLootPool(ev.lootPool ?? [])` |
| `PHASE_CHANGED` | if `ev.lootPool`, `setLootPool(ev.lootPool)` |
| `RELIC_PLACED` | remove `ev.relicId` from `lootPool` |

### RelicTray filter

```typescript
const available = lootPool
  .map(id => registry[id])
  .filter((r): r is Relic => r !== undefined && !placedIds.has(r.id));
```

## Correctness Properties

**P1 (Seeded determinism)**: `generateLootPool` uses `createRng(hashSeed(\`\${runId}#\${floor}#loot\`))`.
Same inputs → same pool, always (I3).

**P2 (Server authority)**: Loot pool is generated and stored server-side. The
client cannot influence which relics are offered.

**P3 (No double-placement)**: On successful `place-relic`, the relic is
removed from `room.lootPool`. A second `place-relic` for the same relic
fails with `RELIC_NOT_IN_POOL`.

---

## Satisfies Requirements

R1, R2, R3, R4, R5
