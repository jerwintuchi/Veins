# Investigation and Probing

> **Status:** Drafted. Investigation as a verb (the Test in the spine).
> **Spine:** Observe → Hypothesize → Test → Record  ·  **Index:** [../README.md](../README.md)
> **See also:** [sign-language.md](sign-language.md) · [distributed-perception.md](distributed-perception.md) · [pressure-and-extraction.md](pressure-and-extraction.md)

## Purpose

How the party actively tests a theory instead of only watching. Probing turns reading
from a passive wait into a deliberate, costly action, which is the "Test" verb of the spine.

## Design Philosophy

### Two ways to read

- **Passive signs** are ambient: the Residue on the wall, the Spoor on the floor, the Omen
  before a strike. You read them by being present and perceptive ([sign-language.md](sign-language.md)).
- **Probes** are active: you apply a stimulus (present a relic, ring a bell, expose it to
  flame) and read the **reaction**. The Reaction channel (the Ward axis) is primarily
  probe-driven: you often cannot learn what an Incarnate shrugs off until you test it.

### Probing has a price, so it is a decision

A probe costs two things, which keeps it from being spammed and keeps preparation
meaningful (Pillar 1):

- **Bag space:** you can only probe with tools you chose to bring ([loadout-economy.md](loadout-economy.md)).
- **Exposure:** using a probe raises field **pressure** ([pressure-and-extraction.md](pressure-and-extraction.md), TD-004). Reading the Incarnate makes it more aware of you. Deliberation is safe; poking is not free.

### The theory is falsifiable

Each sign, passive or probed, updates the party's working theory, and the theory can be
wrong, because the asserted Origin and the intel are falsifiable (TD-015, TD-012). A probe
can confirm a hypothesis or shatter it ("we were sure it was frost-warded; it just drank
the flame"). That reversal is the game working as intended.

> **Tuning flag (TD-015):** a Belief-born can be *fed* by observation. Probing it, or
> over-probing one channel, may strengthen it. This must sharpen the risk of the read, not
> make probing a trap that kills the loop. Prototype it carefully.

## Non-negotiable Rules

1. A probe returns a **sign / reaction only, never a trait value** (I5). The player still draws the conclusion.
2. Probing **costs exposure** (TD-004), so it is never free or spammable. Preparation has teeth.
3. No probe yields a **label or percentage** (vision.md non-negotiable 2).
4. Probe results are **server-computed and per-player filtered** like all signs (only perceivers of the Reaction channel receive them).

## Implementation Notes

- **Probe** is a loadout item with a target channel/axis. A `PROBE` intent (client -> server) names the probe and a target; the server validates (player holds it, in range, legal phase), computes the reaction sign from the trait roll, broadcasts the sign to perceivers, and raises pressure.
- **Environmental probes:** the **Probe-features** in the spatial vocabulary (TD-018) are fixed reading points on the site (an altar to ring, a brazier to light); they probe without consuming a bag item but still cost exposure.
- **Caches** (TD-018) and **Sign-sources** feed passive reading and resupply of consumable probes.
- New code; the prototype's intent-validation pattern (validate shape, authorize, mutate, broadcast) is reused as the handler skeleton.

## Future Expansion

- The **probe catalog** as data ([../content/relics-and-rites.md](../content/relics-and-rites.md)).
- **Probe combinations** (a stimulus that means more when paired with another).
- **Counter-probes:** the Incarnate reacting to being studied (the Belief-born feedback, escalation).
