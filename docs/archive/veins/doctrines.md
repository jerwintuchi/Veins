# Veins — Doctrines (Concept)

> **Status:** Canon
> **Sources:** LORE_DESIGN.md §4, §8 (Relics as vocabulary), §12 (Adjacency = theology syntax), §16; SYSTEM DESIGN DOC.md §2.3 (conceptual), §8.1 (no doctrine UI)
> **See also:** [factions.md](factions.md) (the four personified) · [systems/doctrine-tracking.md](systems/doctrine-tracking.md) (the implementation) · [systems/relics.md](systems/relics.md)

## Purpose

This file defines **doctrine as a concept** — the theory that a build *is* a belief and that play *is* theology. It is the conceptual middle of the spine: it explains why mechanics encode meaning at all. The four personified factions live in [factions.md](factions.md); the hidden scoring lives in [systems/doctrine-tracking.md](systems/doctrine-tracking.md). Read this to understand *why* those exist.

## Concepts

### Build = Belief

Players unconsciously align with doctrines based on playstyle. A doctrine is **behavior under stress**, expressed through how the party builds the Circulatory Board.

> Build = Doctrine · Doctrine = Behavior under stress · Behavior = World interpretation

Players do not choose a doctrine. There is no doctrine select. There is only what they *do* when the Bleed Clock is draining and a teammate is down.

### The four axes

Each run trends along four belief axes (full identities in [factions.md](factions.md)):

- **Sanctum** — stability / order. *"Truth is stable form."*
- **Tumorous Host** — mutation / chaos. *"Truth is constant becoming."*
- **Synaptic Chorus** — unity / synchronization. *"Truth is collective mind."*
- **Penitent** — sacrifice / withdrawal. *"Truth is surrender."*

These are not mutually exclusive classes — a party drifts across all four simultaneously, and its *dominant* axis is an emergent property of thousands of small choices.

### Relics as doctrine vocabulary

Relics are not items. They are:

> Arguments about how reality works.

Each relic belongs loosely to a doctrine but can mix — a relic is a *word* with connotations, not a class-locked equipment slot. Concrete relics: [content/relic-roster.md](content/relic-roster.md); the relic *system*: [systems/relics.md](systems/relics.md).

### Relic adjacency = theology syntax

If relics are words, **placement is grammar**. The board is where arguments are assembled into a worldview:

- **Linear chains** → Sanctum logic (ordered, predictable)
- **Web clusters** → Tumor logic (entangled, volatile)
- **Mirror pairs** → Chorus logic (synchronized across players)
- **Isolation nodes** → Penitent logic (withdrawn, self-denying)

> Players unknowingly write ideology through builds.

## Player Experience

The player never thinks "I am playing Sanctum." They think "I want this to be *reliable*," and place relics in tidy, isolated, predictable patterns — and the world quietly concludes they are Sanctum and begins to test that. The intended experience is **recognition after the fact**: a boss punishes your rigidity, and you realize the game understood your style before you'd named it. Doctrine is a mirror the player didn't know they were looking into.

## Design alignment

This is the literal statement of **Mechanics = Theology**. It is the bible's strongest commitment to *emergence over hardcoded content* (doctrine is computed from tags + placement, never authored), to *interpretation over instruction* (the system infers belief; it never asks), and to *no class systems* (the four axes are gradients a party slides across, not roles it picks). The "no doctrine UI" rule is what keeps theology a felt thing rather than a number to min-max.

## Implementation Considerations

- Doctrine is **derived, never declared**: there is no doctrine field a client can set. It is computed server-side from relic tags (`sanctum`/`tumor`/`chorus`/`penitent`) and board adjacency, and from in-combat behavior. See [systems/doctrine-tracking.md](systems/doctrine-tracking.md).
- The four doctrine tags live in the `RelicTag` union; relics carry zero, one, or several. Keep some relics *neutral* (e.g. `void-lens`) so the vocabulary has connective tissue, not just four sealed colors.
- "Adjacency = syntax" is currently *conceptual* — the implemented synergy rule is tag-overlap between adjacent relics; the richer "chain vs cluster vs mirror = different doctrine signal" is a future scoring input, not yet code.

## Future Expansion

- **Pattern-aware scoring**: reward the *shape* of placement (chains vs clusters vs mirrors vs isolates), making the "theology syntax" mechanically real rather than thematic. **TODO(build):** unimplemented — synergy is tag-overlap only today. See [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md) §C.
- **Doctrine drift visibility through the world only** — environmental tells (room aesthetics shifting toward the dominant doctrine) that let players *read* their own belief in the world, still without a meter. Ties to [factions.md](factions.md) room aesthetics and [art-bible.md](art-bible.md).
- **Cross-run doctrine identity** feeding meta-progression and faction endings (see [progression.md](progression.md), [lore.md](lore.md)).
