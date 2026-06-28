# System — Bleed Clock

> **Status:** Canon
> **Sources:** GLOSSARY.md (Bleed Clock); DESIGN.md (Supporting Mechanics); SYSTEM DESIGN DOC.md §2.2; DECISION_LOG.md (2026-06-22 stage escalation)
> **See also:** [systems/extraction.md](extraction.md) · [cosmology.md](../cosmology.md) · [content/biomes.md](../content/biomes.md)

## Purpose

The Bleed Clock is the **global pressure system** that turns every floor into a group negotiation. It exists to manufacture shared, vocal tension ("extract or push one more floor?") and to give depth a cost. This file specifies its drain math, stage escalation, and the determinism guarantees that make a run reproducible.

## Concepts

The dungeon's **global HP bar** — drains in real time; the drain rate multiplies with floor depth; hitting zero ends the run. In fiction it is the **interpretive instability of reality** (see [cosmology.md](../cosmology.md)).

### Behavior
- Starts full (`DUNGEON_START_HP = 1000`, placeholder tuning).
- Drains over time; deeper floors drain faster (depth multiplies the base rate).
- Implemented as a pure tick `tickBleedClock(clock, dt)`; clamped `>= 0`; broadcast as the `BLEED_CLOCK_TICK` delta (never a full state push — I6).
- On descent, drain rate rises but **current value is preserved** — tension carries over.
- Depletion ends the run (wipe); an already-ended room is never re-ended ("terminal once").

### Stage escalation
`bleedStageOf(current, max)` returns a stage by percent bled:

| Stage | % bled | Effect |
|------:|--------|--------|
| 0 | 0–30% | normal |
| 1 | 30–60% | enemies attack 30% faster (`AGGRESSION_COOLDOWN_MULT = 0.7`) |
| 2 | 60–80% | drain bonus ×1.5 |
| 3 | 80–100% | drain bonus ×2.0 |

- Stage computed before/after each tick in `runBleedTick` (no Room schema field).
- Aggression applies as a cooldown multiplier on enemy attack reset; drain bonus is separate from floor scaling (stages activate *within* a floor as the clock depletes; depth multiplies the base rate).
- `BLEED_CLOCK_TICK` carries the current `stage`; `BLEED_STAGE_CHANGED` fires on escalation (client plays a `bleedWarning` sound).

> Original paper design (SYSTEM §2.2) framed stages as 30–60% aggression, 60–80% room modifiers, 80–100% forced-extraction pressure. The table above is the realized version; "room modifiers" remain a future option.

## Player Experience

The Bleed Clock is the game's **heartbeat and its dread**. Early in a floor it's background; as it crosses 30%, enemies get visibly nastier and the music tightens; past 60% the bar itself starts falling faster, and the party feels the floor *tilting toward collapse*. The intended moment is the **argument**: half the party wants the deeper loot, half wants to extract while alive, and the clock keeps draining while they decide. There is no pause to deliberate safely — the pressure is the point.

## Design alignment

The Bleed Clock is **Lore = Mechanics** (reality's instability is a literal draining bar) and the engine of *delayed-consequence* tension at the macro scale (the cost of greed arrives floors later). It drives *co-op as structure*: the extract/descend call is a group decision no individual owns. Stage escalation is *emergent pressure* — difficulty rises from the clock interacting with combat and drain, not from hand-placed difficulty spikes.

## Implementation Considerations

- **Pure core, thin driver:** `tickBleedClock(clock, dt)` is pure; `runBleedTick(io, manager, dt)` is the thin Socket.io step driven by a `setInterval` in `startServer` (guarded out of tests). Emits exactly one `BLEED_CLOCK_TICK` per tick on a non-depleting room — asserted by a negative test (no spurious `RUN_ENDED`, no resync — I6).
- **Determinism:** drain is a pure function of `(current, dt, floor, stage)` — no `Math.random`, no wall-clock beyond the supplied `dt`. Same inputs → same output (P5), so a run is reproducible from its seed + tick schedule.
- **Tuning is placeholder** (`DUNGEON_START_HP`, base/per-floor drain): balance belongs to a future tuning pass, not the mechanic spec. **TODO(unknown):** current numbers are placeholder — do not treat them as intended design. See [OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md) §A. Keep the numbers in one place.
- **Cross-system coupling:** stage feeds enemy aggression in `tickEnemies` (via an optional `aggressionCooldownMult` param) and drain bonus in `effectiveDrain()` — kept decoupled (cooldown path vs drain path) on purpose.

## Future Expansion

- **Stage-2/3 "room modifiers"** (the deferred paper idea): environmental hazards activating at high bleed, deterministically.
- **Doctrine interaction**: Sanctum reduces drain, Penitent converts loss to power — threshold effects already sketched in [doctrine-tracking.md](doctrine-tracking.md).
- **Extraction events at 100%** beyond a plain wipe (forced/sacrificial extraction — see [extraction.md](extraction.md)).
- **Audio coupling**: formal BPM-by-stage mapping (see [art-bible.md](../art-bible.md)).
