# Tasks — Field Phase (Skeleton)

> Ordered: shared types first, then server data structures, then pure logic, then
> message handlers, then integration. Every task names its test file and describes
> what the test verifies before any implementation is written.
>
> Numbering continues from T22 (lobby-room). All tasks reference R# and P# IDs from
> `requirements.md` and `design.md`.

---

## Shared Types

- [x] T23 [R31, P7, P8] — Extend `RoomPhase` in `src/shared/src/lobby.ts` from
  `'WAITING' | 'DEPLOYING'` to `'WAITING' | 'DEPLOYING' | 'FIELD' | 'COMPLETE'`.
  No other change to that file.
  Test: `src/shared/src/lobby.test.ts` (extend existing) — verifies (a) an exhaustive
  switch over `RoomPhase` covering all four values compiles without error; (b) a
  `// @ts-expect-error` annotation on an assignment of a fifth literal (e.g.
  `'ABANDONED'`) confirms the type system rejects unknown members; (c) existing
  `MAX_ROOM_PLAYERS === 4` and `ROOM_CODE_LENGTH === 6` checks continue to pass.

- [x] T24 [R19, R22, R24, R26, P7] — Define field-phase shared types in
  `src/shared/src/fieldPhase.ts` (new file): `StubFieldData`, `StubArchiveEntry`,
  `StubTestament`, `FieldSnapshot`.
  Test: `src/shared/src/fieldPhase.test.ts` — verifies (a) `StubFieldData` has no
  `traitRoll` key (TypeScript `satisfies` assertion plus runtime `Object.keys` check
  on a fixture value); (b) `StubTestament` has no `traitRoll` key by the same method;
  (c) `StubArchiveEntry.outcome` only accepts the literal `'success'` (a
  `// @ts-expect-error` on assignment of `'failure'` confirms this); (d) `FieldSnapshot`
  has `fieldData: StubFieldData` and `archiveEntries: StubArchiveEntry[]` and no other
  required fields.

- [x] T25 [R19, R22, R24, R25, P11] — Define field-phase wire-payload types in
  `src/shared/src/fieldMessages.ts` (new file): `DeployPayload`, `ExtractPayload`,
  `FieldStartedPayload`, `FieldTestamentPayload`, `ArchiveUpdatedPayload`.
  Test: `src/shared/src/fieldMessages.test.ts` — verifies (a) `FieldStartedPayload`
  has `fieldData: StubFieldData` and `reconnectToken: string` and no other required
  fields; (b) `FieldTestamentPayload` has `testament: StubTestament` and no
  `traitRoll` key anywhere in the nested shape (runtime `JSON.stringify` + parse
  check on a fixture); (c) `DeployPayload` and `ExtractPayload` are assignable from
  an empty object `{}`.

- [x] T26 [R21, R23, R28, R29] — Add `'WRONG_PHASE'` to the `LobbyErrorCode` union
  in `src/shared/src/lobbyMessages.ts`. Extend `StateResyncPayload` in the same file
  to include `fieldSnapshot: FieldSnapshot | null` (importing `FieldSnapshot` from
  `./fieldPhase.js`).
  Test: `src/shared/src/lobbyMessages.test.ts` (extend existing) — verifies (a) the
  `LobbyErrorCode` union now contains exactly ten codes (the original nine plus
  `WRONG_PHASE`); (b) `StateResyncPayload` is assignable from an object that includes
  `fieldSnapshot: null`; (c) `StateResyncPayload` is assignable from an object that
  includes a valid `FieldSnapshot`; (d) existing nine-code check from T2 is updated
  to reflect the new count.

---

## Server: Data Structures

- [x] T27 [R19, R25, R30, P6, P10] — Extend `RoomRecord` in
  `src/server/src/rooms/types.ts` to add `fieldData: StubFieldData | null`. Import
  `StubFieldData` from `@testament/shared`. The field is `null` on room creation and
  set when DEPLOY succeeds.
  Test: `src/server/src/rooms/types.test.ts` (extend existing) — verifies (a)
  `RoomRecord` has a `fieldData` field typed as `StubFieldData | null`; (b)
  `ServerPlayerEntry` still has `socketId` and `disconnectedAt` and those are still
  absent from `LobbyPlayer`; (c) the module imports nothing from a persistence layer
  (import analysis).

- [x] T28 [R24, R27, R30, P10] — Implement `SessionArchive` class in
  `src/server/src/rooms/SessionArchive.ts` with methods: `append(roomCode, entries)`,
  `getEntries(roomCode): StubArchiveEntry[]`, `destroyArchive(roomCode): void`. In-
  process memory only; uses a `Map<RoomCode, StubArchiveEntry[]>`. No database calls.
  Test: `src/server/src/rooms/SessionArchive.test.ts` — verifies (a) `getEntries`
  returns an empty array for an unknown code (not `undefined`, not an error); (b)
  after `append`, `getEntries` returns the appended entries; (c) calling `append`
  twice accumulates entries (does not overwrite); (d) after `destroyArchive`,
  `getEntries` returns an empty array; (e) the module imports nothing from a
  persistence layer (import analysis).

---

## Server: Pure Logic Functions

- [x] T29 [R19, P6, P7] — Implement `buildStubFieldData(contract: StubContract): StubFieldData`
  in `src/server/src/rooms/fieldData.ts`. Pure function; no side effects. Copies
  `siteName` and `targetName` from the contract; uses the `'FIELD-001'` placeholder
  for `fieldId`.
  Test: `src/server/src/rooms/fieldData.test.ts` — verifies (a) `siteName` in the
  result equals `contract.siteName`; (b) `incarnateName` in the result equals
  `contract.targetName`; (c) `fieldId` equals `'FIELD-001'`; (d) the result object
  has exactly the keys `fieldId`, `siteName`, `incarnateName` and no others (runtime
  `Object.keys` check); (e) no `traitRoll` key is present.

- [x] T30 [R22, R26, P7] — Implement `buildStubTestament(room: RoomRecord): StubTestament`
  in `src/server/src/rooms/testament.ts`. Uses `crypto.randomUUID()` for
  `expeditionId`. Asserts `room.contract !== null` (throws a descriptive error if
  violated — this is a programming error, not a user error).
  Test: `src/server/src/rooms/testament.test.ts` — verifies (a) `contractId` in the
  result matches `room.contract.contractId`; (b) `outcome` is `'success'`; (c)
  `entries` has length 1; (d) `entries[0].targetName` matches `room.contract.targetName`;
  (e) `expeditionId` is a non-empty string (UUID format, checked with a regex);
  (f) neither the testament nor any entry has a `traitRoll` key (runtime `Object.keys`
  check on both levels); (g) calling with `room.contract === null` throws.

- [x] T31 [R25, P8, P11] — Implement `buildFieldSnapshot(room: RoomRecord, archive: SessionArchive): FieldSnapshot | null`
  in `src/server/src/rooms/snapshot.ts` (alongside the existing `toSnapshot`). Returns
  `null` when `room.phase !== 'FIELD'`. Returns a `FieldSnapshot` when in FIELD phase,
  reading archive entries from `archive.getEntries(room.code)`.
  Test: `src/server/src/rooms/snapshot.test.ts` (extend existing) — verifies (a)
  returns `null` when room phase is `'WAITING'`; (b) returns `null` when room phase is
  `'DEPLOYING'`; (c) returns a `FieldSnapshot` with the correct `fieldData` when phase
  is `'FIELD'`; (d) `archiveEntries` in the result matches what `archive.getEntries`
  returns for that room code; (e) `socketId` and `disconnectedAt` remain absent from
  all nested player entries (inherited from `toSnapshot`, regression guard).

- [x] T32 [R21, R23, R28, P8] — Implement `assertPhase(room: RoomRecord | undefined, expected: RoomPhase, emit: EmitFn): room is RoomRecord`
  in `src/server/src/rooms/phaseGuard.ts`. Emits `NOT_IN_ROOM` when room is
  `undefined`; emits `WRONG_PHASE` when room exists but phase does not match.
  Returns `true` only when both checks pass.
  Test: `src/server/src/rooms/phaseGuard.test.ts` — verifies (a) returns `false` and
  emits `LOBBY_ERROR NOT_IN_ROOM` when `room` is `undefined`; (b) returns `false` and
  emits `LOBBY_ERROR WRONG_PHASE` when room exists but phase is wrong; (c) returns
  `true` and emits nothing when room is defined and phase matches; (d) the `LOBBY_ERROR`
  emitted for wrong phase includes the expected and actual phase in the `message` field.

---

## Server: Message Handlers

- [x] T33 [R19, R20, R21, R28, R29, P6, P8, P11] — Implement the `DEPLOY` handler in
  `src/server/src/rooms/handlers/deploy.ts`. Signature:
  `handleDeploy(socketId: string, roomManager: RoomManager, tokenStore: ReconnectTokenStore, emit: EmitFn, broadcast: BroadcastFn): void`.
  The handler: looks up room by socketId; validates phase is DEPLOYING (using
  `assertPhase`); validates sender is leader; calls `buildStubFieldData` from the
  room's contract; transitions room phase to `'FIELD'`; sets `room.fieldData`; emits
  FIELD_STARTED individually to each player (per-player reconnect token); does not
  use the `broadcast` function (each player gets their own token).
  Test: `src/server/src/rooms/handlers/deploy.test.ts` — verifies (a) a valid DEPLOY
  from the leader of a DEPLOYING room sets `room.phase === 'FIELD'` and emits
  FIELD_STARTED to each player with a valid `reconnectToken` and the correct
  `fieldData.siteName`; (b) a non-leader sender emits LOBBY_ERROR `NOT_LEADER` with
  zero state mutations; (c) DEPLOY in a WAITING room emits LOBBY_ERROR `WRONG_PHASE`;
  (d) DEPLOY in a FIELD room emits LOBBY_ERROR `WRONG_PHASE`; (e) sender not in any
  room emits LOBBY_ERROR `NOT_IN_ROOM`; (f) FIELD_STARTED payload has no `traitRoll`
  key.

- [x] T34 [R22, R23, R24, R26, R27, R28, R29, P7, P9, P10] — Implement the `EXTRACT`
  handler in `src/server/src/rooms/handlers/extract.ts`. Signature:
  `handleExtract(socketId: string, roomManager: RoomManager, sessionArchive: SessionArchive, tokenStore: ReconnectTokenStore, emit: EmitFn, broadcast: BroadcastFn): void`.
  The handler: looks up room by socketId; validates phase is FIELD (using
  `assertPhase`); calls `buildStubTestament`; transitions room phase to `'COMPLETE'`;
  broadcasts FIELD_TESTAMENT; appends testament entries to `sessionArchive`; broadcasts
  ARCHIVE_UPDATED; calls `roomManager.destroyRoom` and `sessionArchive.destroyArchive`
  in sequence.
  Test: `src/server/src/rooms/handlers/extract.test.ts` — verifies (a) a valid EXTRACT
  from any player in a FIELD room broadcasts FIELD_TESTAMENT then ARCHIVE_UPDATED in
  that order (check mock call order); (b) `room.phase` is `'COMPLETE'` at time of
  broadcast (before destruction); (c) after extraction, `roomManager.getRoom(code)`
  returns `undefined`; (d) after extraction, `sessionArchive.getEntries(code)` returns
  an empty array (archive destroyed); (e) the FIELD_TESTAMENT payload's `testament`
  has no `traitRoll` key; (f) EXTRACT in a DEPLOYING room emits LOBBY_ERROR
  `WRONG_PHASE` with no broadcasts; (g) sender not in any room emits LOBBY_ERROR
  `NOT_IN_ROOM`.

---

## Server: Reconnect Extension

- [x] T35 [R25, P11] — Extend the `RECONNECT` handler in
  `src/server/src/rooms/handlers/reconnect.ts` to include `fieldSnapshot` in the
  `STATE_RESYNC` payload. The handler already calls `toSnapshot`; it must now also
  call `buildFieldSnapshot(room, archive)` and include the result as `fieldSnapshot`
  in the STATE_RESYNC payload. Add `sessionArchive: SessionArchive` as a new parameter.
  Test: `src/server/src/rooms/handlers/reconnect.test.ts` (extend existing) — verifies
  (a) reconnecting during FIELD phase: STATE_RESYNC includes `fieldSnapshot` with
  correct `fieldData.incarnateName`; (b) reconnecting during WAITING phase: STATE_RESYNC
  includes `fieldSnapshot: null`; (c) reconnecting during DEPLOYING phase: STATE_RESYNC
  includes `fieldSnapshot: null`; (d) existing tests from T17 remain green (STATE_RESYNC
  still sent only to the reconnecting socket; token expiry paths unchanged).

---

## Server: Message Router Extension

- [x] T36 [R19, R22, R28, R29, P8] — Extend `src/server/src/rooms/messageRouter.ts`
  to dispatch `DEPLOY` and `EXTRACT` messages. Add `sessionArchive: SessionArchive` to
  the `routeMessage` signature. Import `handleDeploy` from `./handlers/deploy.js` and
  `handleExtract` from `./handlers/extract.js`. Add cases to the switch.
  Test: `src/server/src/rooms/messageRouter.test.ts` (extend existing) — verifies (a)
  a well-formed `DEPLOY` envelope dispatches to the deploy handler (via spy); (b) a
  well-formed `EXTRACT` envelope dispatches to the extract handler (via spy); (c)
  existing dispatch cases for `CREATE_ROOM`, `JOIN_ROOM`, etc. remain unaffected
  (regression); (d) an unknown type still dispatches to `handleUnknownMessage`.

---

## Server: Stub Data Constant

- [x] T37 [R19, P6, P7] — Define a hardcoded `STUB_FIELD_DATA` constant in
  `src/server/src/rooms/stubFieldData.ts` typed as `StubFieldData`. This constant
  is used only as a fallback in tests; production code derives field data from the
  contract via `buildStubFieldData` (A6). The constant exists to give tests a
  well-typed fixture without constructing a full contract.
  Test: `src/server/src/rooms/stubFieldData.test.ts` — verifies (a) `STUB_FIELD_DATA`
  satisfies the `StubFieldData` type (compiler check); (b) `STUB_FIELD_DATA` has no
  `traitRoll` key (runtime `Object.keys`); (c) `STUB_FIELD_DATA.fieldId === 'FIELD-001'`.

---

## Integration

- [x] T38 [R19, R20, R21, R22, R23, R24, R25, R26, R27, R31, R32, P7, P9, P11] —
  Write an integration test exercising the full field-phase skeleton against a real
  in-process WebSocket server (`ws` library, no mocks) in
  `src/server/src/rooms/field.integration.test.ts`.

  **Scenario A — happy path:** create room → join → both toggle ready → leader accepts
  contract → receive ROOM_DEPLOYING → leader sends DEPLOY → receive FIELD_STARTED →
  any player sends EXTRACT → receive FIELD_TESTAMENT then ARCHIVE_UPDATED in order →
  verify room destroyed.

  **Scenario B — guard failures:** send DEPLOY from non-leader → verify LOBBY_ERROR
  `NOT_LEADER`; send DEPLOY in WAITING phase → verify LOBBY_ERROR `WRONG_PHASE`; send
  EXTRACT in DEPLOYING phase → verify LOBBY_ERROR `WRONG_PHASE`.

  **Scenario C — reconnect during FIELD:** player 1 creates room, deploys solo, then
  drops connection; player 1 reconnects with token; receives STATE_RESYNC with a non-
  null `fieldSnapshot` containing correct `incarnateName`; other players (if any)
  receive LOBBY_UPDATED.

  **Scenario D — post-extraction invariants:** after EXTRACT succeeds, send JOIN_ROOM
  to the old room code → verify LOBBY_ERROR `ROOM_NOT_FOUND`; send EXTRACT again →
  verify LOBBY_ERROR `NOT_IN_ROOM` (socket is no longer in any room).

  Test verifies: (a) event sequence in Scenario A matches exactly
  `ROOM_CREATED → LOBBY_UPDATED → LOBBY_UPDATED → LOBBY_UPDATED → ROOM_DEPLOYING →
  FIELD_STARTED × 2 → FIELD_TESTAMENT → ARCHIVE_UPDATED`; (b) no STATE_RESYNC is sent
  to already-connected players during the happy path; (c) FIELD_TESTAMENT `testament`
  has no `traitRoll` key; (d) ARCHIVE_UPDATED `entries` is non-empty and includes the
  testament's entry; (e) the Scenario C reconnect emits STATE_RESYNC only to the
  reconnecting socket.
