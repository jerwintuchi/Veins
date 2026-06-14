# Veins — Root Context

@docs/DESIGN.md
@docs/GLOSSARY.md

## Trust Boundary

| Layer  | Path           | Role                                                          |
|--------|----------------|---------------------------------------------------------------|
| Server | `src/server/`  | Authoritative. All game state lives here. Never trust client. |
| Shared | `src/shared/`  | Types + constants only. No logic. Single source of truth.     |
| Client | `src/client/`  | Render + UI only. Untrusted. Zero game logic.                 |

## Active Spec
<!-- SWAP THESE THREE LINES when switching features — one of the few times you edit this file -->
@specs/multiplayer-rooms/requirements.md
@specs/multiplayer-rooms/design.md
@specs/multiplayer-rooms/tasks.md

## Workflow Rules
@.claude/rules/spec-workflow.md
@.claude/rules/netcode-invariants.md

## Key Invariants
1. Seeded RNG is deterministic: same run ID → same dungeon, always.
2. No client-originated game state. Clients receive delta events and render them — nothing more.
3. Relic adjacency and synergy are always evaluated server-side.
4. `docs/DECISION_LOG.md` is append-only — never edit past entries, only add new ones.
5. Every task (T#) must cite a requirement (R#) and name a test before being marked done.
