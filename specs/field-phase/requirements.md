# Requirements — Field Phase (Skeleton)

> Phase 3 scope: field phase skeleton, extraction, stub Field Testament, and session
> Archive update. This spec picks up exactly where the lobby-room spec ends: after
> ROOM_DEPLOYING is broadcast to all players. Real dungeon generation, real Incarnate
> mechanics, sign language, combat, and failure paths are all out of scope and
> belong to later phases.
>
> The exit gate for Phase 3 is: a party can walk the full
> Observe → Hypothesize → Test → Record loop with nothing real in it yet.

---

## Functional Requirements

**R19**: As a Seeker, after receiving ROOM_DEPLOYING, the leader can send DEPLOY to
begin the field phase so that the party transitions from the pre-deployment staging
area into the field.
- AC: When a DEPLOY message is received from the leader of a DEPLOYING-phase room,
  the server transitions the room to FIELD phase and broadcasts FIELD_STARTED to all
  players containing a `StubFieldData` object with `fieldId`, `siteName`, and
  `incarnateName` populated from the room's existing `StubContract`.
- AC: A test verifies that the `siteName` in FIELD_STARTED matches the `siteName`
  from the `StubContract` attached to the room at transition time.
- AC: A test verifies that after FIELD_STARTED is broadcast, `getRoom(code).phase`
  equals `'FIELD'`.

**R20**: As a Seeker who is not the leader, I cannot trigger deployment.
- AC: When a DEPLOY message is received from a non-leader player, the server emits
  LOBBY_ERROR with code `NOT_LEADER` to the requesting socket only. Room phase is not
  mutated.
- AC: A test verifies no FIELD_STARTED broadcast occurs when the sender is not the
  leader.

**R21**: As the server, a DEPLOY message must be rejected if the room is not in
DEPLOYING phase.
- AC: When a DEPLOY message is received from any player in a room whose phase is not
  `'DEPLOYING'` (e.g., WAITING, FIELD, or COMPLETE), the server emits LOBBY_ERROR
  with code `WRONG_PHASE` to the requesting socket only. Room state is not mutated.
- AC: A test sends DEPLOY to a WAITING-phase room and verifies LOBBY_ERROR
  `WRONG_PHASE` is emitted without broadcasting FIELD_STARTED.

**R22**: As a Seeker, I can send EXTRACT from the field so that the party transitions
to extraction and the expedition concludes.
- AC: When an EXTRACT message is received from any player in a FIELD-phase room, the
  server transitions the room to COMPLETE phase and broadcasts FIELD_TESTAMENT to all
  players containing a `StubTestament` with `expeditionId`, `contractId`, `outcome`,
  and `entries`.
- AC: The `outcome` field in the broadcast `StubTestament` is `'success'` for the
  skeleton (no failure path in this phase).
- AC: A test verifies the `contractId` in the broadcast `StubTestament` matches the
  `contractId` from the room's attached `StubContract`.

**R23**: As the server, an EXTRACT message must be rejected if the room is not in
FIELD phase.
- AC: When an EXTRACT message is received from any player in a room whose phase is
  not `'FIELD'` (e.g., WAITING, DEPLOYING, or COMPLETE), the server emits LOBBY_ERROR
  with code `WRONG_PHASE` to the requesting socket only. Room state is not mutated.
- AC: A test sends EXTRACT to a DEPLOYING-phase room and verifies LOBBY_ERROR
  `WRONG_PHASE` is emitted without transitioning to COMPLETE.

**R24**: As the server, immediately after broadcasting FIELD_TESTAMENT, I must append
the testament's entries to the room's session Archive and broadcast ARCHIVE_UPDATED
to all players with the full current Archive snapshot.
- AC: After EXTRACT succeeds, two broadcasts are emitted in sequence: FIELD_TESTAMENT
  then ARCHIVE_UPDATED. A test verifies ARCHIVE_UPDATED is sent after FIELD_TESTAMENT
  and is never sent before it.
- AC: The ARCHIVE_UPDATED payload contains an `entries` array that includes the
  `StubArchiveEntry` objects from the testament just written.
- AC: A test that runs two sequential expeditions in the same session (stub only —
  both with the same room) verifies the Archive accumulates entries across both
  extractions.

**R25**: As a Seeker who reconnects during the FIELD phase, I receive a full state
snapshot so I can rejoin the session without restarting.
- AC: When a valid reconnect token is presented and the room is in FIELD phase, the
  server emits STATE_RESYNC to the reconnecting socket only. The `STATE_RESYNC`
  payload includes a `fieldSnapshot` field containing the current `FieldSnapshot`
  (field phase data) in addition to the existing lobby-level snapshot.
- AC: The STATE_RESYNC emitted during FIELD phase is never broadcast to the room; only
  the reconnecting socket receives it. A test verifies the broadcast function is not
  called with STATE_RESYNC.
- AC: A test verifies a reconnecting player whose room has moved to COMPLETE phase
  receives LOBBY_ERROR with code `ROOM_NOT_FOUND` (the room is destroyed on
  completion — see R27).

**R26**: As the server, the FIELD_TESTAMENT payload must never include an Incarnate
trait roll or any hidden Incarnate property so that the trait-roll-never-on-wire
invariant is upheld even with stub data.
- AC: The `StubTestament` type in `@testament/shared` does not include a `traitRoll`
  field or any field that encodes hidden Incarnate properties. A TypeScript compiler
  check enforces this structurally.
- AC: A runtime test asserting `Object.keys` on the `entries[0]` object of any
  FIELD_TESTAMENT broadcast verifies that no `traitRoll` key is present.

**R27**: As the server, when a room reaches COMPLETE phase, it is destroyed after
FIELD_TESTAMENT and ARCHIVE_UPDATED have been broadcast so that completed rooms do
not accumulate in memory.
- AC: After EXTRACT succeeds and both broadcasts are emitted, the room is no longer
  findable by its code. A test verifies that a subsequent `getRoom(code)` returns
  `undefined` after the extraction sequence.
- AC: A test verifies that a JOIN_ROOM to the old code after destruction returns
  LOBBY_ERROR `ROOM_NOT_FOUND`.

**R28**: As the server, a DEPLOY or EXTRACT message from a socket not associated with
any room must be rejected cleanly.
- AC: When DEPLOY or EXTRACT is received from a socket that is not in any room, the
  server emits LOBBY_ERROR with code `NOT_IN_ROOM` to that socket only. No state is
  mutated.
- AC: A test verifies this for both DEPLOY and EXTRACT in isolation.

---

## Correctness Requirements

**R29**: As the server, all field-phase message handlers must validate authorization
and phase before any state mutation, consistent with the server-authority invariants
established in R14 and R15.
- AC: A test sends DEPLOY from a non-leader socket and verifies zero state mutations
  and zero broadcasts before the error is emitted.
- AC: A test sends EXTRACT to a COMPLETE room and verifies zero state mutations.

**R30**: As the server, the session Archive is in-process memory only, scoped to the
room's lifetime, and never persisted to a database.
- AC: The `SessionArchive` implementation contains no database call sites. A test or
  static-analysis rule verifies that the `SessionArchive` module imports only from
  `src/server/` and `@testament/shared`.
- AC: When a room is destroyed (R27), its Archive entries are discarded. A test
  verifies `getArchive(code)` returns `undefined` or an empty array after room
  destruction.

**R31**: As the server, the `RoomPhase` union type must be extended to include `'FIELD'`
and `'COMPLETE'` so that the type system enforces the full phase machine and exhaustive
switch checks catch missing cases.
- AC: A TypeScript compiler check (exhaustive switch) in the test file for
  `lobby.ts` confirms that the `RoomPhase` type includes exactly
  `'WAITING' | 'DEPLOYING' | 'FIELD' | 'COMPLETE'` and no other members.
- AC: A test that attempts to assign an unlisted string literal to `RoomPhase` fails
  to compile (verified via `ts-expect-error` annotation).

**R32**: As the server, after a player's initial field sync (FIELD_STARTED on DEPLOY),
I must send only delta events and never re-push the full field state except on an
explicit reconnect STATE_RESYNC, consistent with the delta-only invariant (I6, R16).
- AC: A test sequence covering DEPLOY → EXTRACT verifies that FIELD_STARTED is sent
  exactly once per player per transition, and that no player receives a second
  FIELD_STARTED after the first.
- AC: The reconnect path (R25) is the sole exception and is covered by its own test.
