# Veins — Cosmology

> **Status:** Canon
> **Sources:** LORE_DESIGN.md §4 (System Philosophy), §5 (The World — The Veins), §6 (The Heart), §10 (Living World Simulation), §18
> **See also:** [lore.md](lore.md) · [doctrines.md](doctrines.md) · [systems/doctrine-tracking.md](systems/doctrine-tracking.md) · [systems/bleed-clock.md](systems/bleed-clock.md)

## Purpose

Cosmology defines the **rules of reality** in Veins — what the world *is*, what the Heart *does*, and why the world appears to have a memory. It is the bridge file: it translates abstract metaphysics ("reality is interpreted, not fixed") into the concrete systems (doctrine tracking, delayed reaction, adaptive bosses) that implement it. If a system needs to know "how should the world respond to the party?", the answer derives from here.

## Concepts

### The World — The Veins

The Veins are:

> A living interpretive structure beneath reality.

They function simultaneously as a **biological system**, a **reality engine**, and a **symbolic cosmology**. Each run is a 20–40 minute descent into this procedural biome-organism.

### The Heart (Core Entity)

The Heart is **NOT a boss**. It is:

> A reality interpretation engine.

It does not *create* reality — it *selects which interpretation becomes real*. Reality is unstable because multiple belief systems exist at once, factions impose conflicting truths, and interpretations compete for dominance. The Heart is the mechanism by which the party's enacted doctrine wins or loses that competition.

### Core System Philosophy

- Players express beliefs through builds (**Doctrine** — see [doctrines.md](doctrines.md)).
- Bosses test those beliefs under pressure (see [content/bosses.md](content/bosses.md)).
- The Heart reacts to consistent collective behavior.
- The world "interprets" player actions over time.

### Living World Simulation (the interpretation system)

The game simulates "aliveness" via hidden systems — chiefly **hidden doctrine tracking** (Sanctum / Tumor / Chorus / Penitent scores). Implementation: [systems/doctrine-tracking.md](systems/doctrine-tracking.md).

> **Key rule:** The world reacts with delay, not immediacy.

Delay is the whole trick: an immediate reaction reads as a game rule; a *delayed* reaction reads as **memory and intent**. The world seems alive because it appears to have decided about you over time.

### The Bleed Clock as cosmology

The Bleed Clock is, in fiction, the **interpretive instability of reality** made into a global pressure meter. Descent accelerates it, raises rewards, and lowers stability. Mechanics: [systems/bleed-clock.md](systems/bleed-clock.md).

## Player Experience

The player is meant to slowly suspect that *the world is paying attention.* Not through a narrator saying so, but through accumulating coincidence: a boss that punishes exactly the rigidity you've been leaning on, threats that arrive on a delay you can't quite pin to any single action. The intended feeling is **paranoid intimacy with the world** — the sense that it is reading you. Crucially, the player should never be *certain* how it works; legibility would kill the effect.

## Design alignment

This file is where **Theology = Player Behavior** closes back into **Lore**. The cosmology's single commitment — *reality is whatever consistent interpretation wins* — is the fictional justification for: hidden doctrine scores (belief is inferred from behavior), delayed thresholds (the world decides over time), and adaptive bosses (the world argues back). It is the engine of *interpretive world design* and *delayed consequence*, and it forbids any UI that would make the interpretation explicit.

## Implementation Considerations

- The cosmology has **no direct code object** — it is realized by other systems. The binding constraints it imposes are: (1) doctrine scores are **never** sent to the client (the Heart's judgment is hidden until it acts); (2) reactions are **threshold-gated and delayed**, never per-input; (3) the only player-visible signal of the Heart "deciding" is flavor-text (`BOARD_DOCTRINE_SHIFT`, doctrine name omitted). See [systems/doctrine-tracking.md](systems/doctrine-tracking.md).
- Determinism caveat: the world's "interpretation" must remain a pure function of accumulated behavior + seed, so that "the world reacted to us" is reproducible from a run ID (no `Math.random` in the reaction path). See [technical/determinism-and-rng.md](technical/determinism-and-rng.md).

## Future Expansion

- **The Heart as an end-of-cycle encounter** — not a boss to kill but an interpretation to tip. Its behavior would read the *meta*-accumulated doctrine across runs, not just the current run.
- **Competing-interpretation events**: mid-run moments where two doctrines are close, and the world visibly "can't decide," producing unstable hybrid rooms/enemies (emergent, not scripted).
- **Zone-level cosmology**: local truths (per-biome interpretive rules) that layer under the global Heart, supporting the "zone endings" in [lore.md](lore.md).

## Final statement

> The game does not contain a world. It contains a system that decides what the world is based on what players consistently believe while playing.
