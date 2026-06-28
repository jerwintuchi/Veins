# Content — Mutations (Future Expansion)

> **Status:** Draft (exploratory) — explicitly a future system, not in v1
> **Sources:** LORE_DESIGN.md §13 (Mutations); GPT_CHAT_HISTORY.txt (draft, Tumor/mutation notes)
> **See also:** [factions.md](../factions.md) (Tumorous Host) · [content/relic-roster.md](relic-roster.md) · [prototype-v1.md](../prototype-v1.md)

## Purpose

This file preserves the **mutation system** design intent so it survives until it's built. Mutations are how a Vessel *physically becomes* its choices — strength as morphology, not numbers. It is the mechanical body of the Tumorous Host doctrine. Explicitly **out of v1 scope** ([prototype-v1.md](../prototype-v1.md)); captured here as a forward design.

## Concepts

Players physically evolve during runs:
- visual sprite changes
- mechanical alterations
- identity shifts

> Strength is not numeric — it is **morphological**.

### Examples
- bone growth increases melee range
- multiple eyes improve vision
- tumors increase instability but power
- parasitic symbiosis alters relic behavior

### Relation to the Tumorous Host doctrine
Mutation is the mechanical heart of **Tumorous Host** (*"truth is constant becoming"* — see [factions.md](../factions.md)). Tumor relics (Growth Sac, Fractal Cell, Hematic Bloom, and the draft **Tumor** organ-relic) are the vocabulary that drives mutation — high-risk, high-reward, can spread to adjacent relics. See [relic-roster.md](relic-roster.md).

## Player Experience

A mutating Vessel should make the player feel they are **paying for power with identity**. You take the Tumor, you get a huge buff — and your body warps, your relics start behaving unpredictably, your silhouette changes so teammates can *see* what you've become. The intended tension is *I am stronger but I am no longer entirely myself / in control.* Over a run, the party should be able to look at each other and read their choices written on their bodies — emergent character, never a chosen skin.

## Design alignment

Mutations are *Lore = Mechanics* at the character layer ("the organism determines the function" — a Vessel's form *is* its build) and a pure rejection of *class systems* and *generic stat growth*: power is morphological and risky, not a numeric ladder. "Can spread to adjacent relics" makes mutation an *emergent* board phenomenon, tying it back to the Circulatory Board. It is the volatile counterweight to Sanctum's stability in the doctrine spread.

## Implementation Considerations

- **Not implemented; design only.** Nothing in code mutates Vessels today. **TODO(build):** entire system is unimplemented and under-specified. See [OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md) §C. When built, it must obey the established model: pure server-side state changes, deterministic (seeded) mutation rolls (I3), delta events for visual changes, client render-only.
- **Spreading mutations** interact with the board — they should run through the pure board-evaluation path, not a side channel, so they remain testable and deterministic (see [systems/circulatory-board.md](../systems/circulatory-board.md)).
- **Visual identity** is a render concern: mutations emit deltas the client draws (drop-in once sprites exist — see [art-bible.md](../art-bible.md)); the server never needs the art.
- **Doctrine coupling:** mutation usage is a Tumor-scoring signal — wire it into the existing doctrine hooks, no new event (see [systems/doctrine-tracking.md](../systems/doctrine-tracking.md)).

## Future Expansion

- A **mutation roster** (data-driven, like relics) with risk/reward profiles and spread rules.
- **Mutation-reactive relics** and **Sanctum counters** (Static Plate already exists in the paper roster to suppress negative mutation).
- **Emergent Vessel cosmetics** persisted to meta as a record of what a player keeps becoming (see [progression.md](../progression.md), [lore.md](../lore.md)).
- **Mutation-skewed Tumor rooms/bosses** where the environment itself mutates mid-run.
