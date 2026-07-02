# Tasks — Lobby & Room

> Ordered: shared types first, then server data structures, then pure logic, then
> message handlers, then integration. Every task names its test file and describes
> what the test verifies before any implementation is written.

---

## Shared Types (src/shared)

- [x] T1 [R1, R2, R7, R13, R18, P3] — Define lobby constants and shared types in
  `src/shared/src/lobby.ts`: `MAX_ROOM_PLAYERS`, `MIN_PLAYERS_TO_START`,
  `ROOM_CODE_LENGTH`, `ROOM_CODE_ALPHABET`, `PlayerId`, `RoomCode`, `RoomPhase`,
  `LobbyPlayer`, `StubContract`, `LobbySnapshot`.
  Test: `src/shared/src/lobby.test.ts` — verifies (a) `StubContract` has no
  `traitRoll` field (TypeScript structural check via `satisfies` assertion); (b)
  `MAX_ROOM_PLAYERS === 4`; (c) `ROOM_CODE_LENGTH === 6`; (d) `RoomPhase` accepts
  only `'WAITING'` and `'DEPLOYING'` (exhaustive switch check).

- [x] T2 [R1, R2, R7, R13, R16, P2] — Define wire-protocol message payload types in
  `src/shared/src/lobbyMessages.ts`: `CreateRoomPayload`, `JoinRoomPayload`,
  `ToggleReadyPayload`, `AcceptContractPayload`, `LeaveRoomPayload`,
  `ReconnectPayload`, `RoomCreatedPayload`, `LobbyUpdatedPayload`,
  `RoomDeployingPayload`, `StateResyncPayload`, `LobbyErrorPayload`, and the
  `LobbyErrorCode` union string literal type.
  Test: `src/shared/src/lobbyMessages.test.ts` — verifies (a) `LobbyErrorCode`
  contains exactly the nine error codes from the design (`ROOM_NOT_FOUND`,
  `ROOM_FULL`, `ALREADY_DEPLOYING`, `NOT_LEADER`, `PARTY_NOT_READY`,
  `INVALID_PAYLOAD`, `NOT_IN_ROOM`, `TOKEN_EXPIRED`, `TOKEN_NOT_FOUND`);
  (b) `RoomDeployingPayload` has a `contract` field typed as `StubContract` with no
  extra keys.

- [x] T3 [R14, P1] — Export a `validatePayload<T>` runtime helper from
  `src/shared/src/validation.ts` that accepts an unknown value and a set of required
  field names with their expected `typeof` types and returns a typed result or a
  validation error record. This is a pure structural check, not game logic (I4).
  Test: `src/shared/src/validation.test.ts` — verifies (a) a payload missing a
  required field returns an error; (b) a payload with a field of wrong type returns
  an error; (c) a valid payload passes and is returned typed; (d) extra unknown fields
  do not cause an error (forward-compatibility).

---

## Server: Room Data Structures

- [x] T4 [R1, R11, R12, R15, P4, P5] — Define server-only types `RoomRecord`,
  `ServerPlayerEntry`, `ReconnectToken`, `ReconnectEntry` in
  `src/server/src/rooms/types.ts`. These types must not be re-exported from
  `@testament/shared`.
  Test: `src/server/src/rooms/types.test.ts` — verifies (a) `ServerPlayerEntry`
  has `socketId` and `disconnectedAt` fields (present on the server-only type);
  (b) these fields are absent from `LobbyPlayer` (the shared type); this is a
  TypeScript-compiler-level check using `Omit` / `keyof` assertions in the test
  file.

- [x] T5 [R1, R2, R11, R12, P4] — Implement `RoomManager` class in
  `src/server/src/rooms/RoomManager.ts` with methods: `createRoom(socketId, displayName)`,
  `getRoom(code)`, `getRoomBySocketId(socketId)`, `destroyRoom(code)`. The class holds
  all rooms in a `Map<RoomCode, RoomRecord>`. No database calls.
  Test: `src/server/src/rooms/RoomManager.test.ts` — verifies (a) `createRoom`
  returns a new `RoomRecord` with phase `WAITING`, one player marked as leader; (b)
  `getRoom` with an unknown code returns `undefined`; (c) after `destroyRoom`, the
  same code returns `undefined`; (d) the `RoomManager` module imports nothing from a
  persistence layer (checked via import analysis in the test setup).

---

## Server: Pure Logic Functions

- [x] T6 [R1, P1] — Implement `generateRoomCode(activeCodes: Set<RoomCode>): RoomCode`
  in `src/server/src/rooms/roomCode.ts` using `crypto.randomBytes` (OS CSPRNG). Must
  loop until a code not in `activeCodes` is found.
  Test: `src/server/src/rooms/roomCode.test.ts` — verifies (a) returned code has
  exactly `ROOM_CODE_LENGTH` characters; (b) all characters are in
  `ROOM_CODE_ALPHABET`; (c) when `activeCodes` contains all possible single-attempt
  outputs (mocked), the function retries and returns a collision-free code; (d) 1000
  successive calls with an empty set produce no duplicates.

- [x] T7 [R12, P1] — Implement `reassignLeader(players: ServerPlayerEntry[]): ServerPlayerEntry[]`
  in `src/server/src/rooms/leaderElection.ts`. Pure function; returns a new array
  with the earliest-joined remaining player as leader.
  Test: `src/server/src/rooms/leaderElection.test.ts` — verifies (a) first player in
  array receives `isLeader = true`; (b) all other players have `isLeader = false`;
  (c) empty array input returns empty array without throwing; (d) single-player array
  returns that player as leader.

- [x] T8 [R7, R9, P1] — Implement `allReady(players: ServerPlayerEntry[]): boolean`
  in `src/server/src/rooms/readyCheck.ts`. Pure function.
  Test: `src/server/src/rooms/readyCheck.test.ts` — verifies (a) returns `true` when
  all players have `readyState = true`; (b) returns `false` when any player has
  `readyState = false`; (c) returns `true` for a single-player array with
  `readyState = true`; (d) returns `true` for an empty array (vacuous — the
  capacity guard in the handler covers the 0-player case).

- [x] T9 [R13, P2] — Implement `toSnapshot(room: RoomRecord): LobbySnapshot` in
  `src/server/src/rooms/snapshot.ts`. Pure function; must not include server-only
  fields (`socketId`, `disconnectedAt`) in output.
  Test: `src/server/src/rooms/snapshot.test.ts` — verifies (a) output matches
  `LobbySnapshot` shape exactly; (b) `socketId` is absent from every player entry in
  the output; (c) `disconnectedAt` is absent from every player entry in the output;
  (d) player order in output matches join-time order of the input `RoomRecord`.

- [x] T10 [R14, P1] — Implement `sanitizeDisplayName(raw: unknown): string | LobbyValidationError`
  in `src/server/src/rooms/sanitize.ts`. Pure function; strips non-printable chars,
  enforces 1–32 character length after trim.
  Test: `src/server/src/rooms/sanitize.test.ts` — verifies (a) a valid name passes
  through trimmed; (b) an empty string returns an error; (c) a name longer than 32
  chars returns an error; (d) non-string input returns an error; (e) a name with
  control characters has them stripped without causing an error if the result is
  within length bounds.

---

## Server: Reconnect Token Management

- [x] T11 [R13, P5] — Implement `ReconnectTokenStore` in
  `src/server/src/rooms/ReconnectTokenStore.ts` with methods:
  `issue(playerId, roomCode): ReconnectToken`,
  `resolve(token): ReconnectEntry | undefined`,
  `revoke(token): void`. Tokens expire after 120 seconds. Store is in-process memory
  only. A fresh token is issued on each CREATE_ROOM, JOIN_ROOM, or RECONNECT.
  Test: `src/server/src/rooms/ReconnectTokenStore.test.ts` — verifies (a) `resolve`
  returns the entry for a valid, unexpired token; (b) `resolve` returns `undefined`
  for an unknown token; (c) `resolve` returns `undefined` for an expired token (mock
  `Date.now` to advance past TTL); (d) after `revoke`, `resolve` returns `undefined`;
  (e) issuing a new token for the same player invalidates the old token (only the
  latest token is valid).

---

## Server: Message Handlers

- [x] T12 [R1, R15, P1, P2, P5] — Implement the `CREATE_ROOM` handler in
  `src/server/src/rooms/handlers/createRoom.ts`. Signature:
  `handleCreateRoom(socketId: string, payload: unknown, roomManager: RoomManager, tokenStore: ReconnectTokenStore, emit: EmitFn): void`.
  The handler: validates payload shape; sanitizes displayName; generates room code;
  creates room; emits ROOM_CREATED to socket; issues token.
  Test: `src/server/src/rooms/handlers/createRoom.test.ts` — verifies (a) valid
  payload creates a room and the mock `emit` receives a ROOM_CREATED message whose
  `snapshot.players` has exactly one player with `isLeader = true` and
  `readyState = false`; (b) missing `displayName` field emits LOBBY_ERROR with code
  `INVALID_PAYLOAD` and does not create a room; (c) `displayName` of wrong type emits
  LOBBY_ERROR; (d) the ROOM_CREATED payload has a `reconnectToken` string field.

- [x] T13 [R2, R3, R4, R5, R15, P1, P2, P5] — Implement the `JOIN_ROOM` handler in
  `src/server/src/rooms/handlers/joinRoom.ts`. Signature:
  `handleJoinRoom(socketId: string, payload: unknown, roomManager: RoomManager, tokenStore: ReconnectTokenStore, emit: EmitFn, broadcast: BroadcastFn): void`.
  The handler: validates payload; sanitizes displayName; looks up room; checks phase
  is WAITING; checks capacity; adds player; broadcasts LOBBY_UPDATED; issues token.
  Test: `src/server/src/rooms/handlers/joinRoom.test.ts` — verifies (a) joining a
  valid WAITING room emits LOBBY_UPDATED to all players including the joiner with the
  new player in `snapshot.players` and `readyState = false`; (b) unknown room code
  emits LOBBY_ERROR `ROOM_NOT_FOUND` to the joiner only; (c) joining a full room (4
  players) emits LOBBY_ERROR `ROOM_FULL`; (d) joining a DEPLOYING room emits
  LOBBY_ERROR `ALREADY_DEPLOYING`; (e) LOBBY_UPDATED is not sent when an error
  occurs.

- [x] T14 [R6, P1, P2, P5] — Implement the `TOGGLE_READY` handler in
  `src/server/src/rooms/handlers/toggleReady.ts`. Signature:
  `handleToggleReady(socketId: string, roomManager: RoomManager, emit: EmitFn, broadcast: BroadcastFn): void`.
  The handler: looks up the player's room by socketId; validates the room is in
  WAITING phase; flips `readyState`; broadcasts LOBBY_UPDATED.
  Test: `src/server/src/rooms/handlers/toggleReady.test.ts` — verifies (a) a player
  with `readyState = false` has it set to `true` after one call, and the broadcast
  LOBBY_UPDATED reflects this; (b) a second call returns it to `false`; (c) a socket
  not in any room emits LOBBY_ERROR `NOT_IN_ROOM`; (d) a socket in a DEPLOYING room
  emits LOBBY_ERROR (action not valid in this phase).

- [x] T15 [R7, R8, R9, P1, P2, P3, P5] — Implement the `ACCEPT_CONTRACT` handler in
  `src/server/src/rooms/handlers/acceptContract.ts`. Signature:
  `handleAcceptContract(socketId: string, roomManager: RoomManager, emit: EmitFn, broadcast: BroadcastFn): void`.
  The handler: looks up room; validates sender is leader; validates all ready;
  transitions room to DEPLOYING; attaches stub contract; broadcasts ROOM_DEPLOYING.
  The stub contract is a hardcoded `StubContract` constant defined in
  `src/server/src/rooms/stubContract.ts`.
  Test: `src/server/src/rooms/handlers/acceptContract.test.ts` — verifies (a) leader
  with all players ready triggers ROOM_DEPLOYING broadcast containing a valid
  `StubContract`; (b) non-leader socket emits LOBBY_ERROR `NOT_LEADER` with no state
  change; (c) leader with at least one unready player emits LOBBY_ERROR
  `PARTY_NOT_READY` with no state change; (d) the `contract` field in the
  ROOM_DEPLOYING payload has no `traitRoll` key; (e) solo leader with
  `readyState = true` succeeds.

- [x] T16 [R10, R11, R12, P1, P2, P5] — Implement the `LEAVE_ROOM` handler in
  `src/server/src/rooms/handlers/leaveRoom.ts`. Signature:
  `handleLeaveRoom(socketId: string, roomManager: RoomManager, emit: EmitFn, broadcast: BroadcastFn): void`.
  The handler: looks up room; removes player; if room is empty destroys it; else
  reassigns leader if the departed player was leader; broadcasts LOBBY_UPDATED to
  remaining players.
  Test: `src/server/src/rooms/handlers/leaveRoom.test.ts` — verifies (a) leaving a
  2-player room broadcasts LOBBY_UPDATED with only the remaining player; (b) the
  departing player is absent from the broadcast `snapshot.players`; (c) if the
  departing player was leader, the remaining player is now leader; (d) the last player
  leaving destroys the room (subsequent `getRoom` returns `undefined`); (e) no
  LOBBY_UPDATED is broadcast when the room is destroyed.

- [x] T17 [R13, P2, P5] — Implement the `RECONNECT` handler in
  `src/server/src/rooms/handlers/reconnect.ts`. Signature:
  `handleReconnect(socketId: string, payload: unknown, roomManager: RoomManager, tokenStore: ReconnectTokenStore, emit: EmitFn, broadcast: BroadcastFn): void`.
  The handler: validates payload shape; resolves token; re-associates socket with
  player in room; emits STATE_RESYNC to this socket only; broadcasts LOBBY_UPDATED
  (minus the reconnecting player) to the rest of the room; issues a fresh token.
  Test: `src/server/src/rooms/handlers/reconnect.test.ts` — verifies (a) valid token
  with live room emits STATE_RESYNC only to the reconnecting socket (the mock
  broadcast is not called with STATE_RESYNC); (b) the rest of the room receives
  LOBBY_UPDATED; (c) unknown token emits LOBBY_ERROR `TOKEN_NOT_FOUND`; (d) expired
  token emits LOBBY_ERROR `TOKEN_EXPIRED`; (e) valid token for a destroyed room emits
  LOBBY_ERROR `ROOM_NOT_FOUND` and no STATE_RESYNC.

- [x] T18 [R14, P1] — Implement a `handleUnknownMessage(socketId: string, type: string, emit: EmitFn): void`
  handler in `src/server/src/rooms/handlers/unknown.ts` that emits LOBBY_ERROR with
  code `INVALID_PAYLOAD` and a message indicating the event type was not recognized.
  Test: `src/server/src/rooms/handlers/unknown.test.ts` — verifies (a) the LOBBY_ERROR
  is emitted to the requesting socket only; (b) the error message includes the unknown
  event type string for debuggability.

---

## Server: Disconnect Handling

- [x] T19 [R12, R13, P1, P4] — Implement `handleSocketDisconnect(socketId: string, roomManager: RoomManager, broadcast: BroadcastFn): void`
  in `src/server/src/rooms/handlers/disconnect.ts`. Called by the WebSocket `close`
  event. Marks the player `disconnectedAt = Date.now()`; if the player was leader,
  calls `reassignLeader` and broadcasts LOBBY_UPDATED. If all players are disconnected
  the room is destroyed (cleanup guard for abandoned sessions).
  Test: `src/server/src/rooms/handlers/disconnect.test.ts` — verifies (a) a
  disconnecting leader triggers leader reassignment and a LOBBY_UPDATED broadcast to
  remaining players; (b) a non-leader disconnect broadcasts LOBBY_UPDATED with that
  player still present in the snapshot (they are disconnected but not removed — they
  can reconnect); (c) the last player disconnecting destroys the room.

---

## Server: Stub Contract

- [x] T20 [R7, P3, R18] — Define the hardcoded `STUB_CONTRACT` constant in
  `src/server/src/rooms/stubContract.ts` typed as `StubContract`. This constant is
  what `handleAcceptContract` attaches to the room and broadcasts.
  Test: `src/server/src/rooms/stubContract.test.ts` — verifies (a) `STUB_CONTRACT`
  satisfies the `StubContract` type (TypeScript compiler check); (b) `STUB_CONTRACT`
  has no `traitRoll` key (runtime `Object.keys` check); (c) `STUB_CONTRACT.tier === 1`.

---

## Server: Message Router

- [x] T21 [R14, R15, P1] — Implement the WebSocket message router in
  `src/server/src/rooms/messageRouter.ts`. The router: parses the JSON envelope
  `{ type, payload }`; dispatches to the appropriate handler by `type`; calls
  `handleUnknownMessage` for unrecognized types. Parsing errors (non-JSON, missing
  `type` field) emit LOBBY_ERROR `INVALID_PAYLOAD`.
  Test: `src/server/src/rooms/messageRouter.test.ts` — verifies (a) a well-formed
  `CREATE_ROOM` envelope dispatches to the createRoom handler (via a spy); (b)
  malformed JSON emits LOBBY_ERROR `INVALID_PAYLOAD` without throwing; (c) a message
  with a missing `type` field emits LOBBY_ERROR `INVALID_PAYLOAD`; (d) an unrecognized
  type dispatches to `handleUnknownMessage`.

---

## Integration

- [x] T22 [R1, R2, R6, R7, R10, R12, R13, R16, P1, P2] — Write an integration test
  that exercises the full lobby flow against a real in-process WebSocket server
  (`ws` library, no mocks) in `src/server/src/rooms/lobby.integration.test.ts`.
  Scenario: create room → second player joins → both toggle ready → leader accepts
  contract → second player leaves → leader alone → leader leaves (room destroyed).
  Test verifies: (a) event sequence matches the expected order
  (ROOM_CREATED → LOBBY_UPDATED → LOBBY_UPDATED → LOBBY_UPDATED → ROOM_DEPLOYING → ...);
  (b) no STATE_RESYNC is sent to already-connected players during the flow; (c) after
  room destruction, a JOIN_ROOM for the old code returns LOBBY_ERROR `ROOM_NOT_FOUND`;
  (d) a reconnect scenario: first player drops connection, reconnects with token,
  receives STATE_RESYNC, rest of room receives LOBBY_UPDATED.
