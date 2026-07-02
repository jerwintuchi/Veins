# Tasks — Raw WebSocket Transport

- [x] T1 [R1, P1] — `encodeMessage` / `decodeMessage` in `src/server/src/transport/protocol.ts`
  Test: `protocol.test.ts` — round-trip; null on malformed / non-object / missing-type.
- [x] T2 [R2] — the seam interfaces (`ServerSocket`, `RoomEmitter`, `ServerHub`) in `src/server/src/transport/types.ts`, imported by `index.ts`.
  Test: covered by the wsHub integration test (T3).
- [x] T3 [R2, R3, R4, R5, P2, P3] — `WsHub` + `WsServerSocket` + `attachWebSocketServer` in `src/server/src/transport/wsHub.ts`
  Test: `wsHub.test.ts` — handshake playerId from url; on/emit dispatch by type; room broadcast reaches only joined sockets; disconnect fires + unrooms; integration: `registerHandlers` + `create-room` -> `ROOM_UPDATE`.
- [x] T4 [R2] — swap `startServer` to `ws.WebSocketServer` + `attachWebSocketServer`; rename the seam (`SocketIOServerLike` -> `ServerHub`) and move it to `transport/types.ts` in `index.ts`.
  Test: existing `manager.test.ts` stays green; `tsc` build clean.
- [x] T5 — add `ws` + `@types/ws`, remove `socket.io` from `src/server/package.json`.
  Test: `pnpm -r test` green after install.
