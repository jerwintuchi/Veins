# Requirements — Lobby & Room

> Phase 3 scope: room lifecycle, lobby UI state, leader/ready mechanics, and
> stub-contract acceptance up to the DEPLOYING transition. The expedition itself
> (field phase, extraction, Field Testament) is out of scope for this spec.

---

## Functional Requirements

**R1**: As a Seeker, I can create a room so that I have a place for my party to
assemble before accepting a contract.
- AC: When a CREATE_ROOM message is received, the server generates a unique 6-character
  alphanumeric room code, creates a room in WAITING state with that player as leader,
  and returns a ROOM_CREATED message to the creating socket containing the room code
  and the initial lobby state.
- AC: A test can verify that two successive CREATE_ROOM calls always produce different
  room codes (collision is possible but astronomically unlikely at test scale; verify
  uniqueness over 1000 sequential calls in a single server instance).

**R2**: As a Seeker, I can join an existing room by room code so that I can play with
friends who created the room.
- AC: When a JOIN_ROOM message with a valid code is received, the server adds the
  player to the room and broadcasts a LOBBY_UPDATED delta event to all players in the
  room including the joiner.
- AC: A test verifies that the LOBBY_UPDATED payload contains the joiner's player entry
  with readyState = false.

**R3**: As a Seeker, I cannot join a room that does not exist.
- AC: When a JOIN_ROOM message references an unknown room code, the server emits a
  LOBBY_ERROR with code ROOM_NOT_FOUND to the requesting socket only. No other sockets
  receive any message. Server state is not mutated.

**R4**: As a Seeker, I cannot join a room that already has 4 players.
- AC: When a JOIN_ROOM message is received for a room at capacity (4 players), the
  server emits LOBBY_ERROR with code ROOM_FULL to the requesting socket only. Room
  state is not mutated.

**R5**: As a Seeker, I cannot join a room that is no longer in the WAITING phase.
- AC: When a JOIN_ROOM message targets a room in DEPLOYING phase, the server emits
  LOBBY_ERROR with code ALREADY_DEPLOYING to the requesting socket only. Room state is
  not mutated.

**R6**: As a Seeker, I can toggle my ready state in the lobby so that the leader knows
the party is prepared.
- AC: When a TOGGLE_READY message is received from a player in a WAITING room, the
  server flips that player's readyState and broadcasts a LOBBY_UPDATED delta event to
  all players in the room.
- AC: Toggling ready twice returns the player to readyState = false. A test verifies
  the idempotent toggle cycle.

**R7**: As the room leader, I can accept a stub contract when all players are ready (or
I am alone) so that the party transitions toward deployment.
- AC: When an ACCEPT_CONTRACT message is received from the leader of a WAITING room
  where all players have readyState = true (or party size is 1), the server transitions
  the room to DEPLOYING phase and broadcasts a ROOM_DEPLOYING delta event to all
  players containing the stub contract data.
- AC: A test verifies the ROOM_DEPLOYING payload includes a contract field that
  satisfies the StubContract shape (see design.md).

**R8**: As a Seeker who is not the leader, I cannot accept a contract.
- AC: When an ACCEPT_CONTRACT message is received from a non-leader player, the server
  emits LOBBY_ERROR with code NOT_LEADER to the requesting socket only. Room state is
  not mutated.

**R9**: As the room leader, I cannot accept a contract when one or more players are not
ready.
- AC: When an ACCEPT_CONTRACT message is received from the leader but at least one
  player has readyState = false, the server emits LOBBY_ERROR with code
  PARTY_NOT_READY to the requesting socket only. Room state is not mutated.

**R10**: As a Seeker, I can leave the room at any time so that I am not trapped in a
lobby or session I no longer want.
- AC: When a LEAVE_ROOM message is received, the server removes the player from the
  room and broadcasts a LOBBY_UPDATED delta event to remaining players.
- AC: A test verifies the departing player's entry is absent from the LOBBY_UPDATED
  payload.

**R11**: As the room system, when the last player leaves a room, that room is
immediately destroyed so that orphan rooms do not accumulate.
- AC: After the last player leaves, the room is no longer findable by its code. A test
  verifies that a subsequent JOIN_ROOM with that code returns LOBBY_ERROR
  ROOM_NOT_FOUND.

**R12**: As the room system, when the leader leaves, leadership is transferred to the
next player in join-order so that the room can continue to function.
- AC: After the leader leaves a room that still has players, the server assigns the
  earliest-joined remaining player as the new leader and broadcasts LOBBY_UPDATED with
  the updated leaderId.
- AC: A test verifies the new leader can successfully send ACCEPT_CONTRACT (when all
  are ready) after the original leader departed.

**R13**: As a Seeker, when I reconnect after a disconnect I am placed back in my
room and receive a full state snapshot so that I can resume without restarting.
- AC: When a socket reconnects with a valid reconnect token that maps to an existing
  room, the server re-associates the socket with the player record and emits a
  STATE_RESYNC message to that socket only containing the full lobby state.
- AC: The STATE_RESYNC is never broadcast to the room; only the reconnecting socket
  receives it. A test verifies the room's other players do not receive STATE_RESYNC.
- AC: If the room no longer exists (was destroyed while disconnected), the server
  emits LOBBY_ERROR with code ROOM_NOT_FOUND and does not emit STATE_RESYNC.

---

## Correctness Requirements

**R14**: As the server, every client message must be validated against its expected
shape before any state mutation occurs so that malformed payloads cannot corrupt room
state.
- AC: A test sends a JOIN_ROOM message with a missing `code` field. The server emits
  LOBBY_ERROR with code INVALID_PAYLOAD to the requesting socket. No room state
  mutation occurs.
- AC: A test sends a JOIN_ROOM message with a `code` field that is not a string. The
  server emits LOBBY_ERROR with code INVALID_PAYLOAD. No room state mutation occurs.

**R15**: As the server, I must be the sole source of truth for all room state so that
clients cannot fabricate or bypass game mechanics.
- AC: A test attempts to forge an ACCEPT_CONTRACT message from a non-leader socket.
  The server refuses and emits LOBBY_ERROR with code NOT_LEADER without mutating state.
- AC: No client-supplied field is used as a player identity; player identity is derived
  from the socket's server-side association (the server maps socket ID → player record).

**R16**: As the server, after a player's initial lobby sync (ROOM_CREATED or
LOBBY_UPDATED on join), I must send only delta events and never re-push the full
state except on an explicit reconnect STATE_RESYNC so that bandwidth is bounded.
- AC: A test sequence covering create → join → toggle-ready → accept-contract verifies
  that no ROOM_CREATED or initial-full-state payload is sent to already-connected
  players after their first sync. Only LOBBY_UPDATED and ROOM_DEPLOYING deltas appear.

**R17**: As the server, room state must never be persisted to a database during a
session so that expeditions remain ephemeral and a server restart cleanly ends all
active rooms.
- AC: The RoomManager implementation contains no database call sites (no import of a
  persistence module). A test or a static-analysis rule verifies this at the unit level
  by confirming the module under test imports only from `src/server/` and
  `@testament/shared`.

**R18**: As the server, the stub contract attached to ROOM_DEPLOYING must never
include Incarnate trait roll data — only the surface contract fields that the client
may display — so that the trait-roll-never-on-wire invariant is established from the
start even with placeholder data.
- AC: The StubContract type in `@testament/shared` does not include a `traitRoll`
  field or any field that encodes hidden Incarnate properties. A TypeScript compiler
  check enforces this structurally.
- AC: A test verifying the shape of the ROOM_DEPLOYING payload asserts that no
  `traitRoll` key is present on the `contract` object.
