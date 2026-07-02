# Testament — Godot Client

A Godot 4.x (GDScript) client. Right now it is the **Phase 1 transport spike**: it
connects to the authoritative server over raw WebSocket, auto-creates a room,
auto-starts a run, renders the procedural dungeon, and moves a Seeker. The Seeker's
position is authoritative (the client sends a direction; the server replies with
`PLAYER_MOVED`), which proves the round-trip.

## Run it

1. **Start the server** (from the repo root):
   ```bash
   pnpm install
   pnpm dev:server        # listens on ws://localhost:3001
   ```
2. **Open this `client/` folder in Godot 4.x** (Project Manager → Import → pick
   `client/project.godot`).
3. Press **Play (F5)**. You should see a dark dungeon and a gold circle (your
   Seeker). Drive it with the **arrow keys**. The top-left label shows connection state.

Open a second instance (or export) to see multiple Seekers in the same room... note
that this spike auto-creates a *new* room per client; shared-room join UI comes later.

## How it talks to the server

Raw WebSocket with a JSON envelope `{ "type": <string>, "payload": <data> }`
(see `docs/technical/` and `specs/raw-ws-transport/`). The client mirrors the same
message shapes the TypeScript server uses:

- **Out:** `create-room`, `start-run`, `move-player {dx,dy}`
- **In:** `ROOM_UPDATE`, `RUN_STARTED {dungeon, playerPositions}`, `PLAYER_MOVED {playerId,x,y}`, `LOBBY_ERROR`
- **Identity:** `?playerId=<id>` on the connection URL.

## HTML5 / Web export

`Project → Export → Add… → Web`, then Export. Serve the exported files over HTTP
(Godot's "Remote Debug → Run in Browser" also works). The renderer is set to GL
Compatibility so the web export runs broadly.

## Boundary

Render + input only. The client holds **zero game logic**; all state is server-authoritative.
