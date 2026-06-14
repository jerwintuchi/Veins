# Netcode Invariants

These invariants must hold at all times. If a proposed implementation would violate one, stop and flag it before writing code.

## I1 — Server is the only source of truth
All game state lives in `src/server/`. Clients have a *render copy* derived from server events. No game state originates from client input — clients send *intentions* (e.g., "I want to place this relic here"), and the server validates and applies them.

## I2 — Never trust client input
Every Socket.io message from a client is untrusted. Before acting on any client event:
1. Validate the payload shape (use shared types from `@veins/shared`)
2. Validate the action is legal given current server state (correct room, correct turn, slot is empty, etc.)
3. Only then mutate server state

If validation fails: emit an error event back to that client only, do not mutate state, do not broadcast.

## I3 — Seeded RNG is server-only and deterministic
- The run seed (`runId`) never leaves the server
- All procedural generation (dungeon layout, loot tables, enemy spawns) runs server-side, seeded from `runId`
- Same `runId` → identical dungeon, identical loot sequence, always
- If you need randomness on the server, use the seeded RNG, not `Math.random()`

## I4 — src/shared contains no game logic
`src/shared/` exports types, interfaces, enums, and string/numeric constants only. No functions that compute game state. No functions with side effects. Shared utilities must be pure transformations with no domain knowledge (e.g., `hexCoordKey(q, r)` is fine; `evaluateSynergies(board)` is not — that lives in `src/server/`).

## I5 — All synergy evaluation is server-side and pure
`evaluateSynergies(board, registry)` is a pure function. It lives in `src/server/`. It is never called from `src/client/`. The result is broadcast as part of `RELIC_PLACED` / `RELIC_REMOVED` events.

## I6 — Delta events, not full state pushes
After the initial `BOARD_STATE_SYNC` on room join, the server sends delta events only. Never re-broadcast the entire game state on every tick. Exceptions: reconnection, desync recovery (explicit `STATE_RESYNC` event).

## I7 — Room state is ephemeral
Nothing about an active run is written to Supabase mid-run. Rooms exist in server memory only. On server restart, active rooms are lost (acceptable — sessions are 20–40 min). Only post-run meta-progression data (unlocks, stats) is persisted.

## Checklist for any new server event handler
- [ ] Input validated against shared type before any state mutation
- [ ] Action authorized (player is in this room, it's a legal action in current game phase)
- [ ] State mutation is synchronous and returns new state
- [ ] Appropriate delta event(s) broadcast to room after mutation
- [ ] Error path emits error only to the requesting socket, does not broadcast
