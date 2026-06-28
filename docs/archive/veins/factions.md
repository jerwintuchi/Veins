# Veins — Factions (The Four Personified)

> **Status:** Mixed (canon four doctrines + draft meta-progression faction orgs)
> **Sources:** LORE_DESIGN.md §7 (Factions/Doctrines), §9 (Boss archetypes), §11 (Room-gen philosophy); GPT_CHAT_HISTORY.txt (draft, faction orgs)
> **See also:** [doctrines.md](doctrines.md) (concept) · [systems/doctrine-tracking.md](systems/doctrine-tracking.md) (scoring) · [content/bosses.md](content/bosses.md)

## Purpose

This file gives the four doctrines a **face**: identity, motto, the boss that embodies each, and the room aesthetic each produces. Where [doctrines.md](doctrines.md) is the theory, this is the *characterization* — the reference a designer or agent uses when asking "what does Tumor *look and feel* like in a room, a relic, a boss?" Each is an interpretive lens the world can adopt, not a team the player joins.

## Concepts — the four

Players unconsciously align based on playstyle (see [doctrines.md](doctrines.md)). Each entry below is an identity, its boss tendency, and its room aesthetic.

### 🟦 Sanctum — Stability / Order
Controlled positioning · predictable synergy · minimal mutation · balanced play.
> "Truth is stable form."
- **Relics:** isolation bonuses, stable adjacency rules, predictable scaling.
- **Boss tendency:** punishes chaos, rewards stability; reduces randomness, predictable patterns, punishes overconfidence.
- **Rooms:** geometric, symmetrical, predictable.

### 🟥 Tumorous Host — Mutation / Chaos
Adaptive builds · high-risk/high-reward · constant evolution · aggressive improvisation.
> "Truth is constant becoming."
- **Relics:** mutation mechanics, adaptive scaling, unpredictable transformation.
- **Boss tendency:** punishes rigidity, rewards adaptation; evolves mid-fight, changes patterns frequently.
- **Rooms:** organic, evolving mid-run, asymmetric.

### 🟩 Synaptic Chorus — Unity / Synchronization
Heavy coordination · shared effects · team dependency · perfect synergy scaling.
> "Truth is collective mind."
- **Relics:** shared cooldowns, linked vision, synchronized effects.
- **Boss tendency:** punishes isolation, rewards synchronization; mirrors player actions, punishes desync.
- **Rooms:** mirrored layouts, synchronized hazards, cooperative patterns.

### ⬛ Penitent — Sacrifice / Withdrawal
Resource sacrifice · hesitation-aware play · defensive pacing · loss-driven scaling.
> "Truth is surrender."
- **Relics:** sacrifice conversion, death-based scaling, restraint bonuses.
- **Boss tendency:** punishes hesitation, rewards sacrifice; punishes inactivity windows.
- **Rooms:** sparse, oppressive silence, delayed threats.

Boss embodiments and the v1 boss that adapts to the dominant doctrine: [content/bosses.md](content/bosses.md). Room aesthetics also feed [art-bible.md](art-bible.md) and [content/biomes.md](content/biomes.md).

## Player Experience

The four should be *recognizable without being named*. A player who has leaned Penitent should be able to walk into a Penitent-skewed room and feel it — the silence, the sparseness, the threat that arrives a beat late — and feel implicated, as if the world built this room *about them*. The factions are how the world shows the party its own reflection. Encountering a boss that embodies your dominant doctrine is the climactic version of that mirror.

## Design alignment

Factions are *interpretive world design* made concrete: the same four belief-axes manifest as relics, bosses, and architecture, so the world speaks in one coherent voice about what the party believes. They reinforce *delayed consequence* (the boss adapts to accumulated doctrine, not the last input) and *no class systems* (no one ever "is" a faction — the world assigns the lens based on behavior). The four are gradients, not rosters.

## Implementation Considerations

- The canonical four map directly to the doctrine tags (`sanctum`/`tumor`/`chorus`/`penitent`) and the hidden scores in [systems/doctrine-tracking.md](systems/doctrine-tracking.md). "Dominant faction" = highest score, server-side only.
- Boss adaptation reads dominant doctrine (see [content/bosses.md](content/bosses.md)); room aesthetics keying off dominant doctrine are **designed, not yet implemented** (dungeon gen is currently doctrine-agnostic — see [technical/determinism-and-rng.md](technical/determinism-and-rng.md)).
- Keep faction expression **data-driven**: a room or boss "being Sanctum" should be a function of tags/scores + seed, never a hand-placed bespoke encounter.

## Future Expansion

- **Doctrine-skewed room generation**: BSP output post-processed toward the dominant doctrine's aesthetic (geometric/organic/mirrored/sparse), deterministically.
- **Per-doctrine boss variants** beyond the single adaptive v1 boss.
- Reconcile the draft meta-faction orgs (below) with the canonical four before either ships.

---

## Draft / Exploratory — Meta-progression faction orgs

> Mined from `GPT_CHAT_HISTORY.txt`. **Conflict flag:** these names differ from the four canonical doctrines and are an alternate framing for *persistent meta-progression* allegiances, not a replacement. Reconcile before treating as canon.

- **The Platelets** — survivalists; extraction bonuses. *(maps loosely to Penitent/Sanctum survival play)*
- **The Marrow Cult** — sacrifice builds; revives. *(maps to Penitent)*
- **The Synapse Choir** — skill spam; chain effects. *(maps to Synaptic Chorus)*
- **The Tumorous Host** — corruption mechanics; risk/reward. *(matches the canonical Tumorous Host)*

These would be a *meta-layer* overlaid on the four in-run doctrines, not a second competing taxonomy. Decision pending. **TODO(decide):** meta-layer over the four, a rename, or cut? See [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md) §B.
