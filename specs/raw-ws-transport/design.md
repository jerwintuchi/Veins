# Design — Raw WebSocket Transport

Satisfies R1–R6. Replaces Socket.io with a raw-WebSocket adapter behind the same
seam the handlers already use, so `registerHandlers` and `runMovementTick` are unchanged.

## Data Models

```ts
// The wire envelope (the language-neutral contract the Godot client mirrors).
type Envelope = { type: string; payload: unknown };

// The seam the handlers depend on (transport-neutral; renamed from SocketIOServerLike).
interface ServerSocket {
  id: string;
  data: { playerId?: PlayerId; roomCode?: RoomCode | undefined };
  handshake?: { auth?: Record<string, unknown> };
  on(event, listener): void; emit(event, payload): void;
  join(room): void; leave?(room): void;
}
interface RoomEmitter { emit(event, payload): void }
interface ServerHub { on('connection', cb): void; to(room): RoomEmitter }

// The minimal raw socket satisfied by `ws.WebSocket` and test fakes.
interface RawSocket { send(string): void; close(): void; on('message'|'close', cb): void }
```

## Algorithms

- `encodeMessage(type, payload) = JSON.stringify({ type, payload })`.
- `decodeMessage(raw)`: guarded `JSON.parse`; require an object with a string `type`; else `null`.
- `WsHub` holds `rooms: Map<string, Set<ServerSocket>>` and the connection listener.
  - `acceptConnection(raw, url)`: parse `playerId` from the url query, wrap as `WsServerSocket`
    (registers the raw `message`/`close` handlers), then call the connection listener.
  - `to(room).emit(type, payload)`: look up the room set at emit time; send the encoded envelope to each member.
- `WsServerSocket`:
  - `on(type, fn)`: register; an incoming envelope of that `type` invokes the fns with its payload;
    a raw `close` invokes the `disconnect` listeners and removes the socket from all rooms.
  - `emit(type, payload)`: `raw.send(encodeMessage(...))`.
  - `join/leave(room)`: mutate the hub's room set.
- `attachWebSocketServer(wss)`: on each `connection (raw, request)`, `hub.acceptConnection(raw, request.url)`.

## Correctness Properties
- **P1**: encode/decode is a total round-trip; `decodeMessage` never throws (R1).
- **P2**: the transport holds and mutates no game state (R6).
- **P3**: identity is connection-derived (R4), upholding I2.

## Wire-Protocol Messages (current catalog)
- Client -> Server: `create-room`, `join-room {code}`, `rejoin {code}`, `leave-room`, `start-run`, `move-player {dx,dy}`.
- Server -> Client: `ROOM_UPDATE {room}`, `RUN_STARTED {dungeon, playerPositions}`, `PLAYER_MOVED {playerId,x,y}`,
  `STATE_RESYNC {...}`, `PLAYER_CONNECTION_CHANGED {playerId,connected}`, `LOBBY_ERROR {code,message}`.
- Identity: `?playerId=<id>` on the connection URL.

## Satisfies Requirements
R1 (protocol), R2 (WsHub seam), R3 (rooms), R4 (handshake), R5 (disconnect), R6 (purity).
