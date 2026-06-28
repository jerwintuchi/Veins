# Requirements — Multiplayer Lobby + Rooms

The authoritative server's room layer: room codes, join/leave, run lifecycle, and the Socket.io wiring that connects the already-built Circulatory Board and Dungeon Generation logic to real clients. Rooms are ephemeral and in-memory (invariant I7).

---

**R1**: As a host, I can create a room and receive a shareable room code so teammates can join.
- AC: `createRoom(hostId)` returns a unique room code and a room in `lobby` status containing the host as the only player
- AC: two rooms never share the same active code

**R2**: As a player, I can join an existing room by code so I can play with friends.
- AC: joining a valid `lobby` room adds me to its player list
- AC: joining a non-existent code is rejected with `ROOM_NOT_FOUND`
- AC: joining a room that already has 4 players is rejected with `ROOM_FULL`
- AC: joining a room whose run has already started is rejected with `ALREADY_STARTED`
- AC: joining a room I am already in is rejected with `ALREADY_IN_ROOM`

**R3**: As a player, I can leave a room, and an empty room is cleaned up so memory is not leaked.
- AC: leaving removes me from the room's player list
- AC: a room with zero players after a leave is deleted from the manager
- AC: if the host leaves, host is reassigned to a remaining player

**R4**: As a party, a run starts only with enough players, generating the dungeon and initializing the shared board, so the game begins in a valid state.
- AC: `startRun` is rejected with `NOT_ENOUGH_PLAYERS` when fewer than 2 players are present
- AC: on success the room status becomes `in-progress`, a dungeon is generated from the room's run ID, and the Circulatory Board is initialized with every player owning slots
- AC: the dungeon is deterministic from the run ID (reuses Dungeon Generation guarantees)

**R5**: As a game system, the shared hex board is constructed (radius-2, 19 cells) and ownership is partitioned among the players so each player has a home region and cross-player adjacency exists (synergy is possible).
- AC: the board has exactly 19 slots for a radius-2 board
- AC: every slot is owned by exactly one of the players; ownership is distributed across all players
- AC: at least one pair of adjacent slots is owned by different players (cross-player adjacency exists)

**R6**: As a game system, the placing player's identity comes from the authenticated server-side session, never a client-supplied field, and a player may only place into a slot they own, so authorship cannot be spoofed (resolves the deferred Circulatory Board review note; invariant I2).
- AC: `placeRelic` derives/validates ownership against the authenticated player id, not a client payload field
- AC: placing into a slot owned by another player is rejected with `NOT_OWNER`
- AC: the emitted `RELIC_PLACED` event reports the slot's true owner

**R7**: As a game system, Socket.io handlers validate every inbound message and only the authoritative server mutates room state, so clients cannot corrupt the game (invariants I1, I2, I6).
- AC: each handler validates payload + action legality before mutating, emitting a targeted error on failure
- AC: state changes are broadcast to the room as delta events; full snapshots (`BOARD_STATE_SYNC`, `DUNGEON_LAYOUT`) are sent only on join / run start
