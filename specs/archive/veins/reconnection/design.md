# Reconnection / Resync — Design

Satisfies: R1, R2, R3, R4, R5, R6, P1, P2, P3

---

## Identity (R1)

The handshake seam already exists in `registerHandlers`:
```
const playerId = socket.data.playerId ?? socket.id;
```
We extend `ServerSocket` with an optional `handshake?: { auth?: Record<string, unknown> }` and read
the client-supplied stable id from it:
```
const authId = typeof socket.handshake?.auth?.playerId === 'string'
  ? socket.handshake.auth.playerId : undefined;
const playerId = authId ?? socket.data.playerId ?? socket.id;
```
Identity is per-connection, not per-message, so I2 holds. The id is an unguessable client-held
token (UUID) — guest-grade auth; real auth is future (see Security note).

Client: `getStablePlayerId()` reads/creates `sessionStorage['veins.playerId']` and is passed via
`io(url, { auth: { playerId } })`. The client uses it as `localPlayerId` everywhere (replacing
`socket.id`), so owner colours / "is this me" checks match the server. sessionStorage (not
localStorage) makes the id per-tab — two tabs are distinct players (local multi-client testing
works; no same-browser self-join collision) — while still surviving a reload so reconnection
holds. See DECISION_LOG 2026-06-24.

## Disconnect retention (R2)

New `Room.disconnectedPlayers?: Set<PlayerId>` (init `new Set()` in `createRoom`). 

`RoomManager.markDisconnected(code, playerId)`:
- room missing / player not a member → `{ ok: false }`.
- `status === 'lobby'` → delegate to `leaveRoom`, return `{ ok, mode: 'left', deleted, room }`.
- otherwise (in-progress) → add to `disconnectedPlayers`; if *all* players are now disconnected,
  delete the room (`deleted: true`); else `{ ok, mode: 'disconnected', deleted: false, room }`.

Ownership is **not** removed (board.slots + room.players are untouched), so synergy/board are
unchanged — the same guarantee solo-play relies on (ownership fixed at startRun).

## Rejoin + snapshot (R3, R4)

`RoomManager.rejoin(code, playerId)` validates (exists / in-progress / member), clears the
disconnected flag, returns the room.

`buildStateResync(room): StateResyncEvent` in `room/sync.ts` (next to `buildBoardStateSync`):
synergy is recomputed fresh (never cached, like board sync); bleedStage via `bleedStageOf`;
enemies filtered to `alive`; maps projected to records/arrays. `syncResyncToSocket(socket, room)`
emits to a single socket — `SocketLike` makes a room broadcast structurally impossible (P2).

`STATE_RESYNC` is the only full-state push besides the initial board sync (I6 exception).

## Socket events

| Event | Dir | Payload |
|-------|-----|---------|
| `rejoin` | C→S | `{ code: RoomCode }` |
| `STATE_RESYNC` | S→socket | `StateResyncEvent` (full snapshot) |
| `PLAYER_CONNECTION_CHANGED` | S→room | `{ playerId, connected }` |

Handlers in `index.ts`:
- `rejoin`: validate payload → `manager.rejoin` → on ok: set `socket.data.roomCode`, `socket.join`,
  emit `STATE_RESYNC` to the socket, broadcast `PLAYER_CONNECTION_CHANGED { connected: true }`;
  on fail: `LOBBY_ERROR`.
- `disconnect`: `manager.markDisconnected`; if `mode === 'disconnected'` and not deleted → broadcast
  `PLAYER_CONNECTION_CHANGED { connected: false }`; if `mode === 'left'` and not deleted → broadcast
  `ROOM_UPDATE` (preserves current lobby behaviour).

## Client (R6)

- `useSocket`: stable id via `auth`; `getStablePlayerId()` exported.
- `App`: `localPlayerId` initialised from `getStablePlayerId()`. Active room code persisted in
  `sessionStorage['veins.roomCode']` on `ROOM_UPDATE` / `STATE_RESYNC`, cleared on leave / run end.
  On `connect`, if a code is stored, emit `rejoin { code }`. On `STATE_RESYNC`, rebuild `runData`
  (board, synergy, registry, lootPool, dungeon, playerPositions from playerStates), set phase, and
  switch to the game screen.

## Scope boundary / follow-up

The interactive essentials (screen, board, dungeon, players, phase, bleed) are restored. **Enemy
and projectile *sprite* rehydration into the running Phaser scene on resync is a documented
follow-up** — the snapshot carries them, but `GameScene` currently spawns enemies only on
`ENEMY_SPAWNED`. Tracked as `TODO(build)` in OPEN-QUESTIONS; not in this spec's tasks.

## Security note (future)

A client claims its own UUID; a malicious client could claim another player's id to hijack their
slot, but UUIDs are unguessable (random), so this is guest-grade security equivalent to a session
token. Real authentication is future work (see OPEN-QUESTIONS).
