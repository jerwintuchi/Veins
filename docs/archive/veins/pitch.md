# Veins — The Pitch

> **Status:** Canon
> **Sources:** DESIGN.md ("The Pitch", "Core Innovation"); LORE_DESIGN.md §1, §17, §18
> **See also:** [vision.md](vision.md) · [systems/circulatory-board.md](systems/circulatory-board.md) · [cosmology.md](cosmology.md)

## Purpose

The pitch is the **30-second test**. It exists to be repeated verbatim by a stranger and to keep every other document honest: if a file drifts from what's promised here, one of them is wrong. It is the elevator pitch, the hook, and the identity statement in one place.

## Concepts

### One line

> A roguelike you literally cannot beat by yourself.

### The pitch

A browser-based 2D top-down co-op action roguelike with extraction tension. 2–4 players join via room code, run 20–40 min dungeons, and share meta-progression that persists across months of play. No app stores, no installs — open a URL and play.

### The core innovation — Circulatory Board

Every other co-op roguelike gives each player their own loadout that stacks additively (Gungeon = two separate guns, RoR2 = items don't interact between players). Veins inverts this:

**The party shares one hexagonal relic board.** Relics only fire their strongest effect when adjacent to a teammate's compatible relic. The build space is combinatorial across players, not additive — you optimize the *party organism*, not your own loadout.

> The party is a single organism, not separate characters.

Full mechanic: [systems/circulatory-board.md](systems/circulatory-board.md). Solo runs relax the cross-player rule: [systems/solo-play.md](systems/solo-play.md).

### Lore framing

In fiction, players are not heroes — they are **Vessels**, descendants of humanity awakening inside a collapsing cosmic-biological structure. They descend not for power but because reality is destabilizing and the **Pulse** is fading. Builds are beliefs; bosses are doctrinal tests; the world is an interpretive system; the **Heart** is a reality engine that responds to collective interpretation. See [lore.md](lore.md) and [cosmology.md](cosmology.md).

## Player Experience

The pitch promises a specific feeling, not a feature list: the moment two players realize their relics *complete each other* and neither works alone. The hook is **mutual dependence as fun**, sold in one sentence ("you cannot beat it by yourself") and delivered by one mechanic (the shared board).

## Design alignment

The pitch is the spine in compressed form: the *lore* (one organism) **is** the *mechanic* (shared board), which is *theology* (a build is a shared belief), which is read from *behavior* (you must cooperate to make it fire). It leads with co-op-as-structure and rejects generic-RPG framing (no classes, no hero fantasy) in its first breath.

## Core design identity

> A co-op roguelike where reality interprets player ideology and responds in kind.

> The game does not contain a world. It contains a system that decides what the world is based on what players consistently believe while playing.

## Implementation Considerations

- The one-liner is also a **product-facing claim on the lobby UI**, and it is in tension with supported solo play. That conflict is tracked, not resolved: see [systems/solo-play.md](systems/solo-play.md) ("Pitch conflict"). Any wording change is a product decision, logged in `DECISION_LOG.md`.
- "Open a URL and play / free at $0" are load-bearing constraints on the whole stack (browser-first, ephemeral rooms, free tiers). They are not marketing — they gate engine and hosting choices. See [technical/stack-and-deployment.md](technical/stack-and-deployment.md).

## Future Expansion

- A tightened public-facing tagline that survives solo support without abandoning the "cannot beat it alone" identity (e.g. framing solo explicitly as a relaxed practice mode).
- A 60-second capsule (store/landing copy) derived from this file once the first biome and boss are playable end-to-end.
