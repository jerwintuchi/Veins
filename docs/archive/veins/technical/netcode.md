# Technical — Netcode

> **Status:** Canon (summary — the binding rules live in `.claude/rules/netcode-invariants.md`)
> **Sources:** .claude/rules/netcode-invariants.md (I1–I7); DECISION_LOG.md (authoritative-server, delta-updates, socket-payload hardening entries)
> **See also:** [technical/architecture.md](architecture.md) · [technical/determinism-and-rng.md](determinism-and-rng.md) · [systems/combat.md](../systems/combat.md)

## Purpose

This file specifies **how server and clients communicate** and the seven invariants that keep the game authoritative, fair, and reproducible. Its job is to make "never trust the client" a checklist, not a slogan, so every new event handler is correct by construction.

## Concepts

### Model
Single authoritative server (Node + Socket.io). Clients receive **delta events** and render them only. Client-side prediction is deliberately deferred — room-based play with forgiving hit windows makes 50–80ms RTT imperceptible. Authoritative is simpler, correct by construction, and required for anti-cheat.

### The seven invariants (I1–I7)
1. **I1 — Server is the only source of truth.** All state in `src/server/`; clients send *intentions*, the server validates and applies.
2. **I2 — Never trust client input.** Validate shape (shared types) → validate legality given state → only then mutate. On failure, error to that socket only; never mutate, never broadcast.
3. **I3 — Seeded RNG is server-only and deterministic.** `runId` never leaves the server. ([determinism-and-rng.md](determinism-and-rng.md))
4. **I4 — `src/shared` contains no game logic.** Types, enums, constants, pure non-domain helpers only.
5. **I5 — All synergy evaluation is server-side and pure.** `evaluateSynergies` lives server-side, never called from the client; broadcast via `RELIC_PLACED` / `RELIC_REMOVED`.
6. **I6 — Delta events, not full state pushes.** After initial `BOARD_STATE_SYNC`, deltas only. Exceptions: reconnection / explicit `STATE_RESYNC`.
7. **I7 — Room state is ephemeral.** Active runs never persisted; lost on restart (acceptable for 20–40 min sessions). Only post-run meta persists.

### New-handler checklist
- [ ] Input validated against shared type before any mutation
- [ ] Action authorized (player in this room; legal in current phase)
- [ ] State mutation synchronous, returns new state
- [ ] Delta event(s) broadcast after mutation
- [ ] Error path emits to requesting socket only; no broadcast

### Hardening already done
Identity is server-derived everywhere: `placeRelic`/`revive` use the authenticated socket's player id, not a client field. Handlers shape-guard untrusted payloads (`isCoord`) and emit targeted error codes (`INVALID_COORD`, `INVALID_REQUEST`, `WRONG_PHASE`, …) instead of throwing. Room codes use `node:crypto` (unpredictable), deliberately outside the seeded-RNG mandate.

### Event catalogue (representative)
- **Lobby/room:** `ROOM_UPDATE`, `RUN_STARTED`, `RUN_ENDED`, `LOBBY_ERROR`, `FLOOR_ADVANCED`, `PHASE_CHANGED`, `STATE_RESYNC` (S→socket, reconnection), `PLAYER_CONNECTION_CHANGED`.
- **Board:** `BOARD_STATE_SYNC`, `RELIC_PLACED`, `RELIC_REMOVED`, `RELIC_PLACE_ERROR`, `LINKED_FATES_ERROR`, `BOARD_DOCTRINE_SHIFT`.
- **Bleed:** `BLEED_CLOCK_TICK`, `BLEED_STAGE_CHANGED`.
- **Combat:** `ENEMY_SPAWNED/DAMAGED/DIED/MOVED`, `PLAYER_DAMAGED/DOWNED/REVIVED/MOVED`, `PLAYER_AIM_CHANGED`, `PROJECTILE_FIRED/REMOVED`.

## Player Experience (indirect)

Players never see netcode, but they feel its absence-of-failure: no rubber-banding exploits, no desync where your board differs from a teammate's, no cheater spawning relics. The delta model keeps the game light enough to *open a URL and play* on a phone. `BOARD_DOCTRINE_SHIFT` carrying a doctrine-omitting payload is netcode directly enforcing the design's "no doctrine UI."

## Design alignment

The invariants are the spine's enforcement layer. I1/I2/I5 make *Theology = Behavior* tamper-proof (belief inferred from authenticated action). I3 makes *delayed consequence* and "the world reacted to us" reproducible. I6/I7 keep the game *browser-light and ephemeral* (supporting the $0 instant-play pitch). The "no client game logic" rule is the technical face of *no generic-client-trust*.

## Implementation Considerations

- **Testability seam:** sockets are typed against minimal `SocketIOServerLike` / `ServerSocket` interfaces so handlers test with fakes; the real `Server` is cast at one boundary in `startServer` (guarded by an `isMain` check so importing under tests never opens a port).
- **No new client-facing event for doctrine scoring** — it rides existing events; the only outward doctrine signal is the name-omitting `BOARD_DOCTRINE_SHIFT` (see [../systems/doctrine-tracking.md](../systems/doctrine-tracking.md)).
- **Reconnection/resync** is the *only* sanctioned full-state path (`STATE_RESYNC`); never re-push full state per tick (I6).

## Future Expansion

- **Reconnection / resync — implemented** (specs/reconnection): stable handshake identity, disconnect retention, and a single-socket `STATE_RESYNC` snapshot let a dropped player rejoin an in-progress run. Follow-up: enemy/projectile sprite rehydration (OPEN-QUESTIONS §C).
- **Client-side prediction** for movement if latency complaints arise (authority boundary unchanged).
- **Rate-limiting / abuse guards** at the socket layer as player counts grow.
- **Generated event contracts** from shared types to keep this catalogue honest.
