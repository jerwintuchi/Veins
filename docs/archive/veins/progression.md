# Veins — Progression & Rewards

> **Status:** Canon
> **Sources:** DESIGN.md + GLOSSARY.md (Meta-progression); LORE_DESIGN.md §15 (Endings as milestones); SYSTEM DESIGN DOC.md §7 (Reward logic)
> **See also:** [systems/extraction.md](systems/extraction.md) · [lore.md](lore.md) · [technical/stack-and-deployment.md](technical/stack-and-deployment.md)

## Purpose

This file defines **what persists between runs and why** — the months-long meta horizon layered over 20–40 minute sessions. Its constraint: progression must expand the *interpretive build space* (more vocabulary, more ways for the world to read you) without becoming a generic power-creep treadmill. Progression is the slow theology; a run is the fast one.

## Concepts

### Meta-progression
Cross-run persistent data: **unlocked relics, cosmetics, achievement flags**. This is the *only* data that hits the database (Supabase). Active runs are never persisted (invariant I7 — see [technical/netcode.md](technical/netcode.md)).

Meta horizon: **months**. Per-run sessions: 20–40 min. What persists:
- unlocks (new relics entering the roster — new *words* in the doctrine vocabulary)
- relic roster expansion
- cosmetics (emergent, Vessel-shaped — never class skins)

### Reward logic
Run-end rewards depend on:
- depth reached,
- doctrine alignment strength (see [systems/doctrine-tracking.md](systems/doctrine-tracking.md)),
- boss interpretation outcome (see [content/bosses.md](content/bosses.md)).

A per-run stat already surfaces today: **enemies killed**, on the post-run screen.

### Endings as progression milestones
Endings are layered (narrative detail in [lore.md](lore.md)):
- **Run endings** — escape, wipe, sacrifice.
- **Zone endings** — local truths.
- **Cycle endings** — meta-progression milestones.
- **Faction endings** — interpretive conclusions (see [factions.md](factions.md)).

> Every ending is valid but incomplete.

## Player Experience

Between runs, the player feels their **roster of possibility** widening, not their character getting numerically bigger. A new relic unlock is exciting because it's a new *argument* the party can make on the board, opening synergies that didn't exist before — not because it's +10% to a stat. Over months, players should accumulate a sense of *which doctrines they keep enacting*, and the meta layer should reflect that identity back (faction endings, cosmetics that show what the party has become).

## Design alignment

Progression rewards **build space, not power** — directly serving *emergent systems over hardcoded content* (each unlock multiplies synergy combinations) and *avoiding generic RPG conventions* (no XP-as-the-point, no number-go-up loot). Rewards keyed to *doctrine alignment strength* and *boss interpretation outcome* keep the meta loop inside **Theology = Player Behavior**: you are rewarded for *coherently being something*, not merely for clearing content. "Every ending is valid but incomplete" rejects the single triumphant finale.

## Implementation Considerations

- **Trust boundary:** meta-progression is the *only* DB-persisted data (Supabase), and only **post-run** (I7). Mid-run state is ephemeral and server-memory only. Auth + unlocks live in Supabase; rooms never do. See [technical/architecture.md](technical/architecture.md).
- **Current state:** the run loop, outcomes (`RunOutcome`: extracted/wiped), and the post-run screen (final floor + enemies-killed) exist; the **persistent unlock/meta layer is largely future work** — most "concepts" above are designed, not yet wired. **TODO(decide+build):** the persistence model + Supabase schema are undefined. See [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md) §B. Agents should treat the meta layer as not-yet-implemented unless `DECISION_LOG.md` says otherwise.
- Reward determinism: any procedural reward (e.g. relic offers) must be seeded (see [technical/determinism-and-rng.md](technical/determinism-and-rng.md)) so outcomes are reproducible from a run ID.

## Future Expansion

- **Relic roster unlock system** (the core meta loop): how new relics enter the pool, gated by milestones/doctrine identity rather than grind.
- **Faction & zone endings** as concrete interpretive end states tied to accumulated cross-run doctrine.
- **Emergent Vessel cosmetics** driven by run history/mutations (see [content/mutations.md](content/mutations.md), [lore.md](lore.md)).
- **Daily/seeded challenges** leveraging determinism (same run ID → same dungeon) for shared leaderboards — a natural fit for the seeded-RNG architecture.
