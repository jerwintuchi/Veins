# Cooperation and Scaling

> **Status:** Drafted. The 1-to-4 completeness guarantee (TD-008).
> **Spine:** Observe → Hypothesize → Test → Record  ·  **Index:** [../README.md](../README.md)
> **See also:** [distributed-perception.md](distributed-perception.md) · [loadout-economy.md](loadout-economy.md) · [combat.md](combat.md)

## Purpose

How Testament stays a complete game at one, two, three, and four players, and why
cooperation is structural rather than a damage multiplier.

## Design Philosophy

### Cooperation is structural

Co-op exists because **perception, the bag, and the blessing are all distributed**, not
because more players spawn more enemies (vision.md non-negotiable 5). A party of four splits
the sign channels ([distributed-perception.md](distributed-perception.md)), splits the bag
([loadout-economy.md](loadout-economy.md)), and each receives its own blessing wildcard, so
party size becomes *coordination* ("who reads Liturgy, who carries the binding rite, whose
blessing bit this hunt?"), not just more bodies.

### What scales with party size

- **Perception:** channels are divided with tuned overlap, so each size can assemble a full read.
- **Combat budget:** the Incarnate's aggression and durability scale to the party, but the
  *kind* of challenge does not change into a horde.
- **Objective bandwidth:** secondary objectives that want more hands appear more readily for larger parties.

### Solo is complete, at a different tempo

A lone Seeker perceives **all** channels, carries one bag against every need, probes serially,
and faces a scaled-down combat budget, with one self-recovery rite (TD-018). Solo is the same
game played tighter and slower, never a lesser one (TD-008).

## Non-negotiable Rules

1. The party is **complete at 1, 2, 3, and 4** (TD-008); the game does not become a different game per size.
2. **Solo is never lacking**; it perceives everything and is balanced by tempo and bag pressure, not by withholding.
3. Cooperation is **structural** (distributed perception, bag, blessing), never "more enemies for more players" (vision.md non-negotiable 5).
4. Difficulty scales by **knowledge depth (tier, TD-014) and party budget**, never by stat walls.

## Implementation Notes

- A **party-size parameter** feeds three systems: perception division, the Incarnate combat budget, and objective availability.
- **Solo special-cases:** all channels to the one player, the self-recovery rite, and a reduced combat budget.
- Reuses the prototype's room and party model (join/rejoin/disconnect retention); the scaling curves are new and are open tuning.

## Future Expansion

- Drop-in / drop-out and mid-expedition join.
- The exact scaling curves per system, and party-size-aware contract weighting on the board.
