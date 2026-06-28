# Testament — Design Bible

Testament is a cooperative hunting RPG with roguelike expedition structure. You
and up to three companions are **hunter-scholars of the Collegium**. You accept a
contract, form a theory about the Incarnate you are sent to study, stake your
preparation on that theory, and find out in the field whether you read it right.

> A hunt you win by understanding, not by memorizing.

## The Spine

> **Observe → Hypothesize → Test → Record.**

Testament is the scientific method dressed as a gothic hunt. Every system serves
one of those four verbs. If a proposed feature serves none of them, it is noise.

## The five pillars

1. **Preparation is as important as combat.**
2. **Knowledge is progression.**
3. **Incarnates are understood through interpretation, never memorization.**
4. **Cooperation is the primary pillar** (solo supported, never the center).
5. **Every expedition becomes another Testament.**

## How to read this bible

Modular by design. There is no single giant document. Each file states its
**Purpose, Design Philosophy, Non-negotiable Rules, Implementation Notes, and
Future Expansion**, so a reader can open exactly the layer they need.

| File | What it governs | Status |
|------|-----------------|--------|
| [vision.md](vision.md) | The constitution: pillars, spine, what every feature answers to | drafted |
| [gameplay.md](gameplay.md) | The expedition loop end to end: contract, prep, field, archive | drafted |
| [technical.md](technical.md) | Stack, transport, the kept-vs-retired ledger, the directory hierarchy | drafted |
| [ROADMAP.md](ROADMAP.md) | The gated phases from rebooted repo to a playable slice | drafted |
| [GLOSSARY.md](GLOSSARY.md) | Canonical terms, used exactly as written | drafted |
| [DECISION_LOG.md](DECISION_LOG.md) | Append-only record of why the game is the way it is | drafted |
| [lore.md](lore.md) | The Collegium, the Choirs, Incarnates, the world | drafted |
| [art.md](art.md) | Gothic ecclesiastical dark fantasy direction | placeholder |

### Deep-dive folders (placeholders, filled per roadmap phase)

- [systems/](systems/) — one doc per gameplay system (contracts, sign language, probing, loadout, perception, incarnates, combat, pressure, archive, scaling).
- [content/](content/) — data-driven catalogs (incarnates, sites, conditions, relics and rites, mutations, objectives and clauses).
- [lore/](lore/) — fiction deep-dives (collegium, choirs, cosmology, bestiary).
- [technical/](technical/) — architecture, protocol, [migration plan](technical/migration-plan.md), transport, determinism, persistence, Godot client, code map.
- [art/](art/) — visual style guide and audio direction.

## Lineage

Testament is built on the technical foundations of the **Veins prototype**: an
authoritative Node server, ephemeral in-memory rooms, a 20Hz combat tick, seeded
procedural generation, and a strict client/server trust boundary. That technology
is kept. The Veins *game design* (the Circulatory Board, the Bleed Clock, the
doctrine system) is retired. The prototype's documents are preserved unaltered in
[archive/veins/](archive/veins/) for reference.
