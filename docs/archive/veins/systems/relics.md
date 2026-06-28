# System — Relics

> **Status:** Canon
> **Sources:** GLOSSARY.md (Relic); SYSTEM DESIGN DOC.md §2.4; LORE_DESIGN.md §8
> **See also:** [content/relic-roster.md](../content/relic-roster.md) (the concrete list) · [systems/circulatory-board.md](circulatory-board.md) · [doctrines.md](../doctrines.md)

## Purpose

This file specifies the **relic system** — the data shape and rules every relic obeys — independent of any specific relic. Its job is to keep relics *data-driven and composable* so that content (the actual relics) is added without new code paths. The concrete catalogue lives in [content/relic-roster.md](../content/relic-roster.md).

## Concepts

A **Relic** is an item placed on the Circulatory Board. It has:
- a **base effect** (always active),
- a **synergy effect** (fires only when adjacency conditions are met — see [circulatory-board.md](circulatory-board.md)),
- one or more **tags** (e.g. `fire`, `aoe`, `party`, `poison`, plus doctrine tags `sanctum`/`tumor`/`chorus`/`penitent`).

In design terms relics are **modular rule modifiers applied to board slots**. In fiction they are **arguments about how reality works** (see [doctrines.md](../doctrines.md)).

### Relic types (paper design)
Passive · Conditional · Synergy-triggered.

### Slot rules
- 1 relic = 1 board node.
- Adjacency modifies effect.
- Cross-player adjacency = amplified (synergy) effect.

### Combat effects (implemented)
Relic effects resolve in combat via pure functions `evaluateRelicHit` / `evaluateIncomingDamage`. Currently wired:
- **ember-core** — bonus damage + splash.
- **torch-brand** — fire DoT (`fireDurations` per enemy).
- **arc-bolt** — chain lightning to nearby enemies.
- **iron-skin** — incoming damage reduction.

These emit `ENEMY_DAMAGED` deltas for splash, chain, and fire-DoT hits. See [combat.md](combat.md).

## Player Experience

A relic should read first as a *capability* ("this one sets things on fire") and second as a *connection point* ("...and it gets much better next to another fire relic — whose? a teammate's"). The reward loop is recognizing that a relic's printed base effect is the boring half; the real power is latent, unlocked only by placement and partnership. Picking a relic from the loot tray should feel like choosing a *word to say to the party*, not grabbing the highest number.

## Design alignment

Relics are the unit of **Mechanics = Theology**: each is an argument, its tags are its connotations, and synergy is agreement between arguments. The tag-driven, base+synergy model is *emergence over hardcoded content* — designers ship tags and effects, not bespoke combos; the interesting builds are discovered, not authored. Keeping a relic's *best* effect cross-player serves *co-op as structure*.

## Implementation Considerations

- **Data-driven:** a relic is data (id, tags, base/synergy effect descriptors) in `@veins/shared`; combat resolution is pure (`evaluateRelicHit` / `evaluateIncomingDamage`), server-side (I1, I5). Adding a relic should mean adding data + (if a new effect kind) one pure handler — never a new socket path.
- **Tags are the contract** between relics, synergy, and doctrine scoring. The `RelicTag` union holds gameplay tags *and* doctrine tags; a relic may carry several or be neutral (`void-lens`). Doctrine scoring reads these tags (see [doctrine-tracking.md](doctrine-tracking.md)).
- **Loot:** per-floor pools offer `min(3, unplaced)` relic IDs via seeded Fisher-Yates (deterministic per `runId#floor#loot`). A relic must be in the current pool to be placed (`RELIC_NOT_IN_POOL`). See [extraction.md](extraction.md), [technical/determinism-and-rng.md](../technical/determinism-and-rng.md).
- **Roster reconciliation:** the implemented set is 10 (`STARTER_RELICS`); the paper design lists 12; a draft "relics-as-organs" set exists. The implemented set is the source of truth for *current behavior*. See [content/relic-roster.md](../content/relic-roster.md).

## Future Expansion

- **More effect kinds** (mutation/adaptive, sacrifice-conversion, synchronized-cooldown) to give each doctrine a fuller vocabulary — each as a pure resolver.
- **Relic rarities / upgrades** and **multi-pick loot**, gated to preserve build-space depth over power creep (see [progression.md](../progression.md)).
- **Mutation-reactive relics** (effects that change as the board or Vessel mutates — see [content/mutations.md](../content/mutations.md)).
- **Pattern-sensitive effects** that care about chain vs cluster vs mirror placement (ties to [doctrines.md](../doctrines.md) syntax).
