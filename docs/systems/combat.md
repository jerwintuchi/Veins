# Combat

> **Status:** Drafted. Hybrid melee core plus tools (TD-011); understanding pays off here (TD-013).
> **Spine:** Observe → Hypothesize → Test → Record  ·  **Index:** [../README.md](../README.md)
> **See also:** [incarnates.md](incarnates.md) · [loadout-economy.md](loadout-economy.md) · [pressure-and-extraction.md](pressure-and-extraction.md)

## Purpose

The moment the party commits to its reading and pays for being wrong. Combat is real-time
and visceral, but it is downstream of the diagnosis: you win by understanding, not by aim alone.

## Design Philosophy

### A melee core, a tool layer

Combat is a **weighty melee core** (the gothic register of Blasphemous and Castlevania,
always available, no bag slot) layered with **ritual and ranged tools** (thrown relics, ward
beams, ritual casts) that are the party's counters and reuse the prototype's projectile tech
(TD-011).

### Understanding pays off three ways (TD-013)

Every trait axis you read turns into an edge in the fight:

- **Combat** (Aspect / Frailty): the matching counter *bites*, the wrong one *bounces*. A
  correct read makes the kill efficient; a wrong read makes it a grind.
- **Method** (Rite-key): the non-kill verbs (capture, banish) are *gated* by the correct
  identification. You cannot bind what you have not understood.
- **Survival** (Tell): the lethal attack is telegraphed by its **Omen** sign. Read the Omen
  and you get the window to dodge or ward; miss it and it can drop a Seeker.

So the fight is not a damage race. It is the test of the theory, and the primary verb is
often capture, banish, observe, or drive off rather than kill ([contracts.md](contracts.md)).

## Non-negotiable Rules

1. Combat is **downstream of the read**: the matchup is decided by understanding, not only by execution.
2. **Melee costs no bag slot** (TD-011); only tools, perception, and rites do.
3. **Non-kill verbs require the correct method** (TD-013); they are never a pure damage threshold.
4. The lethal **Tell is always readable** through its Omen (TD-013). Survival is earned by reading a re-rolled trait, never by memorizing a fixed boss pattern (vision.md non-negotiable 1).

## Implementation Notes

- **Reused from the prototype:** the 20Hz authoritative tick, movement and wall collision, projectiles, separation, pathfinding. The tool layer is the projectile system reflavored.
- **New:** the melee core (the prototype was ranged auto-fire), the Omen telegraph window, and the method-verb resolutions (capture rig, banishment ritual).
- Counters resolve server-side against the hidden trait (Aspect/Frailty), so the wire still carries only signs and outcomes, never the trait (I5).
- **Downed / revive** follows TD-018 (revive costs time and exposure; full-party down ends the expedition; solo has one self-recovery rite).

## Future Expansion

- Melee feel (light/heavy, stagger, parry) and the Omen-read window tuning.
- Per-verb encounter resolutions as their own systems (the capture rig, the banishment rite).
- Boss-scale Incarnates whose Tells and phases are *read*, never scripted.
