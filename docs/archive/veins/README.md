# Veins — Design Bible

The single navigable home for Veins design, lore, systems, and engineering docs. This bible is written for **two readers at once**: a human designer/engineer, and Claude Code (or any agent) implementing against it. Start with [pitch.md](pitch.md), then [vision.md](vision.md).

---

## The design spine (read this first)

Everything in this bible hangs off one equation. If a proposed feature breaks the chain, it does not belong in Veins.

> **Lore = Mechanics. Mechanics = Theology. Theology = Player Behavior.**

- **Lore = Mechanics.** Fiction is never decoration. The party is one organism *because* the board is shared. Reality is unstable *because* doctrines conflict. If a mechanic has no fictional meaning, or a fiction has no mechanical expression, cut or reconcile it.
- **Mechanics = Theology.** Systems are belief made playable. A relic is an *argument about how reality works*; placing it is *asserting* that argument; adjacency is *theological syntax*.
- **Theology = Player Behavior.** The game never asks players what they believe. It reads what they *do* under pressure and lets the world respond. Build = doctrine; doctrine = behavior under stress; behavior = the interpretation the world enacts.

Every file states how it serves this spine in its **Design alignment** note.

## Global design principles (favor / avoid)

These are binding guardrails, not preferences. Cited throughout.

**Favor**
- **Emergent systems** — outcomes arise from rules interacting, not from scripted content. Two relics + adjacency + a kill should produce a result no designer hand-authored.
- **Co-op as structure** — the core loop assumes a party; solo is a deliberately relaxed secondary mode, never the design center.
- **Delayed consequences** — the world reacts *after* behavior is established, creating the illusion of memory and intent. Immediacy is the enemy of interpretation.
- **Interpretive world design** — the world *reads* the party and responds. Meaning is assigned by the system to player action, not narrated at the player.

**Avoid**
- **Class systems** — roles emerge from the board, never from a pre-run pick. No "the Warrior tanks."
- **Hardcoded content** — prefer seeded generation, data-driven relics/enemies, and rules over bespoke encounters. Determinism + tags over scripts.
- **Generic RPG conventions** — no XP bars as the point, no loot-as-numbers-go-up, no doctrine meters shown to the player, no fantasy-hero framing.

---

## How to use this bible

**Every file follows the same skeleton** so both humans and agents can navigate predictably:

1. **Header** — `Status` (Canon / Draft (exploratory) / Mixed), `Sources`, `See also`.
2. **Purpose** — why the file exists and what decisions it governs.
3. **Concepts** — the canonical definitions.
4. **Player Experience** — what the player feels and does; the moment and the arc.
5. **Design alignment** — how it serves the spine + favor/avoid list.
6. **Implementation Considerations** — data shapes, server authority, determinism, events, tests (where applicable).
7. **Future Expansion** — where it goes next; deferred ideas; open questions.
8. **Draft / Exploratory** — fenced, non-canon material (mostly mined from `GPT_CHAT_HISTORY.txt`), with conflicts flagged.

**For humans:** read top-to-bottom for a system; the See-also links form the web.

**For Claude Code:** treat `Status: Canon` + `Implementation Considerations` as binding; treat `Draft / Exploratory` and `Future Expansion` as non-binding proposals — never implement them as if canon without ratification. The authoritative *current behavior* is the code and `DECISION_LOG.md`; this bible is intent. When they disagree, the file says so — surface it, don't silently pick one.

---

## Map

### Core
| File | What's in it |
|------|--------------|
| [pitch.md](pitch.md) | The one-liner, the elevator pitch, the core innovation, design identity |
| [vision.md](vision.md) | The design spine in full, why it works, target experience, design principles |
| [prototype-v1.md](prototype-v1.md) | The v1 vertical-slice scope, game loop, success criteria, build status |

### World & narrative
| File | What's in it |
|------|--------------|
| [lore.md](lore.md) | The Vessels, the narrative problem, endings |
| [cosmology.md](cosmology.md) | The Veins, The Heart, the interpretation system |
| [doctrines.md](doctrines.md) | Doctrine as concept (build = belief, theology syntax) |
| [factions.md](factions.md) | The four doctrines personified (identity, boss, room aesthetic) |

### Presentation
| File | What's in it |
|------|--------------|
| [art-bible.md](art-bible.md) | Visual/genre direction, palette, motion, audio |
| [ui-style-guide.md](ui-style-guide.md) | Controls, auto-aim, HUD inventory, UI direction |
| [progression.md](progression.md) | Meta-progression, rewards, endings-as-milestones |

### [systems/](systems/) — game mechanics
[circulatory-board](systems/circulatory-board.md) · [bleed-clock](systems/bleed-clock.md) · [linked-fates](systems/linked-fates.md) · [relics](systems/relics.md) · [doctrine-tracking](systems/doctrine-tracking.md) · [combat](systems/combat.md) · [extraction](systems/extraction.md) · [solo-play](systems/solo-play.md)

### [content/](content/) — concrete game content
[relic-roster](content/relic-roster.md) · [enemies](content/enemies.md) · [bosses](content/bosses.md) · [biomes](content/biomes.md) · [mutations](content/mutations.md)

### [technical/](technical/) — engineering
[architecture](technical/architecture.md) · [netcode](technical/netcode.md) · [determinism-and-rng](technical/determinism-and-rng.md) · [stack-and-deployment](technical/stack-and-deployment.md) · [code-map](technical/code-map.md)

### Reference (kept in place, not restructured)
| File | Role |
|------|------|
| [GLOSSARY.md](GLOSSARY.md) | Canonical terms — use exactly as written. Wired into `CLAUDE.md`. |
| [DECISION_LOG.md](DECISION_LOG.md) | **Append-only** dated build/architecture history. Never edit past entries. |
| [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md) | The unknown / undecided / unbuilt register. **Read before guessing.** Shrinks as items resolve. |
| `GPT_CHAT_HISTORY.txt` | Raw aesthetic brainstorm archive — the source for "Draft" material. |

---

## Maintenance contract

### Where does new content go?
| If it's… | …it goes in |
|----------|-------------|
| a concept / belief / narrative idea | `doctrines.md`, `factions.md`, `lore.md`, `cosmology.md` |
| a game *mechanic* (rules, how a system behaves) | `systems/` |
| concrete game *content* (a relic, enemy, boss, biome) | `content/` |
| visual / audio / UI direction | `art-bible.md`, `ui-style-guide.md` |
| an engineering decision or how something is built | `technical/` |
| a new canonical *term* | `GLOSSARY.md` |
| a dated decision / why something changed | append to `DECISION_LOG.md` (never edit) |

### Canon vs Draft
- **Canon** = derived from the original design docs and the implemented build.
- **Draft (exploratory)** = mined from `GPT_CHAT_HISTORY.txt` or proposed as future expansion. It always sits under a `## Draft / Exploratory` or `## Future Expansion` heading, and any conflict with canon (e.g. alternate faction names) is flagged inline. Promote draft → canon by ratifying it and removing the fence.

### Provenance
This bible was decomposed from five originals: `DESIGN.md`, `LORE_DESIGN.md`, and `SYSTEM DESIGN DOC.md` (migrated here and removed), plus `GLOSSARY.md` and `DECISION_LOG.md` (kept in place). `technical/` files are reader-facing summaries; the binding rules remain in `.claude/rules/` and the dated history in `DECISION_LOG.md`.
