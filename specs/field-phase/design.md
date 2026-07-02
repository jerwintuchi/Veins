# Design — Field Phase (Skeleton)

> Phase 3 scope. See `requirements.md` for R# IDs referenced below.
> This design picks up from the point where `ROOM_DEPLOYING` has been broadcast and
> `RoomRecord.phase === 'DEPLOYING'`. It extends the existing lobby-room types and
> handlers without modifying their contracts.

---

## Data Models

All types in this section belong in `src/shared/src/fieldPhase.ts` unless marked
**server-only**, in which case they live in `src/server/src/rooms/`.

### Phase machine extension (shared — extends `src/shared/src/lobby.ts`)

The existing `RoomPhase` union gains two new members:

```typescript
// src/shared/src/lobby.ts  (edit in place)
export type RoomPhase = 'WAITING' | 'DEPLOYING' | 'FIELD' | 'COMPLETE';
```

Full state machine:
```
WAITING ──(ACCEPT_CONTRACT, all ready)──► DEPLOYING
           ──(DEPLOY, leader only)──► FIELD
                    ──(EXTRACT, any player)──► COMPLETE (terminal; room destroyed)
```

No transitions back. COMPLETE is terminal for this spec. The field-mechanics spec
(Phase 5) will add failure paths before the COMPLETE transition.

### Stub field data (shared)

```typescript
// src/shared/src/fieldPhase.ts
export type StubFieldData = {
  fieldId: string;        // placeholder: "FIELD-001"
  siteName: string;       // copied from StubContract.siteName
  incarnateName: string;  // copied from StubContract.targetName
  // NOTE: No traitRoll, no hiddenTraits, no Aspect, no Frailty, no Ward, no signs.
  // Those live server-side only. This type must never carry them (R26, I5).
};
```

### Stub archive entry (shared)

```typescript
export type StubArchiveEntry = {
  contractId: string;   // from StubContract.contractId
  targetName: string;   // from StubContract.targetName
  siteName: string;     // from StubContract.siteName
  outcome: 'success';   // skeleton: always success (Phase 5 adds 'failure')
  notes: string;        // placeholder: "No observations recorded."
};
```

### Stub testament (shared)

```typescript
export type StubTestament = {
  expeditionId: string;        // UUID v4 generated server-side at extraction
  contractId: string;          // from StubContract.contractId
  outcome: 'success';          // skeleton: always success
  entries: StubArchiveEntry[]; // one entry per contract target (stub: always one)
  // NOTE: No traitRoll, no hiddenTraits. Invariant I5 / R26.
};
```

### Field snapshot (shared — used in STATE_RESYNC during FIELD phase)

Rather than widening `LobbySnapshot` (which belongs to the lobby system), a separate
`FieldSnapshot` type is defined and included alongside the existing `LobbySnapshot`
in the `STATE_RESYNC` payload when the room is in FIELD phase. This keeps the lobby
type clean and allows the field-mechanics spec to extend `FieldSnapshot` independently.

```typescript
export type FieldSnapshot = {
  fieldData: StubFieldData;
  archiveEntries: StubArchiveEntry[]; // current session archive at reconnect time
};
```

The `StateResyncPayload` (defined in `src/shared/src/lobbyMessages.ts`) is extended:

```typescript
// src/shared/src/lobbyMessages.ts  (edit in place)
import type { FieldSnapshot } from './fieldPhase.js';

export type StateResyncPayload = {
  snapshot: LobbySnapshot;      // phase will be 'FIELD' when in field phase
  fieldSnapshot: FieldSnapshot | null; // null when phase is WAITING or DEPLOYING
  reconnectToken: string;
};
```

`fieldSnapshot` is `null` whenever the room is in WAITING or DEPLOYING phase. It is
populated when the room is in FIELD phase. After COMPLETE the room is destroyed, so
STATE_RESYNC is never emitted for a COMPLETE room (the reconnect handler will find no
room and emit LOBBY_ERROR ROOM_NOT_FOUND, consistent with R25 and existing R13 logic).

### New error codes (shared — extends `LobbyErrorCode` in `src/shared/src/lobbyMessages.ts`)

Two new codes are added to the `LobbyErrorCode` union:

```typescript
export type LobbyErrorCode =
  // ... existing codes ...
  | 'WRONG_PHASE';  // action not valid in the room's current phase (R21, R23)
  // NOT_IN_ROOM and NOT_LEADER are already present
```

`WRONG_PHASE` replaces the need for `ALREADY_DEPLOYING` in the new phase-aware
handlers. The existing `ALREADY_DEPLOYING` code is kept for backward compatibility
with the JOIN_ROOM handler.

### Server-only room record extension

`RoomRecord` in `src/server/src/rooms/types.ts` gains a `fieldData` field:

```typescript
// src/server/src/rooms/types.ts  (edit in place)
export type RoomRecord = {
  code: RoomCode;
  phase: RoomPhase;       // now 'WAITING' | 'DEPLOYING' | 'FIELD' | 'COMPLETE'
  players: ServerPlayerEntry[];
  contract: StubContract | null;
  fieldData: StubFieldData | null; // null until DEPLOY succeeds; set server-side
};
```

`fieldData` is `null` in WAITING and DEPLOYING phases. It is populated when the
server processes DEPLOY and must not be derived from any client-supplied field.

### Session Archive (server-only)

```typescript
// src/server/src/rooms/SessionArchive.ts  (new file, server-only)
// In-process memory only — never persisted (I7, R30).
export class SessionArchive {
  private archives = new Map<RoomCode, StubArchiveEntry[]>();

  append(roomCode: RoomCode, entries: StubArchiveEntry[]): void;
  getEntries(roomCode: RoomCode): StubArchiveEntry[];
  destroyArchive(roomCode: RoomCode): void;
}
```

`destroyArchive` is called alongside `RoomManager.destroyRoom` when a room reaches
COMPLETE (R27, R30). The `SessionArchive` instance is co-located with `RoomManager`
in the server bootstrap and passed to handlers that need it.

---

## Algorithms

### A6 — Build StubFieldData from StubContract

**Input:** `contract: StubContract`
**Output:** `StubFieldData`

```
function buildStubFieldData(contract: StubContract): StubFieldData
  return {
    fieldId: 'FIELD-001',
    siteName: contract.siteName,
    incarnateName: contract.targetName,
  }
```

Pure function; no side effects. Lives in `src/server/src/rooms/fieldData.ts`.

### A7 — Build StubTestament from RoomRecord

**Input:** `room: RoomRecord` (must be in FIELD phase with non-null `contract`)
**Output:** `StubTestament`

```
function buildStubTestament(room: RoomRecord): StubTestament
  assert room.contract !== null
  entry: StubArchiveEntry = {
    contractId: room.contract.contractId,
    targetName: room.contract.targetName,
    siteName: room.contract.siteName,
    outcome: 'success',
    notes: 'No observations recorded.',
  }
  return {
    expeditionId: randomUUID(),     // crypto.randomUUID(), server-side only
    contractId: room.contract.contractId,
    outcome: 'success',
    entries: [entry],
  }
```

`randomUUID()` here is identity generation (not seeded RNG). Lives in
`src/server/src/rooms/testament.ts`. Pure except for UUID generation.

### A8 — Build FieldSnapshot for STATE_RESYNC

**Input:** `room: RoomRecord`, `archive: SessionArchive`
**Output:** `FieldSnapshot | null`

```
function buildFieldSnapshot(room: RoomRecord, archive: SessionArchive): FieldSnapshot | null
  if room.phase !== 'FIELD': return null
  assert room.fieldData !== null
  return {
    fieldData: room.fieldData,
    archiveEntries: archive.getEntries(room.code),
  }
```

Lives in `src/server/src/rooms/snapshot.ts` alongside the existing `toSnapshot`.

### A9 — Phase guard helper

**Input:** `room: RoomRecord | undefined`, `expected: RoomPhase`, `emit: EmitFn`
**Output:** `room is RoomRecord` (type predicate)

```
function assertPhase(
  room: RoomRecord | undefined,
  expected: RoomPhase,
  emit: EmitFn,
): room is RoomRecord
  if room === undefined:
    emit('LOBBY_ERROR', { code: 'NOT_IN_ROOM', message: '...' })
    return false
  if room.phase !== expected:
    emit('LOBBY_ERROR', { code: 'WRONG_PHASE',
      message: `Expected ${expected}, room is in ${room.phase}.` })
    return false
  return true
```

Lives in `src/server/src/rooms/phaseGuard.ts`. Reduces boilerplate in handlers.

---

## Correctness Properties

**P6**: Field-phase server authority — `StubFieldData` is always constructed
server-side from the server's `StubContract`. No client-supplied field is used to
populate field state. [R19, R29, I1, I2]

**P7**: Trait-roll-never-on-wire in field phase — `StubFieldData`, `StubArchiveEntry`,
and `StubTestament` contain no field representing hidden Incarnate properties
(traitRoll, hiddenTraits, Aspect, Frailty, Ward, etc.). The TypeScript type system
enforces this structurally from day one even though no real Incarnate exists yet.
[R26, I5, CLAUDE.md invariant 3]

**P8**: Phase machine strictness — every field-phase handler validates the room's
current phase before any mutation. A handler expecting DEPLOYING will reject the
message if the phase is anything else. Handlers are not defensive about which error
code to emit; the phase guard (A9) emits WRONG_PHASE consistently. [R21, R23, R29]

**P9**: Sequential broadcast order — FIELD_TESTAMENT is always broadcast before
ARCHIVE_UPDATED. A handler must not reverse this order. [R24]

**P10**: Archive ephemerality — `SessionArchive` holds state in a `Map` keyed by
room code. `destroyArchive(code)` is called in the same synchronous operation as
`RoomManager.destroyRoom(code)` to prevent orphan entries. [R27, R30, I7]

**P11**: Delta-only in field phase — FIELD_STARTED is broadcast exactly once per
transition. Subsequent events (FIELD_TESTAMENT, ARCHIVE_UPDATED) are delta events
triggered by explicit player actions. No periodic full-state push occurs. [R32, I6]

---

## Wire-Protocol Messages

All messages use the shared envelope:
```json
{ "type": "EVENT_NAME", "payload": { ... } }
```

Event names are SCREAMING_SNAKE_CASE. Types below show the `payload` shape.
New payload types live in `src/shared/src/fieldMessages.ts` (new file, imported by
the message router; this keeps field-phase messages separate from lobby-phase messages
and allows the field-mechanics spec to extend them without touching lobby types).

### Client → Server

**DEPLOY** (client → server):
```json
{}
```
Empty payload. When received: look up room by socketId; validate phase is DEPLOYING;
validate sender is leader; build `StubFieldData` from room's contract; transition room
to FIELD; broadcast FIELD_STARTED to room; issue fresh reconnect tokens to all
players. (Fresh tokens are required because the reconnect path must return FIELD phase
state — see R25.)

Note on token refresh: at DEPLOY, each player's token is invalidated and a new one
issued and included in the FIELD_STARTED payload (one token per player, delivered
separately). This matches the pattern from ROOM_CREATED / JOIN_ROOM.

---

**EXTRACT** (client → server):
```json
{}
```
Empty payload. When received: look up room by socketId; validate phase is FIELD;
build `StubTestament`; transition room to COMPLETE; broadcast FIELD_TESTAMENT; append
testament entries to `SessionArchive`; broadcast ARCHIVE_UPDATED; destroy room and
archive.

---

### Server → Client

**FIELD_STARTED** (server → room broadcast, delta):
```json
{
  "fieldData": StubFieldData,
  "reconnectToken": "string"
}
```
Emitted once when the room transitions from DEPLOYING to FIELD. Each player receives
their own copy with their own `reconnectToken`. Because different players hold
different tokens, this is delivered via per-player emit rather than a single
broadcast. Implementers: loop over `room.players`, issue a token for each, emit
FIELD_STARTED individually. [R19, P11]

---

**FIELD_TESTAMENT** (server → room broadcast):
```json
{
  "testament": StubTestament
}
```
Emitted once when the room transitions from FIELD to COMPLETE. Broadcast to all
players simultaneously. Contains no hidden Incarnate fields. [R22, P7]

---

**ARCHIVE_UPDATED** (server → room broadcast, delta):
```json
{
  "entries": StubArchiveEntry[]
}
```
Emitted immediately after FIELD_TESTAMENT, before room destruction. Contains the
full current Archive snapshot for the room (all entries accumulated in the session,
including the one just written). [R24, P9, P10]

---

**STATE_RESYNC** (server → reconnecting socket only) — extended:
```json
{
  "snapshot": LobbySnapshot,
  "fieldSnapshot": FieldSnapshot | null,
  "reconnectToken": "string"
}
```
`fieldSnapshot` is `null` when the room is in WAITING or DEPLOYING phase.
It is populated when the room is in FIELD phase. After COMPLETE the room is destroyed;
the reconnect handler emits LOBBY_ERROR `ROOM_NOT_FOUND` instead. [R25, P11]

---

**LOBBY_ERROR** (server → requesting socket only, never broadcast) — extended:
```json
{
  "code": "... | WRONG_PHASE",
  "message": "string (human-readable, for debug)"
}
```
`WRONG_PHASE` is the new code added for field-phase guard failures. All existing
codes remain. [R21, R23, R28, R29]

---

## New Payload Types (`src/shared/src/fieldMessages.ts`)

```typescript
import type { StubFieldData, StubTestament, StubArchiveEntry, FieldSnapshot } from './fieldPhase.js';

// ── Client → Server ───────────────────────────────────────────────────────────

export type DeployPayload = Record<string, never>;

export type ExtractPayload = Record<string, never>;

// ── Server → Client ───────────────────────────────────────────────────────────

export type FieldStartedPayload = {
  fieldData: StubFieldData;
  reconnectToken: string;   // per-player token; delivered individually, not as a broadcast
};

export type FieldTestamentPayload = {
  testament: StubTestament;
};

export type ArchiveUpdatedPayload = {
  entries: StubArchiveEntry[];
};
```

The `StateResyncPayload` in `src/shared/src/lobbyMessages.ts` is edited in-place to
add the `fieldSnapshot: FieldSnapshot | null` field (see Data Models above).

---

## Satisfies Requirements

R19, R20, R21, R22, R23, R24, R25, R26, R27, R28, R29, R30, R31, R32
