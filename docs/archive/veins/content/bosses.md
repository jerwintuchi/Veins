# Content — Bosses

> **Status:** Canon
> **Sources:** SYSTEM DESIGN DOC.md §6 (The Pulsing Interpreter); LORE_DESIGN.md §9 (Boss archetypes)
> **See also:** [factions.md](../factions.md) · [systems/doctrine-tracking.md](../systems/doctrine-tracking.md) · [cosmology.md](../cosmology.md)

## Purpose

Bosses are the **climactic delayed consequence** — the moment the world stops reacting subtly and *argues back* with the party's own doctrine. This file specifies what a boss is in Veins (an externalized contradiction, not a damage sponge), the v1 boss, and how a boss reads accumulated behavior. It is the payoff of the doctrine-tracking system.

## Concepts

### Bosses are not enemies
They are:
> Externalized ideological contradictions.

Each boss embodies a doctrine, tests opposing player behavior, and becomes easier if players align with or resist it coherently. (Concept: [doctrines.md](../doctrines.md).)

### Archetypes (by doctrine)
- **Sanctum Boss** — punishes chaos, rewards stability.
- **Tumor Boss** — punishes rigidity, rewards adaptation.
- **Chorus Boss** — punishes isolation, rewards synchronization.
- **Penitent Boss** — punishes hesitation, rewards sacrifice.

(Full identities: [factions.md](../factions.md).)

### V1 boss — "The Pulsing Interpreter"
A semi-organic construct that **enforces coherence in player doctrine**. It adapts to the party's dominant doctrine (read from hidden scores — see [systems/doctrine-tracking.md](../systems/doctrine-tracking.md)):
- **Sanctum dominant** → reduces randomness, predictable patterns, punishes overconfidence.
- **Tumor dominant** → evolves mid-fight, changes patterns frequently.
- **Chorus dominant** → mirrors player actions, punishes desync.
- **Penitent dominant** → punishes hesitation, punishes inactivity windows.

**Phases:** (1) neutral interpretation — baseline mechanics; (2) reacts to the doctrine pattern, introduces a counter-pattern; (3) full interpretation conflict, hybrid mechanics.

**Win condition:** the boss does not "die." It:
> collapses into unstable interpretation fragments.

These fragments become relic rewards (see [progression.md](../progression.md)).

## Player Experience

The intended gut-punch: the boss fights *you specifically*. A party that survived on rigid, predictable Sanctum play meets a boss that strips away randomness until their rigidity is a liability — and they realize the world has been **paying attention all along**. The fight is a mirror with teeth. Winning shouldn't feel like out-DPSing a healthbar; it should feel like *resolving a contradiction* — leaning harder into your doctrine, or coherently breaking from it. The reward being literal *fragments of the conflict* keeps the fiction intact (no chest drops loot — the argument shatters into relics).

## Design alignment

The boss is the **spine's exclamation point**: *Theology = Player Behavior* becomes a creature that reads behavior and answers it (peak *delayed consequence*). "Not enemies but contradictions" and "does not die but collapses into interpretation" reject *generic-RPG* boss conventions wholesale. Adaptation from accumulated doctrine (not scripted phases keyed to HP%) keeps it *emergent and interpretive*.

## Implementation Considerations

- **Status: designed, not implemented.** The current build has the enemy/elite combat loop but no boss encounter. Agents must not assume a boss exists in code. **TODO(build):** implement The Pulsing Interpreter — the headline v1 gap. See [OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md) §C.
- **Reads hidden doctrine, never shows it:** boss adaptation queries the dominant doctrine server-side; like all doctrine signals, the raw scores never reach the client (see [systems/doctrine-tracking.md](../systems/doctrine-tracking.md)).
- **Determinism:** boss behavior must be a pure function of (dominant doctrine + phase + seed), so "the boss reacted to how we played" is reproducible from a run ID (I3). No `Math.random` in the adaptation path.
- **Reward as fragments:** the win should hand back relics via the existing loot/relic pipeline, not a bespoke drop system — keep it data-driven (see [systems/relics.md](../systems/relics.md)).
- **Build on the pure tick:** implement boss behavior inside the existing `stepCombat`/`runCombatTick` model (pure core, thin socket), not a parallel system.

## Future Expansion

- **Implement The Pulsing Interpreter** as the v1 boss (the headline gap from [prototype-v1.md](../prototype-v1.md)).
- **Mid-boss vs final-boss** distinction (v1 loop calls for both).
- **Per-doctrine dedicated bosses** beyond the single adaptive construct, each a fuller embodiment (see [factions.md](../factions.md)).
- **The Heart** as an end-of-cycle interpretive encounter reading *cross-run* doctrine (see [cosmology.md](../cosmology.md)).
