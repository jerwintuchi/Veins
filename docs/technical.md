# Testament — Technical (Overview)

> **Status:** Drafted (architecture + target hierarchy). Deep-dives in [technical/](technical/).
> **See also:** [README.md](README.md) · [technical/migration-plan.md](technical/migration-plan.md) · [DECISION_LOG.md](DECISION_LOG.md)

## Purpose

This file is the technical spine: how Testament is built, what it inherits from the
Veins prototype, and where everything lives. It is the map a new contributor reads
before touching code.

## Design Philosophy

- **Authoritative server, dumb client.** All game state lives on the server. The
  client renders signs and sends intentions. This is inherited wholesale from the
  prototype and is non-negotiable (see the trust boundary in CLAUDE.md).
- **Pure core, thin transport.** Game logic is pure functions returning result
  objects; the socket layer is thin plumbing over that core, abstracted behind an
  interface (`SocketIOServerLike` / `ServerSocket`). This is what makes the
  transport swap (below) contained rather than a rewrite.
- **Language-neutral protocol.** With a TypeScript server and a GDScript client,
  the wire protocol is the single source of truth. `src/shared` stops being "types
  both halves import" and becomes "the contract the server implements and the
  client mirrors," with shared constants codegen'd into GDScript.
- **Systems over content, data-driven.** Every gameplay system is designed assuming
  hundreds of future content rows, authored as data, not code.

## Stack

| Concern | Choice | Notes |
|---------|--------|-------|
| Client | Godot 4.x (GDScript), top-down 2D pixel art | HTML5/WASM export |
| Transport | Raw WebSocket + JSON message envelope | Replaces Socket.io (TD-002) |
| Server | Node + TypeScript, authoritative | Kept from prototype |
| Shared | TypeScript protocol contract + GDScript codegen | Was `@veins/shared` |
| Persistence | Supabase, thin account layer only | Identity, cosmetics, rank (TD-006) |
| Server deploy | Fly.io (holds WebSockets) | `Dockerfile`, `fly.toml` kept |
| Client deploy | Static host for the HTML5 export | `vercel.json` to be revisited |
| Tests | Vitest (server + shared) | Godot tests via GUT, later |

## Proposed directory hierarchy (target)

The recommendation favors **minimal churn**: keep the TypeScript workspace where it
is so the server's tests keep passing, remove the retired React client, and add the
Godot project as a sibling (it is not a node workspace member).

```
/
  CLAUDE.md                 root context
  README.md                 repo readme (Testament)
  package.json              pnpm workspace root (server + shared)
  pnpm-workspace.yaml       globs: src/server, src/shared
  tsconfig.base.json
  vitest.config.ts

  docs/                     the design bible (this reorg)
    systems/ content/ lore/ technical/ art/
    archive/veins/          retired prototype docs

  specs/                    R# / design / T# specs
    archive/veins/          retired prototype specs (planned move)
    <feature>/              future Testament specs

  src/
    server/                 authoritative Node server (kept; Veins rules pruned)
    shared/                 wire-protocol contract (kept; reshaped to protocol)

  client/                   Godot 4 project (NEW)
    project.godot
    scenes/ scripts/ assets/
    export presets -> HTML5

  tools/                    codegen (shared -> GDScript), build helpers (NEW)

  Dockerfile  fly.toml      server deploy (kept)
  .claude/                  agents + rules
```

Alternative considered: flatten `src/server` -> `server/` and `src/shared` ->
`shared/` for symmetry with `client/`. Rejected for v1 because it forces rewriting
every import path and the workspace globs for no functional gain. Tracked as a
future tidy-up, not part of this migration.

## Non-negotiable Rules

1. The seven netcode invariants in [.claude/rules/netcode-invariants.md](../.claude/rules/netcode-invariants.md) hold (server authority, never trust client, server-only seeded RNG, shared = no logic, delta events, ephemeral rooms). They are inherited from the prototype and survive the reboot.
2. The Incarnate trait roll never crosses the wire. Only signs do (CLAUDE.md invariant 3).
3. `src/shared` contains no game logic, only the protocol contract and constants.
4. No game state is persisted mid-expedition. Only the thin account layer persists.

## Implementation Notes

- **What is kept** from the prototype server: `RoomManager` and the room/session
  lifecycle, the 20Hz tick scheduler, seeded RNG, BSP dungeon/layout generation,
  movement and wall collision, projectiles, pathfinding, separation, and the
  `SocketIOServerLike` abstraction. See [technical/migration-plan.md](technical/migration-plan.md) for the full preserve/retire ledger.
- **What is retired:** the Veins game rules (Circulatory Board synergy, Bleed Clock,
  doctrine scoring, Linked Fates, loot pools) and the entire React/Phaser client.
- **Transport swap** is detailed in [technical/transport-migration.md](technical/transport-migration.md): reimplement `SocketIOServerLike` over `ws`, drop the socket.io dependency, keep every handler.

## Future Expansion

- A Godot MCP and an Aseprite import pipeline for visual iteration.
- The shared -> GDScript codegen step (`tools/`) as the protocol's enforcement mechanism.
- Optional later flatten of the `src/` workspace for symmetry with `client/`.
