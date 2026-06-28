# Veins — Lore & Narrative

> **Status:** Canon
> **Sources:** LORE_DESIGN.md §2 (Core Fantasy), §14 (Core Narrative Problem), §15 (Ending Structure); GPT_CHAT_HISTORY.txt (draft, Vessels/character notes)
> **See also:** [cosmology.md](cosmology.md) · [factions.md](factions.md) · [progression.md](progression.md)

## Purpose

This file holds the **narrative frame** — who the players are, why they descend, and how a run "ends." It exists to keep fiction load-bearing: every story beat here must be expressible as a mechanic elsewhere in the bible. Lore that cannot be played is a bug, not a feature.

## Concepts

### Core Fantasy — The Vessels

Players are not heroes. They are:

> **Vessels** — descendants of humanity.

They awaken inside a collapsing cosmic-biological structure and descend not for power, but because:

> Reality is destabilizing and the "Pulse" is fading.

Vessels are deliberately *empty* — nameless bodies with no innate class or kit. They are defined entirely by the shared board, which is the whole point: identity is something the party *assembles*, not something a character sheet grants.

### Core Narrative Problem — why descend?

> Reality is destabilizing due to conflicting interpretations of existence.

The Pulse (reality engine) is fading. Without intervention, existence collapses into silence. The metaphysics of *why* — The Veins, The Heart, the competing interpretations — are detailed in [cosmology.md](cosmology.md).

### The Ending Structure

There is no single ending. Endings are layered and concurrent:

- **Run endings** — escape, wipe, sacrifice.
- **Zone endings** — local truths.
- **Cycle endings** — meta-progression milestones.
- **Faction endings** — interpretive conclusions (see [factions.md](factions.md)).

> Every ending is valid but incomplete.

## Player Experience

The player should never feel *told* a story. They feel a **situation**: you woke up inside something dying, you don't know who you were, and the only way to mean anything is to bind yourself to strangers. Narrative arrives through pressure and consequence, not cutscenes. An "ending" is something the party *causes* and then interprets afterward — "we sacrificed Mara to extract, and that became our truth" — rather than a reward screen that explains itself.

## Design alignment

Lore here is the *first link of the spine*: **Lore = Mechanics**. "Vessels are empty shells" **is** the no-class rule. "Reality is destabilizing because interpretations conflict" **is** the doctrine system and the Heart's behavior. "Every ending is valid but incomplete" **is** the layered, non-canonical run/meta outcomes — a direct rejection of the single triumphant generic-RPG finale. The fiction favors interpretation: it describes a world that *reacts*, never one that lectures.

## Implementation Considerations

- Lore is mostly *non-implemented surface* — its job is to constrain other systems, not to ship as text. The testable hooks are: the no-class invariant (no pre-run kit selection anywhere in lobby/room code), and the multiple-outcome `RunOutcome` (`EXTRACTED` / `WIPED`, with sacrifice/forced variants designed) feeding the post-run screen and meta layer. See [systems/extraction.md](systems/extraction.md), [progression.md](progression.md).
- Naming discipline: "Vessel," "the Pulse," "the Heart," "the Veins" are canonical terms — keep them in `GLOSSARY.md` if they enter code or UI strings.

## Future Expansion

- **Zone and faction endings** as concrete, interpretive end states (currently only run-level outcomes exist). These should emerge from accumulated behavior (which doctrine the party enacted), not from a chosen "path."
- A **Vessel cosmetic/identity layer** that is purely emergent (the body visibly shaped by the run's mutations and doctrine), never a class skin. Ties to [content/mutations.md](content/mutations.md).
- Light environmental storytelling (anatomical room names, residue of prior Vessels) that rewards interpretation without scripting a plot.

---

## Draft / Exploratory — Character design

> Mined from `GPT_CHAT_HISTORY.txt`. Reinforces the canonical Vessel framing; specifics not yet ratified.

Avoid classes. Vessels are **nameless bodies — empty shells**; the board shapes their role. This supports the core philosophy: *"the organism determines the function,"* not *"the Warrior tanks."*
