# Technical — Architecture

> **Status:** Canon (summary — authoritative source is the code, CLAUDE.md, and DECISION_LOG.md)
> **Sources:** CLAUDE.md (trust boundary, invariants); DECISION_LOG.md (stack, pnpm workspaces)
> **See also:** [technical/netcode.md](netcode.md) · [technical/determinism-and-rng.md](determinism-and-rng.md) · [technical/stack-and-deployment.md](stack-and-deployment.md)

## Purpose

This file is the **engineering orientation** — the shape of the codebase and the non-negotiable boundaries that make the design's "the world is authoritative and watching" claim *true in software*. It exists so a human or agent touching the code knows where state lives, what they may trust, and which invariants a change must not break.

## Concepts

### Trust boundary
| Layer  | Path           | Role                                                          |
|--------|----------------|---------------------------------------------------------------|
| Server | `src/server/`  | Authoritative. All game state lives here. Never trust client. |
| Shared | `src/shared/`  | Types + constants only. No logic. Single source of truth.     |
| Client | `src/client/`  | Render + UI only. Untrusted. Zero game logic.                 |

The line between `src/server/` (trusted) and `src/client/` (untrusted) is the **Trust Boundary**. `src/shared/` sits on the line — types and constants only.

### Workspace structure
pnpm workspaces with three packages: `src/server`, `src/client`, `src/shared`. Shared types via the `@veins/shared` reference. Strict dependency isolation; separate build pipelines (Vercel client, Fly.io server). See [stack-and-deployment.md](stack-and-deployment.md).

### Key invariants
1. Seeded RNG is deterministic: same run ID → same dungeon, always. ([determinism-and-rng.md](determinism-and-rng.md))
2. No client-originated game state. Clients receive deltas and render them — nothing more. ([netcode.md](netcode.md))
3. Relic adjacency and synergy are always evaluated server-side. ([../systems/circulatory-board.md](../systems/circulatory-board.md))
4. `docs/DECISION_LOG.md` is append-only — never edit past entries.
5. Every task (T#) must cite a requirement (R#) and name a test before being marked done.

### Core pattern — pure core, thin sockets
Game logic is pure functions returning discriminated-union results (`{ ok: true, ... } | { ok: false, error }`). Socket.io handlers are thin plumbing: validate via the pure function, then emit the returned event(s). The entire game-logic core is testable without a live server.

## Player Experience (indirect)

Architecture has no UI, but the player feels it as **fairness and continuity**: no cheating is possible (server authority), "the world reacted to us" is reproducible (determinism), and a synergy you place resolves the same way for everyone (single source of truth). The pure-core pattern is *why* the game can credibly claim to interpret behavior — the interpretation is one deterministic function of recorded events, not client guesswork.

## Design alignment

The trust boundary is *Lore = Mechanics* at the systems level: "the Heart is the sole authority over what's real" **is** "the server is the sole authority over game state." Server-only synergy/doctrine is what makes *Theology = Behavior* tamper-proof — belief is inferred from authenticated action, never asserted by a client. The pure-function discipline is what makes *delayed consequence* and *determinism* implementable and testable.

## Implementation Considerations

- **`src/shared` is types + constants only (I4).** No game logic crosses the boundary. `hexCoordKey(q,r)` is fine; `evaluateSynergies(board)` is not — it lives server-side. Shared constants that both render and simulate must use (e.g. `CORRIDOR_HALF_WIDTH`) live here precisely to stay in sync.
- **The pure/thin seam** is the integration point for every feature: write the pure function + tests first, then a thin handler. This is how 625 tests run with zero network mocks.
- **Append-only `DECISION_LOG.md`** is the project's memory and the tiebreaker when this bible and the code disagree.

## Future Expansion

- **Client-side prediction** (deliberately deferred) if latency ever becomes a user complaint — layered on without moving the authority boundary.
- **Horizontal scaling / room sharding** if concurrency grows (rooms are already ephemeral and independent — see [netcode.md](netcode.md)).
- A generated **event/contract reference** from the shared types so the bible's event catalogue can't drift from code.

> This file is a reader-facing summary. The binding rules live in `.claude/rules/netcode-invariants.md`; the dated history in [DECISION_LOG.md](../DECISION_LOG.md).
