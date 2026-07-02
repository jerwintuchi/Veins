# Netcode Invariants

These invariants must hold at all times. If a proposed implementation would violate
one, stop and flag it before writing code. They are foundational and non-negotiable.

## I1 — Server is the only source of truth
All game state lives in `src/server/`. Clients have a *render copy* derived from
server events. No game state originates from client input. Clients send *intentions*
(e.g., "I want to probe the Incarnate here"), and the server validates and applies them.

## I2 — Never trust client input
Every message from a client is untrusted. Before acting on any client event:
1. Validate the payload shape (use shared types from `@testament/shared`)
2. Validate the action is legal given current server state (correct room, correct phase, legal action, etc.)
3. Only then mutate server state

If validation fails: emit an error event back to that client only, do not mutate state, do not broadcast.

## I3 — Seeded RNG is server-only and deterministic
- The expedition seed never leaves the server
- All procedural generation (site layout, contract roll, Incarnate trait roll, spawns) runs server-side, seeded from the expedition seed
- Same seed → identical world, identical sequence, always
- If you need randomness on the server, use the seeded RNG, not `Math.random()`

## I4 — src/shared contains no game logic
`src/shared/` exports types, interfaces, enums, and string/numeric constants only,
plus the wire-protocol contract. No functions that compute game state. No side
effects. A pure key/format helper is fine; a function that derives signs from a
trait roll or generates a contract is not — that lives in `src/server/`.

## I5 — All game-state evaluation is server-side and pure
Evaluation functions (sign derivation from a trait roll, contract generation, hit
resolution, objective checks) are pure and live in `src/server/`. They are never
called from the client. Their results are broadcast as delta events. In particular,
an Incarnate's hidden trait roll never crosses the wire; only the *signs* derived
from it do.

## I6 — Delta events, not full state pushes
After the initial sync on room/expedition join, the server sends delta events only.
Never re-broadcast the entire game state on every tick. Exceptions: reconnection and
desync recovery (explicit `STATE_RESYNC` event).

## I7 — Expedition state is ephemeral
Nothing about an active expedition is persisted mid-run. Rooms and the session
Archive exist in server memory only. On server restart, active expeditions are lost
(acceptable; sessions are short). Only the thin account layer (identity, cosmetics,
Collegium rank, customization, career stats) is persisted (see DECISION_LOG TD-006).

## Checklist for any new server event handler
- [ ] Input validated against shared type before any state mutation
- [ ] Action authorized (player is in this room, it is a legal action in the current phase)
- [ ] State mutation is synchronous and returns new state
- [ ] Appropriate delta event(s) broadcast to room after mutation
- [ ] Error path emits error only to the requesting socket, does not broadcast
