# Design — Lobby & Room

> Phase 3 scope. See `requirements.md` for R# IDs referenced below.

---

## Data Models

All types in this section belong in `src/shared/src/lobby.ts` unless marked
**server-only**, in which case they live in `src/server/src/rooms/`.

### Constants (shared)

```typescript
// src/shared/src/lobby.ts
export const MAX_ROOM_PLAYERS = 4;
export const MIN_PLAYERS_TO_START = 1;
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1
```

### Identifiers (shared)

```typescript
export type PlayerId = string;   // server-assigned opaque identifier, never client-chosen
export type RoomCode = string;   // 6-char alphanumeric
```

### Room phase (shared)

```typescript
export type RoomPhase = 'WAITING' | 'DEPLOYING';
```

Phase machine:
```
WAITING ──(all ready + leader accepts contract)──► DEPLOYING
  ▲
  │  (any player leaves while WAITING: stays WAITING, leader may transfer)
  └──────────────────────────────────────────────────────────────────────
```
There is no transition back from DEPLOYING in this spec. The field-phase spec
handles what comes next.

### Player lobby record (shared)

```typescript
export type LobbyPlayer = {
  playerId: PlayerId;
  displayName: string;   // human-readable, client-supplied on connect but capped/sanitized server-side
  isLeader: boolean;
  readyState: boolean;   // false on join; toggled by TOGGLE_READY
};
```

### Stub contract (shared)

The real contract generation system is Phase 4. This type is deliberately minimal
and forward-compatible: it uses the same top-level field names the real system will
use, but all values are fixed placeholders. The Phase 4 spec will widen this type.

```typescript
export type StubContract = {
  contractId: string;           // placeholder: "STUB-001"
  targetName: string;           // placeholder: "The Ashen Warden"
  siteName: string;             // placeholder: "The Collapsed Chancel"
  primaryVerb: string;          // placeholder: "investigate"
  tier: number;                 // placeholder: 1
  // NOTE: No traitRoll, no hiddenTraits, no Aspect, no Frailty, no Ward.
  // Those live server-side only. This type must never carry them (R18, I5).
};
```

### Lobby state snapshot (shared — used in STATE_RESYNC and ROOM_CREATED)

```typescript
export type LobbySnapshot = {
  roomCode: RoomCode;
  phase: RoomPhase;
  players: LobbyPlayer[];       // ordered by join-time ascending
  contract: StubContract | null; // null while WAITING; populated on DEPLOYING
};
```

### Server-only room record

```typescript
// src/server/src/rooms/RoomRecord.ts  (server-only, never exported from shared)
type RoomRecord = {
  code: RoomCode;
  phase: RoomPhase;
  players: ServerPlayerEntry[];   // ordered by join-time ascending
  contract: StubContract | null;
};

type ServerPlayerEntry = {
  playerId: PlayerId;
  displayName: string;
  socketId: string;               // current WebSocket connection identifier
  isLeader: boolean;
  readyState: boolean;
  disconnectedAt: number | null;  // epoch ms; null when connected
};
```

### Reconnect token (server-only)

A reconnect token is a short-lived opaque string the server issues on initial
connection and re-issues on each reconnect. It maps to a `{ playerId, roomCode }`
pair in server memory. It has no meaning to the client other than "send this on
reconnect." It is never the player's identity; it is only a rehydration hint.

```typescript
// server-only
type ReconnectToken = string;   // UUID v4, 32 chars
type ReconnectEntry = {
  token: ReconnectToken;
  playerId: PlayerId;
  roomCode: RoomCode;
  issuedAt: number;             // epoch ms
};
```

---

## Algorithms

### A1 — Generate room code

**Input:** the set of currently active room codes  
**Output:** a unique 6-character string drawn from `ROOM_CODE_ALPHABET`

```
function generateRoomCode(activeCodes: Set<RoomCode>): RoomCode
  loop:
    code = pick 6 characters uniformly at random from ROOM_CODE_ALPHABET
           using the server's CSPRNG (crypto.randomBytes, not seeded RNG)
    if code not in activeCodes: return code
    // collision: retry (probability < 0.00001% at any realistic room count)
```

Note: room codes use the OS CSPRNG, not the expedition seeded RNG. The seeded
RNG (I3) is reserved for expedition-scoped deterministic generation.

### A2 — Derive leader after departure

**Input:** `players: ServerPlayerEntry[]` (the remaining players after removal),
ordered by join-time ascending  
**Output:** the updated `players` array with exactly one `isLeader = true` entry

```
function reassignLeader(players: ServerPlayerEntry[]): ServerPlayerEntry[]
  if players is empty: return []
  // The earliest-joined remaining player becomes leader (index 0 after removal)
  players[0].isLeader = true
  for i in 1..players.length-1: players[i].isLeader = false
  return players
```

### A3 — All-ready check

**Input:** `players: ServerPlayerEntry[]`  
**Output:** boolean

```
function allReady(players: ServerPlayerEntry[]): boolean
  return players.every(p => p.readyState === true)
```

### A4 — Build LobbySnapshot from RoomRecord

**Input:** `room: RoomRecord`  
**Output:** `LobbySnapshot` (safe to send to any client)

```
function toSnapshot(room: RoomRecord): LobbySnapshot
  return {
    roomCode: room.code,
    phase: room.phase,
    players: room.players.map(p => ({
      playerId: p.playerId,
      displayName: p.displayName,
      isLeader: p.isLeader,
      readyState: p.readyState,
      // socketId and disconnectedAt are never included — server-only fields
    })),
    contract: room.contract,
  }
```

### A5 — Validate and sanitize displayName

**Input:** raw string from client  
**Output:** sanitized string or validation error

```
function sanitizeDisplayName(raw: unknown): string | ValidationError
  if typeof raw !== 'string': return ValidationError('not a string')
  trimmed = raw.trim()
  if trimmed.length === 0 or trimmed.length > 32: return ValidationError('length')
  // strip non-printable characters; allow unicode letters, numbers, spaces, hyphens
  return trimmed.replace(/[^\p{L}\p{N} \-]/gu, '')
```

---

## Correctness Properties

**P1**: Server authority — room state is mutated only by validated server handler
functions. No handler mutates state before validation succeeds. [R14, R15]

**P2**: Delta-only after initial sync — after a player's first receive (ROOM_CREATED
or the LOBBY_UPDATED that includes them), the server sends only LOBBY_UPDATED or
ROOM_DEPLOYING events to that socket until reconnection. STATE_RESYNC is the sole
exception and is sent only to the reconnecting socket. [R16]

**P3**: Trait-roll-never-on-wire — StubContract does not and must not contain any
field representing hidden Incarnate properties. This is the wire-level guard for I5
and CLAUDE.md invariant 3, established from phase 3 even with placeholder data. [R18]

**P4**: Ephemeral rooms — RoomManager holds all room state in-process memory only.
It imports no persistence module. On server restart all rooms are lost. [R17]

**P5**: Identity from socket, not payload — every handler derives player identity
from the server's socket→playerId map, never from a client-supplied `playerId` field
in the message payload. [R15]

---

## Wire-Protocol Messages

All messages use the shared envelope:
```json
{ "type": "EVENT_NAME", "payload": { ... } }
```

Event names are SCREAMING_SNAKE_CASE. Types below show the `payload` shape.

### Client → Server

**CREATE_ROOM** (client → server):
```json
{ "displayName": "string (1–32 chars)" }
```
When received: validate displayName, generate room code, create room, emit
ROOM_CREATED to requesting socket, issue reconnect token.

---

**JOIN_ROOM** (client → server):
```json
{ "code": "string", "displayName": "string (1–32 chars)" }
```
When received: validate payload shape; validate code is a non-empty string; look up
room; check phase is WAITING; check capacity; add player; broadcast LOBBY_UPDATED to
room; issue reconnect token to joiner.

---

**TOGGLE_READY** (client → server):
```json
{}
```
Empty payload. The player's identity comes from the socket map. When received:
validate player is in a WAITING room; flip readyState; broadcast LOBBY_UPDATED.

---

**ACCEPT_CONTRACT** (client → server):
```json
{}
```
Empty payload. When received: validate sender is leader; validate room is WAITING;
validate allReady(players); transition room to DEPLOYING; attach stub contract;
broadcast ROOM_DEPLOYING.

---

**LEAVE_ROOM** (client → server):
```json
{}
```
Empty payload. When received: remove player from room; if room is empty destroy it;
else reassign leader if needed; broadcast LOBBY_UPDATED to remaining players.

---

**RECONNECT** (client → server):
```json
{ "token": "string" }
```
When received: look up token in ReconnectEntry map; validate token is not expired
(TTL: 120 seconds); re-associate socket with playerId; if room still exists emit
STATE_RESYNC to this socket only; broadcast LOBBY_UPDATED (player reconnected) to
rest of room; issue a fresh token.

---

### Server → Client

**ROOM_CREATED** (server → creating socket only):
```json
{
  "snapshot": LobbySnapshot,
  "reconnectToken": "string"
}
```
Emitted once, immediately after CREATE_ROOM succeeds. This is the creating player's
initial full sync. [P2]

---

**LOBBY_UPDATED** (server → room broadcast, delta):
```json
{
  "snapshot": LobbySnapshot
}
```
Emitted after any change to lobby membership, ready states, or leadership.
Sent to all current room members including the triggering player. [R2, R6, R10,
R12, P2]

Note on delta framing: `LobbySnapshot` is small (≤4 players × a few fields). A
full snapshot per event is acceptable and simpler than field-level diffs at this
party size. This is consistent with I6 because LOBBY_UPDATED is a delta event
(triggered by a change), not a periodic full-state push.

---

**ROOM_DEPLOYING** (server → room broadcast):
```json
{
  "contract": StubContract
}
```
Emitted once when the room transitions from WAITING to DEPLOYING. [R7]

---

**STATE_RESYNC** (server → reconnecting socket only):
```json
{
  "snapshot": LobbySnapshot,
  "reconnectToken": "string"
}
```
The only full-state push after initial sync. Never broadcast to the room. [R13, P2]

---

**LOBBY_ERROR** (server → requesting socket only, never broadcast):
```json
{
  "code": "ROOM_NOT_FOUND | ROOM_FULL | ALREADY_DEPLOYING | NOT_LEADER | PARTY_NOT_READY | INVALID_PAYLOAD | NOT_IN_ROOM | TOKEN_EXPIRED | TOKEN_NOT_FOUND",
  "message": "string (human-readable, for debug)"
}
```
Emitted on any validation failure. The room state is never mutated when this is
emitted. [R3, R4, R5, R8, R9, R14, P1]

---

## Satisfies Requirements

R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, R12, R13, R14, R15, R16, R17, R18
