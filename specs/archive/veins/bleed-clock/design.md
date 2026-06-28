# Design — Bleed Clock

## Data Models

### Shared (`src/shared/src/bleedClock.ts`, types + constants)
```typescript
// Moved here from server state so the client can render the clock (I4: types only).
type BleedClockState = {
  current: number;       // remaining dungeon HP
  max: number;
  drainPerSecond: number;
};

type RunOutcome = 'extracted' | 'wiped';

const BLEED_TICK_INTERVAL_MS = 1000; // server broadcast cadence
```

### Shared events (`src/shared/src/events.ts`)
```typescript
type BleedClockTickEvent = { clock: BleedClockState };
type RunEndedEvent = { outcome: RunOutcome; finalFloor: number };
```

### Server room state (`src/server/src/room/state.ts`)
`Room.bleedClock` is retyped to the shared `BleedClockState`. `Room` gains `outcome: RunOutcome | null` (null until the run ends).

## Algorithms

### tickBleedClock (`src/server/src/bleed/clock.ts`)
Pure. The single source of drain math.
```
tickBleedClock(clock, deltaSeconds): { clock: BleedClockState; depleted: boolean }
  next = clock.current - clock.drainPerSecond * deltaSeconds
  current = max(0, next)            // R5 clamp
  depleted = current <= 0           // R3
  return { clock: { ...clock, current }, depleted }
```

### advanceBleedForRoom (`src/server/src/bleed/clock.ts`)
Applies one tick to a room and resolves run-end on depletion.
```
advanceBleedForRoom(room, dt): { tick: BleedClockTickEvent; ended: RunEndedEvent | null }
  { clock, depleted } = tickBleedClock(room.bleedClock, dt)
  room.bleedClock = clock
  if depleted and room.status === 'in-progress':
    room.status = 'ended'; room.outcome = 'wiped'
    return { tick, ended: { outcome: 'wiped', finalFloor: room.floor } }
  return { tick, ended: null }
```

### extractRun (`src/server/src/bleed/clock.ts`)
```
extractRun(room): { ok: true; ended: RunEndedEvent } | { ok: false }
  if room.status !== 'in-progress': return { ok: false }   // R7 reject
  room.status = 'ended'; room.outcome = 'extracted'
  return { ok: true, ended: { outcome: 'extracted', finalFloor: room.floor } }
```

### Depth scaling (existing)
`drainRateForFloor(floor)` (in `room/state.ts`) already returns a rate that increases with depth. `advanceFloor` already updates `drainPerSecond` while preserving `current` (R6). The Bleed Clock spec re-tests these against R2/R6.

## RoomManager integration (`src/server/src/room/manager.ts`)
- `activeRooms(): Room[]` — rooms with status `in-progress` (drives the tick loop).
- `tickRoom(code, dt)` — wraps `advanceBleedForRoom` for a room by code.
- `extractRoom(code)` — wraps `extractRun` for a room by code.

## Socket.io wiring (`src/server/src/index.ts`)
- A server game loop (`setInterval`, `BLEED_TICK_INTERVAL_MS`) iterates `manager.activeRooms()`, applies a tick, broadcasts `BLEED_CLOCK_TICK` to each room, and on depletion broadcasts `RUN_ENDED`.
- New inbound handler `extract`: validates the requester is in an in-progress room, calls `extractRoom`, broadcasts `RUN_ENDED`.
- The loop is thin plumbing; the drain math and run-end transitions are unit-tested in `bleed/clock.test.ts` and `manager.test.ts`. The loop is started by `startServer` (guarded out of tests).

## Correctness Properties
**P1 (Purity/Determinism)**: `tickBleedClock` is pure; identical inputs yield identical outputs; no global state, no `Date.now()`/`Math.random()`.
**P2 (Non-negative)**: `current` is always clamped to `>= 0`.
**P3 (Depth monotonicity)**: `drainRateForFloor` is strictly increasing in floor.
**P4 (Tension carry-over)**: `advanceFloor` preserves `current` while raising `drainPerSecond`.
**P5 (Terminal once)**: a run ends exactly once — depletion only transitions an `in-progress` room; an already-`ended` room is not re-ended.

## Satisfies Requirements
R1, R2, R3, R4, R5, R6, R7, R8
