# Testament — Technical (Overview)

> **Status:** Drafted. Deep-dives in [technical/](technical/).
> **See also:** [README.md](README.md) · [DECISION_LOG.md](DECISION_LOG.md)

## Purpose

The technical spine: how Testament is built and where everything lives. The map a
new contributor reads before touching code.

## Design Philosophy

- **Authoritative server, dumb client.** All game state lives on the server; the
  client renders signs and sends intentions (see the trust boundary in CLAUDE.md).
- **Pure core, thin transport.** Game logic is pure functions returning result
  objects; the socket layer is thin plumbing over that core, abstracted behind an
  interface (`SocketIOServerLike` / `ServerSocket`) so the transport swap stays contained.
- **Language-neutral protocol.** With a TypeScript server and a GDScript client, the
  wire protocol is the single source of truth: `src/shared` is the contract the
  server implements and the client mirrors, with constants codegen'd into GDScript.
- **Systems over content, data-driven.** Every system is designed assuming hundreds
  of future content rows, authored as data, not code.

## Stack

| Concern | Choice | Notes |
|---------|--------|-------|
| Client | Godot 4.x (GDScript), top-down 2D pixel art | HTML5/WASM export |
| Transport | Raw WebSocket + JSON message envelope | Replaces Socket.io (TD-002) |
| Server | Node + TypeScript, authoritative | |
| Shared | TypeScript protocol contract + GDScript codegen | wire-protocol types and constants |
| Persistence | Supabase, thin account layer only | Identity, cosmetics, rank (TD-006) |
| Server deploy | Fly.io (holds WebSockets) | `Dockerfile`, `fly.toml` |
| Client deploy | Static host for the HTML5 export | `vercel.json` to be revisited |
| Tests | Vitest (server + shared) | Godot tests via GUT, later |

## Directory hierarchy

```
/
  CLAUDE.md                 root context
  README.md
  package.json              pnpm workspace root (server + shared)
  pnpm-workspace.yaml
  tsconfig.base.json  vitest.config.ts

  docs/                     the design bible
    systems/ content/ lore/ technical/ art/

  specs/                    R# / design / T# specs (per feature)

  src/
    server/                 authoritative Node server
    shared/                 wire-protocol contract (types + constants only)

  client/                   Godot 4 project (planned)

  tools/                    codegen (shared -> GDScript), build helpers (planned)

  Dockerfile  fly.toml      server deploy
  .claude/                  agents + rules
```

## Non-negotiable Rules

1. The seven netcode invariants in [.claude/rules/netcode-invariants.md](../.claude/rules/netcode-invariants.md) hold (server authority, never trust client, server-only seeded RNG, shared = no logic, delta events, ephemeral rooms).
2. The Incarnate trait roll never crosses the wire; only signs do (CLAUDE.md invariant 3).
3. `src/shared` contains no game logic, only the protocol contract and constants.
4. No game state is persisted mid-expedition; only the thin account layer persists.

## Implementation Notes

- **The server today** is a clean skeleton: the room / lobby / reconnection lifecycle
  (`RoomManager`), seeded RNG, BSP dungeon generation, collision, pathfinding, and
  player movement, behind the `SocketIOServerLike` seam. The prototype's game rules
  and ranged-combat loop were removed (DECISION_LOG TD-019); the Testament expedition
  loop is built on top of this skeleton from Phase 3.
- **Transport swap** ([technical/transport-migration.md](technical/transport-migration.md)):
  reimplement `SocketIOServerLike` over `ws`, drop socket.io, keep every handler.

## Future Expansion

- A Godot MCP and an Aseprite import pipeline for visual iteration.
- The shared -> GDScript codegen step (`tools/`) as the protocol's enforcement mechanism.
