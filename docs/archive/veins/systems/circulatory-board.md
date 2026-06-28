# System — Circulatory Board

> **Status:** Canon
> **Sources:** GLOSSARY.md (Circulatory Board, Relic Slot, HexCoord, Synergy); DESIGN.md (Core Innovation); SYSTEM DESIGN DOC.md §2.1; LORE_DESIGN.md §3
> **See also:** [systems/relics.md](relics.md) · [systems/linked-fates.md](linked-fates.md) · [systems/solo-play.md](solo-play.md) · [systems/doctrine-tracking.md](doctrine-tracking.md) · [technical/netcode.md](../technical/netcode.md)

## Purpose

The Circulatory Board is the **mechanical heart of Veins** — the system every other system bends toward. It is the literal object that makes "the party is one organism" true. This file specifies its structure, the synergy rule, ownership, and the purity guarantees that make it testable and deterministic. If you change one rule here, you change the identity of the game.

## Concepts

The **Circulatory Board** is the shared hexagonal relic board owned by the entire party — not by individual players.

- **19 hex cells** (a hex of radius 2). Every cell is owned by a player at run start.
- Each cell is a **Relic Slot**: a coordinate (HexCoord), an owner (PlayerId), and optionally a placed **Relic**.
- Ownership determines whose player border renders; synergy ignores ownership *except* to require different owners (relaxed for solo — see [solo-play.md](solo-play.md)).

### HexCoord
Axial coordinate pair `{ q, r }`. Six neighbors at offsets `(±1, 0)`, `(0, ±1)`, `(+1, −1)`, `(−1, +1)`.

### Synergy rule
A relic fires its **synergy** (strongest) effect when it is adjacent to another relic, **owned by a different player**, that shares at least one tag.

- Evaluated **server-side only**, as a pure function of board state (`evaluateSynergies`). Never computed on the client (invariant I5).
- Result broadcast as part of `RELIC_PLACED` / `RELIC_REMOVED` deltas.
- **Solo exception:** on a single-owner board the different-owner requirement is relaxed (see [solo-play.md](solo-play.md)). Tag-overlap always applies.

### Ownership — home quadrants
At `startRun`, the 18 outer cells are sorted by angle around the origin and split into N contiguous arcs (one per player); the center cell goes to the first player. Contiguous arcs give each player a coherent "home region" while guaranteeing cross-player borders, so cross-player adjacency (and therefore synergy) always exists for 2–4 players. Deterministic.

> Placement is decision, not inventory.

## Player Experience

The board is where the *conversation* happens. Between fights, players hover over each other's slots, spot that your `fire` relic sits one cell from their `fire` relic, and realize neither of them is firing its best effect yet — but a single swap would light both up. The intended beat is **mutual discovery**: a synergy you find *together* feels earned in a way a solo loadout never does. Because relics fire their strongest effect only across players, the board quietly forces talk, negotiation, and the occasional sacrifice of your own optimal placement for the party's.

## Design alignment

This is the spine's keystone. **Lore = Mechanics**: "one organism" is the shared board. **Mechanics = Theology**: placement is how the party writes its argument (adjacency = syntax, see [doctrines.md](../doctrines.md)). **Theology = Behavior**: the cross-player synergy rule *is* the forced-cooperation mechanism. It is the purest expression of *co-op as structure* and *emergence over hardcoded content* — no designer authors any specific party build; they arise from tags + adjacency + who owns what.

## Implementation Considerations

- **Pure functions, thin sockets.** All board operations — `placeRelic`, `reviveWithLinkedFates`, `advanceFloor`, `evaluateSynergies` — are pure: `(state, request) → newState + discriminated-union result` (`{ ok: true, board, event } | { ok: false, error }`). They never mutate inputs and never touch Socket.io. Handlers validate via the pure function, then emit the returned event(s). This is what keeps the core testable with zero network mocks.
- **`evaluateSynergies` is the single home of the ownership rule** — solo-ness is derived from the board's distinct-owner set, not threaded as a flag (see [solo-play.md](solo-play.md)). Keep it that way; it is invariant I5 and correctness-property P1 (pure, deterministic).
- **Persistence across floors:** descending carries the board **by reference** (never cloned/rebuilt) — asserted by a `toBe` identity test, not just deep-equality. See [bleed-clock.md](bleed-clock.md), [extraction.md](extraction.md).
- **Authority:** placement uses the authenticated socket's player id; a player may only place into a slot they own (`NOT_OWNER`); emitted events report `slot.ownerId` (server truth), never a client-supplied owner (I2).
- **Determinism:** synergy output is a pure function of board state — same board → same synergy map, always (P2). No `Math.random`, no time.

## Future Expansion

- **Pattern-aware synergy / doctrine signal**: distinguish chains vs clusters vs mirror-pairs vs isolates so "theology syntax" becomes mechanically real (feeds [doctrine-tracking.md](doctrine-tracking.md)).
- **Variable board topologies** (larger boards, blocked/scarred cells from mutations) as run modifiers — still deterministic.
- **Richer slot states** (corrupted, sanctified) that interact with doctrine, without breaking the pure-function model.
- Drag-and-drop placement + synergy preview on the client (render-only; the server stays authoritative).
