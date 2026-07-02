# Requirements — Raw WebSocket Transport

The transport that lets the Godot client (raw `WebSocketPeer`) talk to the
authoritative server, replacing Socket.io (DECISION_LOG TD-002). Plumbing only:
no game logic lives here.

**R1**: As the wire, every message is a JSON envelope `{ "type": <string>, "payload": <data> }`.
- AC: `encodeMessage(type, payload)` then `decodeMessage` round-trips to `{ type, payload }`.
- AC: `decodeMessage` returns `null` for non-JSON, for non-objects, and when `type` is missing or not a string.

**R2**: As the server, the transport implements the `ServerHub` / `ServerSocket` seam so the
existing handlers run unchanged over raw WebSocket.
- AC: with `registerHandlers(hub, manager)` wired, a `create-room` message from a connection
  produces a `ROOM_UPDATE` message back to that same connection.

**R3**: As the server, `to(room).emit` reaches exactly the sockets that joined that room.
- AC: two sockets that `join(room)` both receive a `to(room).emit`; a socket that did not join does not.

**R4**: As the server, a connection's identity comes from the URL query (`?playerId=...`) and is
exposed as `handshake.auth.playerId` — connection-derived, never a per-message field (I2).
- AC: a connection whose url is `/?playerId=abc` yields `socket.handshake.auth.playerId === 'abc'`.
- AC: a connection with no `playerId` query yields no `handshake.auth.playerId` (handlers fall back to the socket id).

**R5**: As the server, closing a connection fires the socket's `disconnect` listener and removes
it from every room.
- AC: firing close calls a registered `disconnect` listener and the socket no longer receives `to(room).emit`.

**R6** (correctness): The transport is pure plumbing: it imports no game modules and never
mutates room state.
- AC: `src/server/src/transport/**` imports nothing from `room/`, `dungeon/`, or `combat/`.
