# Pressure and Extraction

> **Status:** Drafted. The no-doom-clock pressure model (TD-004) and the commitment economy.
> **Spine:** Observe → Hypothesize → Test → Record  ·  **Index:** [../README.md](../README.md)
> **See also:** [investigation-and-probing.md](investigation-and-probing.md) · [archive-and-testaments.md](archive-and-testaments.md) · [contracts.md](contracts.md)

## Purpose

What creates tension in the field without punishing careful thought, and how an expedition
ends, whether in triumph, retreat, or failure.

## Design Philosophy

### Pressure is a consequence, not a clock

There is **no doom clock** (TD-004, vision.md non-negotiable 3). Field pressure rises from
what the party *does*, not from time passing:

- noise and aggression,
- probing (every probe costs **exposure**, [investigation-and-probing.md](investigation-and-probing.md)),
- the sacred **decay** of the site and the **weather** ([contracts.md](contracts.md) Condition),
- lingering while loud.

As pressure climbs, the world answers: the Incarnate's awareness grows, reinforcements
manifest, an escape route closes. Move carefully and quietly and you may take your time; be
loud, greedy, or sloppy and it escalates. **Deliberation is the rewarded skill.** A party that
sits still and thinks is safe; a party that pokes everything pays for it.

### Commitment has teeth, but no lock

Acceptance stakes the **Surety** (TD-004, TD-017). Abandoning a contract (**Recant**) forfeits
the stake and some standing, but there is no death-lock: retreat is always allowed. This is
where preparation gets its teeth, without trapping the player.

### Failure still teaches

A wipe or a Recant still writes a **Field Testament** ([archive-and-testaments.md](archive-and-testaments.md));
partial knowledge enters the session Archive (Pillar 5). No expedition is ever wasted.

## Non-negotiable Rules

1. **No doom clock** (TD-004): pressure is event-driven and diegetic, never a metronome that drains while you think.
2. **Careful play buys time**; only the party's own noise, aggression, probing, and decay escalate it.
3. **Recant is always allowed** (no death-lock); it costs the Surety and standing, not the run by force.
4. **Revive costs time and exposure** (TD-018), raising pressure, never a sacrificed relic.
5. **Failure writes a Testament** (Pillar 5).

## Implementation Notes

- **Data shape:** a per-room `pressure` value advanced by *events* (a probe, an attack, a noisy action, a decay tick), not a fixed time drain. It is explicitly **not** a global doom clock that ticks down while you think.
- **Thresholds** trigger escalations (raise Incarnate awareness, spawn reinforcements, close a route). The escalation ladder is open tuning.
- **Extraction** is a leave action from the Extraction node ([spatial vocabulary, TD-018]). **Recant** forfeits the Surety. Expedition end (success, Recant, or wipe) appends a Field Testament.
- Reuses the room/tick lifecycle; the pressure model is new.

## Future Expansion

- The **escalation ladder** (what each pressure threshold does).
- **Decay and weather** systems as content ([../content/conditions-and-weather.md](../content/conditions-and-weather.md)).
- Route-closing and reinforcement mechanics; exposure-cost tuning per probe.
