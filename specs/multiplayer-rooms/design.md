# Design — Multiplayer Lobby + Rooms

## Data Models

### Shared (`src/shared/src/lobby.ts`, types + constants)
```typescript
const MAX_PLAYERS = 4;
const MIN_PLAYERS_TO_START = 2;
const HEX_BOARD_RADIUS = 2; // radius-2 hexagon = 19 cells

type RoomCode = string;
type RoomStatus = 'lobby' | 'in-progress' | 'ended';

type RoomSummary = {
  code: RoomCode;
  status: RoomStatus;
  hostId: PlayerId;
  players: PlayerId[];
};

// Client -> Server requests
type JoinRoomRequest = { code: RoomCode; playerId: PlayerId };

// Server -> client / room
type RoomUpdateEvent = { room: RoomSummary };
type RunStartedEvent = { dungeon: DungeonLayout; board: RelicBoard; synergyMap: SynergyMap };
type LobbyErrorEvent = {
  code: 'ROOM_NOT_FOUND' | 'ROOM_FULL' | 'ALREADY_STARTED' | 'ALREADY_IN_ROOM' | 'NOT_ENOUGH_PLAYERS' | 'NOT_IN_ROOM';
  message: string;
};
```

### Server room state (extends `src/server/src/room/state.ts`)
`Room` gains: `code`, `hostId`, `status`, `runId`. Existing fields (`board`, `registry`, `phase`, `floor`, `bleedClock`, `players`) unchanged.

## Algorithms

### Room codes (`src/server/src/room/roomCode.ts`)
`generateRoomCode()` — 5 chars from an unambiguous alphabet (no `O/0/I/1`). Uses `node:crypto` for true randomness (room codes need uniqueness, not reproducibility, so this is outside the seeded-RNG/I3 scope). Injectable into `RoomManager` for deterministic tests.

### RoomManager (`src/server/src/room/manager.ts`)
In-memory `Map<RoomCode, Room>`. All methods return discriminated results (`{ ok: true, ... } | { ok: false, error }`), mirroring the board handlers.
- `createRoom(hostId)` → unique code, room in `lobby`.
- `joinRoom(code, playerId)` → validates existence, status `lobby`, `< MAX_PLAYERS`, not already in room.
- `leaveRoom(code, playerId)` → removes player; deletes room if empty; reassigns host if host left.
- `startRun(code)` → validates `>= MIN_PLAYERS_TO_START`; generates dungeon; builds + assigns board; sets status `in-progress`, floor 1, phase `loot`.
- `getRoom(code)`.

### Hex board construction (`src/server/src/board/layout.ts`)
- `buildHexCoords(radius)` → all axial coords with hex-distance ≤ radius (19 for radius 2).
- `assignHomeQuadrants(coords, players)` → owners assigned by angular sector around origin: outer cells sorted by angle, divided into N contiguous arcs; center cell to the first player. Contiguous arcs border each other → guarantees cross-player adjacency (R5). Deterministic.
- `buildInitialBoard(players, radius)` → `RelicBoard` of empty owned slots.

### Placement hardening (`src/server/src/board/placement.ts`)
`placeRelic` signature changes: the authoritative `playerId` is passed by the caller (from the authenticated socket), and `PlaceRelicRequest` drops the trusted `ownerId` field. New rule: a player may only place into a slot they own → else `NOT_OWNER`. The emitted event uses `slot.ownerId` (the server's truth). Resolves the deferred review note.

## Correctness Properties
**P1**: Room codes are unique among active rooms (`createRoom` retries on collision).
**P2**: An empty room is always removed (no memory leak).
**P3**: A started run is deterministic from its run ID (inherited from Dungeon Generation P1).
**P4**: Board ownership is total (every slot owned) and cross-player adjacency exists.
**P5 (Trust)**: No handler mutates state from an unvalidated client field; ownership is server-derived.

## Socket.io Events (`src/server/src/index.ts`, thin wiring)
Inbound (client→server): `create-room`, `join-room`, `leave-room`, `start-run`, `place-relic`, `revive`.
Outbound: `ROOM_UPDATE`, `RUN_STARTED`, `BOARD_STATE_SYNC`, `RELIC_PLACED`, `RELIC_REMOVED`, plus targeted `*_ERROR`.
The socket layer is thin plumbing: authenticate socket→playerId, call the pure handler, broadcast the returned event(s) or emit the error to the requesting socket only. Core logic (RoomManager, board layout, placement, linked fates, dungeon) is unit-tested; the socket layer is integration-level.

## Satisfies Requirements
R1, R2, R3, R4, R5, R6, R7
