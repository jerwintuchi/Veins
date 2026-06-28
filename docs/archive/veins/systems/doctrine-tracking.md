# System — Doctrine Tracking (Hidden Scoring)

> **Status:** Canon
> **Sources:** SYSTEM DESIGN DOC.md §2.3; DECISION_LOG.md (2026-06-22 doctrine tracking system, R8–R11)
> **See also:** [doctrines.md](../doctrines.md) (concept) · [factions.md](../factions.md) (the four personified) · [cosmology.md](../cosmology.md)

## Purpose

This is the **implementation of belief**: the hidden machinery that watches how the party plays and lets the world respond. It is the technical engine of *delayed consequence* and *interpretive world design*. Its single hardest rule — never show the numbers — is what separates Veins from a generic alignment meter. The concept is in [doctrines.md](../doctrines.md); the personalities in [factions.md](../factions.md).

## Concepts

### The four hidden scores
Each run tracks four hidden integers on Room state: **Sanctum** (stability), **Tumor** (mutation volatility), **Chorus** (sync strength), **Penitent** (sacrifice tendency).

> The system does NOT show these values. Only effects are visible. (No score is ever sent to the client.)

### Influence sources
Scoring hooks into **existing events only** — no new event for scoring itself:

| Action / event | Effect |
|----------------|--------|
| stable adjacency usage (`RELIC_PLACED`) | Sanctum + |
| mutation relic usage | Tumor + |
| coordinated timing / kills (`ENEMY_DIED`) | Chorus + |
| sacrificing relics (`RELIC_REMOVED` via Linked Fates) | Penitent + |
| extract / wipe outcome | resolves alignment strength |

### Threshold effects (R8–R11)
All expressible as server-side number changes — no art/animation required:
- **Sanctum** threshold → drain-rate multiplier reduction.
- **Tumor** threshold → enemy attack-speed multiplier.
- **Chorus** threshold → ward protection doubling.
- **Penitent** threshold → free-revive flag.

### BOARD_DOCTRINE_SHIFT
When a threshold is crossed, the server emits `BOARD_DOCTRINE_SHIFT` — a **flavor-text toast only**. The doctrine name is intentionally **omitted** from the payload (preserving "no explicit doctrine UI" — see [ui-style-guide.md](../ui-style-guide.md)).

### Tagging
Doctrine tags (`sanctum`/`tumor`/`chorus`/`penitent`) are part of the `RelicTag` union, applied to the 10 existing relics; `void-lens` is intentionally neutral.

## Player Experience

The player should feel *acted upon* without knowing the rule. They never see "Sanctum 14." Instead, after a stretch of tidy, predictable play, the drain quietly eases — and a vague flavor toast hints something shifted. The intended experience is **superstition**: parties form theories ("I think the game likes it when we sacrifice") that are *partly* right, and the partial-knowledge is the fun. Revealing the scores would collapse this into spreadsheet optimization and kill the mystery.

## Design alignment

This file *is* **Theology = Player Behavior**, made literal: belief is inferred from action and the world responds. The hidden-score + threshold-effect + delayed-toast design is the canonical implementation of *delayed consequence* (nothing reacts per-input; reactions need sustained behavior) and *interpretive world design* (the world judges, silently). The "no score to the client" rule is the bible's strongest stand against *generic-RPG conventions*.

## Implementation Considerations

- **Server-only, never serialized to clients.** Scores live on Room state (ephemeral, I7). No event, log, or debug payload should leak a raw score. The *only* outward signal is `BOARD_DOCTRINE_SHIFT` with the doctrine omitted.
- **Hooks ride existing events** (`RELIC_PLACED`, `ENEMY_DIED`, `RELIC_REMOVED`, extract/wipe) — adding scoring must not introduce a new client-facing event or a synchronous one-input→one-effect path (that would break delayed consequence).
- **Determinism:** scoring is integer arithmetic over the deterministic event stream; given the same seed + same inputs, the same thresholds cross at the same time (reproducible "the world reacted to us"). No `Math.random` in the scoring/threshold path.
- **Current state:** scoring, tags, and the `BOARD_DOCTRINE_SHIFT` event are designed and landed (R8–R11); some **threshold effects are partially wired**. Agents: verify against code/`DECISION_LOG.md` before assuming a given effect is live. **Verified (2026-06-25):** all four threshold effects ARE wired and consumed — `bleedDrainMult`→`bleed/clock.ts`, `tumorAggressionActive`→`combat/roomCombat.ts`, `chorusVotiveBonus`→`roomCombat.ts`/`relic/effects.ts`, `penitentFreeRevive`→`index.ts` revive handler.
- **No decay in v1.** A documented future option: multiply each score by 0.85 on floor descent.

## Future Expansion

- **Pattern-aware inputs**: score the *shape* of placement (chains/clusters/mirrors/isolates) so the "theology syntax" of [doctrines.md](../doctrines.md) becomes a real signal.
- **World-side tells**: feed dominant doctrine into room aesthetics and enemy mix (deterministically) so players can *read* their doctrine in the world, still without a meter (see [factions.md](../factions.md)).
- **Cross-run doctrine identity** persisted to meta-progression for faction endings (see [progression.md](../progression.md), [lore.md](../lore.md)).
- **Score decay / recency weighting** so late behavior can shift a party's doctrine, keeping interpretation dynamic.
