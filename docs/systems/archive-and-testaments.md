# Archive and Testaments

> **Status:** Drafted. The session-scoped knowledge layer (TD-006) and the namesake record (Pillar 5).
> **Spine:** Observe → Hypothesize → Test → Record  ·  **Index:** [../README.md](../README.md)
> **See also:** [sign-language.md](sign-language.md) · [pressure-and-extraction.md](pressure-and-extraction.md) · [../lore/collegium.md](../lore/collegium.md)

## Purpose

What the party keeps from an expedition. The Archive is the "Record" verb of the spine: the
place a hunt's verdict is written and the next hunt's theory begins.

## Design Philosophy

### The Archive is the party's session notebook

The **Archive** is the party's shared, **session-scoped** body of confirmed knowledge for the
current run of expeditions (TD-006). Every expedition appends a **Field Testament**: the
verdict it produced (the Origin and traits the party confirmed, the signs that proved out,
what method worked), win or lose.

### Knowledge that helps within a session, not a wiki

Within a session, the Archive lets the party move faster on a *re-encounter*: a trait already
confirmed this session is pre-marked, so the party reads what is new rather than re-reading
what it has settled. **Mutations and re-rolls keep it fresh** ([incarnates.md](incarnates.md)),
so the Archive accelerates without trivializing. It is never a permanent answer key.

### The lasting progression is skill, not the Archive

The Archive **resets with a new session** (TD-006). What actually persists across sessions is
the player's own mastery of the sign language ([sign-language.md](sign-language.md)) and
**Collegium Rank**. The Archive is the within-session memory; the player is the long-term one.

### Failure still writes one

A failed or recanted expedition still produces a Field Testament; partial knowledge enters the
Archive (Pillar 5). This is the namesake of the game, and the reason no run is wasted.

## Non-negotiable Rules

1. The Archive is **session-scoped and ephemeral** (TD-006); it is never persisted as an account unlock.
2. It stores **confirmed signs and traits for this session only**, never a permanent wiki or a "research %".
3. **Failure writes a Testament** (Pillar 5); partial knowledge is recorded.
4. The Archive **accelerates re-reads, it does not skip the diagnosis**; mutations and re-rolls keep each encounter live.

## Implementation Notes

- **Data shape:** a per-room (party) Archive of `FieldTestament` records; an expedition end appends one. Confirmed traits are marked so a later contract this session can pre-fill what was settled (subject to mutation).
- Wiped on session end (room teardown). Only a thin **career-stats** summary (counts of expeditions, ranks earned, never the knowledge itself) is persisted (TD-006).
- Server-held; reuses the room-state lifecycle. New code for the Testament records.

## Future Expansion

- Field Testaments written in **three Choir voices** (Judgment / Sanctity / Meaning) over the same facts, as flavor.
- Tuning of the within-session re-encounter speedup.
- The persisted **career-stats** schema (counts and standing, never knowledge).
