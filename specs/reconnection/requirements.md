# Reconnection / Resync — Requirements

## Context
Today, identity is the socket id (`playerId = socket.data.playerId ?? socket.id`) and `disconnect`
calls `RoomManager.leaveRoom` — the player is removed and the room is deleted when empty. A
player who refreshes or drops loses the run entirely; there is no way back in. This spec adds a
stable identity, disconnect *retention* during an in-progress run, and a single full-state
`STATE_RESYNC` snapshot (the sanctioned I6 exception) so a player can rejoin.

Resolves OPEN-QUESTIONS §C "Reconnection / resync". Decision logged in DECISION_LOG.

## Functional Requirements

**R1** — Stable player identity across connections.
- AC: the server derives `playerId` from `socket.handshake.auth.playerId` when it is a string,
  else falls back to `socket.data.playerId ?? socket.id` (existing behaviour preserved).
- AC: the client generates a persistent id (localStorage `veins.playerId`), passes it via the
  socket `auth` handshake, and uses it as `localPlayerId`.

**R2** — A disconnect during an in-progress run retains the player.
- AC: `RoomManager.markDisconnected(code, playerId)` on an **in-progress** room keeps the player
  in `room.players` (board ownership and synergy unchanged) and records them in
  `room.disconnectedPlayers`; returns `mode: 'disconnected'`.
- AC: on a **lobby** room it behaves like leave (player removed, host reassigned, empty room
  deleted); returns `mode: 'left'`.
- AC: if *every* player of an in-progress room is disconnected, the room is deleted (`deleted: true`)
  — no abandoned room leaks into the tick loop.

**R3** — A retained player can rejoin an in-progress run.
- AC: `RoomManager.rejoin(code, playerId)` succeeds iff the room exists, is `in-progress`, and
  `players.includes(playerId)`; it clears the disconnected flag and returns the room.
- AC: otherwise it returns a `LobbyErrorEvent` (`ROOM_NOT_FOUND` or `CANNOT_REJOIN`).

**R4** — Rejoin produces a full `STATE_RESYNC` snapshot to the rejoining socket only.
- AC: `buildStateResync(room)` returns dungeon, board, synergyMap, relicRegistry, lootPool, phase,
  floor, bleedClock, bleedStage, outcome, playerStates, aimStates, alive enemies, projectiles,
  room summary, and disconnectedPlayers.
- AC: the `rejoin` handler emits `STATE_RESYNC` to the requesting socket only — never a room
  broadcast (the only sanctioned full-state push besides initial sync, I6).

**R5** — Teammates are notified of connection changes.
- AC: on an in-progress disconnect that retains the player, the server broadcasts
  `PLAYER_CONNECTION_CHANGED { playerId, connected: false }`; on rejoin, `{ connected: true }`.

**R6** — The client rejoins automatically and restores its render state.
- AC: the client persists the active room code (sessionStorage); on (re)connect, if a code is
  present it emits `rejoin { code }`.
- AC: on `STATE_RESYNC` the client restores the game screen and board/dungeon/phase state.

## Correctness Properties

**P1** — `buildStateResync` is a pure function of room state: no globals, no `Math.random`; the
same room yields the same snapshot.

**P2** — `STATE_RESYNC` is emitted to a single socket, never broadcast — structurally enforced by
the `SocketLike` (single-socket) signature, exactly like `buildBoardStateSync`.

**P3** — Trust: identity is connection-derived (handshake/socket), never a per-message client
field (I2); the snapshot is server-built (I1); `room.disconnectedPlayers` ownership is never
mutated away on disconnect, so synergy/board are unchanged (consistent with solo-play's
"ownership fixed at startRun").
