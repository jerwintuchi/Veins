# System — Extraction & Failure

> **Status:** Canon
> **Sources:** SYSTEM DESIGN DOC.md §7 (Extract/Failure); DESIGN.md (extraction tension); DECISION_LOG.md (descend/extract handlers, floor progression)
> **See also:** [systems/bleed-clock.md](bleed-clock.md) · [progression.md](../progression.md) · [systems/circulatory-board.md](circulatory-board.md)

## Purpose

Extraction is the **decision system** that gives depth a cost and survival a price. It exists to make "how greedy are we?" a recurring group question with real stakes, and to define the ways a run can end. This file specifies the extract/descend flow, the outcome types, and how state carries (or doesn't) across the boundary.

## Concepts

### The run-loop tension
Every floor is a group negotiation: **extract now or push one more floor?** Loot scales with depth; the Bleed Clock drains faster the deeper you go. Extraction is the strategic counterweight to the clock.

### Extraction types
- **Normal extraction** — successful, voluntary, during a loot phase.
- **Forced extraction** — Bleed Clock maxed.
- **Sacrificial extraction** — one player left behind.
- **Total wipe** — failure.

### Fail condition
At Bleed Clock 100%: the dungeon collapses → forced wipe OR an emergency extraction event. See [bleed-clock.md](bleed-clock.md).

### Implemented flow
- **Loot phase only:** `descend` and `extract` are valid in the loot phase; a phase guard rejects `descend` during combat (`WRONG_PHASE`).
- **Descend** (`descendFloor`): reuses pure `advanceFloor` for carry-over (board by reference, Bleed Clock `current` preserved, drain rate up), generates the new floor's dungeon (seed `runId#floor`), spawns enemies, enters combat. Broadcasts `FLOOR_ADVANCED`. A floor that spawns zero enemies goes straight to loot.
- **Extract** (`extractRun`): ends the run with an `EXTRACTED` outcome.
- **Outcome** is `RunOutcome | null` on Room; the run ends via `RUN_ENDED` (carries final floor + `enemiesKilled`).
- Client `DescendPanel` disables buttons on click (anti double-tap); re-enables on `FLOOR_ADVANCED` / `RUN_ENDED` / `LOBBY_ERROR`.

## Player Experience

Standing in a cleared loot room, the party feels the **pull in two directions**: the next floor has better relics, but the clock is already low and someone's still downed. Extraction is the release valve and the gamble at once — leave now with what you have, or bet the run on one more floor. The most charged version is *sacrificial extraction*: getting most of the party out alive by leaving one behind, a decision that becomes the run's story. The boundary is deliberately a *choice*, never an automatic checkpoint.

## Design alignment

Extraction is the macro expression of *delayed consequence* (greed banked now is paid for floors later) and *co-op as structure* (the call belongs to the group, not an individual). Its multiple outcome types — especially sacrificial — embody "every ending is valid but incomplete" and feed *Theology = Behavior* (a party that repeatedly sacrifices to extract is enacting Penitent). It rejects the *generic* save-point: the threshold has weight.

## Implementation Considerations

- **Carry-over correctness:** descend reuses pure `advanceFloor` — board carried **by reference** (identity-tested), Bleed Clock `current` preserved, drain rate raised. Don't clone/rebuild the board across floors.
- **Phase discipline (I2):** `descend`/`extract` are loot-phase only; the guard prevents a client replacing the enemy map mid-combat. Buttons are client-disabled but the **server** enforces legality.
- **Determinism (I3):** the next floor's dungeon and spawns are seeded from `runId#floor` / `runId#floor#spawn` — same run ID → same descent, reproducibly.
- **Current state:** *normal extraction*, *descend*, and *wipe* are implemented; **forced extraction at 100% beyond a plain wipe** and **sacrificial extraction** are designed, not yet wired. **TODO(build):** forced (at 100%) and sacrificial extraction are unimplemented. See [OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md) §C. Treat them as future until `DECISION_LOG.md` says otherwise.

## Future Expansion

- **Forced-extraction event** at Bleed 100% (a scramble, not just a wipe).
- **Sacrificial extraction** as a real mechanic (leave a downed Vessel; the rest escape) — ties to [linked-fates.md](linked-fates.md).
- **Doctrine-modified extraction** (Sanctum safer extracts, Penitent rewards loss) via threshold effects (see [doctrine-tracking.md](doctrine-tracking.md)).
- **Reward scaling** formalized by depth × doctrine alignment × boss outcome (see [progression.md](../progression.md)).
