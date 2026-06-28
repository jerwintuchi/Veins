# System — Solo Play

> **Status:** Canon
> **Sources:** DESIGN.md (Solo Play); specs/solo-play/ (requirements.md, design.md); SYSTEM DESIGN DOC.md §8.4 (the tension this resolves); DECISION_LOG.md (2026-06-24 entries)
> **See also:** [systems/circulatory-board.md](circulatory-board.md) · [pitch.md](../pitch.md)

## Purpose

This file specifies how Veins stays **playable by one person** without abandoning its co-op identity. It exists because the core synergy rule (fire only across *different* owners) would make a solo board inert. It documents the minimal, pure relaxation that keeps the board meaningful for one player while leaving co-op untouched.

## Concepts

### Why solo needs special handling
Veins is designed as forced co-op: synergy fires only between relics owned by **different** players. In a 1-player run every cell is owned by the lone player, so no synergy could fire and the core build mechanic would be dead.

> **Resolved design tension:** the original paper design (SYSTEM §8.4) said "co-op is structural; solo is degraded by design." The 2026-06-24 decision makes solo a **first-class, playable secondary mode** by relaxing the ownership rule for solo runs only. Co-op remains the headline experience.

### The rule
On a **single-owner board** (a solo run), the different-owner requirement is relaxed: adjacent same-tag relics synergize regardless of owner. The tag-overlap requirement still applies. Co-op boards (≥2 owners) are unchanged.

### How it's detected (pure, board-derived)
`evaluateSynergies` derives solo-ness from the board itself:
```
owners    = distinct set of slot.ownerId across all 19 slots
soloBoard = owners.size <= 1
if (!soloBoard && neighbor.ownerId === slot.ownerId) continue;  // skip own-relic only in co-op
```
Exact because `buildInitialBoard` assigns every cell an owner → distinct-owner count equals party size. No flag threaded through the six call sites; no player-count parameter — the function stays pure (I4/I5).

### Starting solo
`MIN_PLAYERS_TO_START = 1` (in `@veins/shared`) — the single source both the server gate (`RoomManager.startRun`) and the client lobby (`WaitingRoom`) read. `DEV_MIN_PLAYERS` can now be set *higher* (e.g. 2) to force co-op-only for testing.

### Edge case — player leaves mid-run
Slot ownership is fixed at `startRun`. A 2-player run that drops to 1 connected player keeps its 2-owner board, so it retains co-op rules. Solo relaxation applies only to runs *started* solo. Intended.

## Player Experience

A solo player gets a board that still *does something* — adjacency still matters, synergies still light up — so the central pleasure of Veins (assembling a build that talks to itself) survives. But it should feel, deliberately, like **playing a duet alone**: competent, not complete. The co-op magic of discovering a synergy *with another person* is structurally absent, and that's by design — solo is the practice room, not the concert.

## Design alignment

Solo is the careful exception that proves the *co-op-as-structure* rule. The board-derived detection is a model of *emergent over hardcoded*: solo-ness is computed from state, not configured. Crucially it preserves the spine — a solo board is still theology made playable — while honestly accepting that one of the four links (forced cross-player cooperation) is loosened. The pitch tension is acknowledged, not hidden (below).

## Implementation Considerations

- **Single home for the rule:** the relaxation lives only in `evaluateSynergies`. Do not re-implement solo handling in placement, linkedFates, roomCombat, weapon, sync, or index — they all read the one pure function (P1, P2: pure + deterministic for both solo and co-op boards).
- **Test shape:** solo board → adjacent same-tag relics both synergize; solo board → no shared tag still doesn't synergize; co-op board → same-owner adjacency does NOT synergize; co-op board → different-owner shared-tag DOES; determinism on repeat calls. (See `specs/solo-play/`.)
- **No new events, no trust-boundary change.** Solo is a logic relaxation, not a protocol change.

## Future Expansion

- **Multi-quadrant solo** (one player owns several *virtual* owners, restoring true cross-owner synergy) — closest to co-op feel; deferred as the largest change.
- **Explicit "practice mode" framing** in the lobby so solo's relaxed rules are honest to the player and to the pitch.
- **Solo-tuned balance** (Bleed/enemy counts) if solo becomes a supported competitive context (e.g. seeded daily challenges — see [progression.md](../progression.md)).

## Pitch conflict (flagged for product)

The tagline "a roguelike you literally cannot beat by yourself" still sits on the lobby. Co-op is the headline; solo is a relaxed secondary mode. The literal wording is left as-is pending a product call. **TODO(decide):** keep tagline, reframe solo as "practice mode", or reword. See [OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md) §B. See [pitch.md](../pitch.md).
