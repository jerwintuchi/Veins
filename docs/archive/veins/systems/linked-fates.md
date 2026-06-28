# System — Linked Fates (Revive)

> **Status:** Canon
> **Sources:** GLOSSARY.md (Linked Fates); DESIGN.md (Supporting Mechanics); DECISION_LOG.md (linked-fates-ui, board-logic entries)
> **See also:** [systems/circulatory-board.md](circulatory-board.md) · [systems/combat.md](combat.md) · [doctrines.md](../doctrines.md)

## Purpose

Linked Fates is the **revive mechanic that makes death reshape the build**. It exists so that saving a teammate is never free or rote — it costs *you* a relic, permanently altering the party organism mid-fight. This file specifies the cost, the legality rules, and the compile-time guarantee on event ordering.

## Concepts

Reviving a downed teammate **costs the reviver one relic** from their board slots, which transfers into the downed player's slot. Death reshapes the party build mid-fight.

> Every revive is a strategic trade-off.

### Rules
- A downed player has `downed: true` and `hp: 0` in their `PlayerState`.
- Revive is legal only during the **combat** phase (phase guard).
- The reviver's identity is forced to the **authenticated socket** (never trusted from the payload — I2).
- On success: the source relic is removed from the reviver's slot and placed into the downed player's slot; the revived player is restored with a *new* `PlayerState` (`{ ...ps, hp: maxHp, downed: false }`, immutability convention).

### Event ordering
`reviveWithLinkedFates` returns its two events as an ordered tuple type `[RELIC_REMOVED, RELIC_PLACED]` — making the required emit order impossible to violate at compile time, not just at test time.

## Player Experience

A teammate goes down mid-fight and a clock starts in everyone's head: the enemies are still coming, and reviving means *giving up part of your own build*. The intended feeling is **costly love** — you save them, but the relic you sacrifice might have been the one completing a synergy, so the rescue visibly weakens the organism even as it keeps it whole. Late in a hard floor, the party negotiates *who* can afford to revive — a small, sharp co-op drama every time.

## Design alignment

Linked Fates is **Lore = Mechanics** in miniature: "you are one body, surviving by sacrificing parts of yourselves" is *literally* the rule. It deepens *co-op as structure* (you cannot self-revive cheaply; rescue is interdependent) and feeds *Theology = Behavior* (frequent sacrificing pushes the party toward the Penitent doctrine — see [doctrine-tracking.md](doctrine-tracking.md)). It rejects the *generic-RPG* free-revive: death has a build cost, not just a timer.

## Implementation Considerations

- **Pure board op:** `reviveWithLinkedFates` is one of the pure board functions (see [circulatory-board.md](circulatory-board.md)); the socket handler is thin plumbing. The ordered-tuple return type is the enforcement mechanism for the emit order — do not "flatten" it.
- **Failure handling:** if `playerStates.get(revivedId)` is undefined (inconsistent state), the handler must not leave a half-applied mutation — it emits `LINKED_FATES_ERROR` to the requesting socket and restores nothing silently. (This was a fixed review blocker; keep the guard.)
- **Doctrine hook:** the `RELIC_REMOVED` from a revive is a Penitent-scoring signal (sacrifice). Scoring keys off the existing event — no new event needed (see [doctrine-tracking.md](doctrine-tracking.md)).
- **Client flow (render-only):** revive panel appears for teammates on `PLAYER_DOWNED`; two-step selection (source relic → downed player's empty slot); `data-revive-source` / `data-revive-target` highlight; errors surface inline. The client never decides legality — the server does.

## Future Expansion

- **Penitent relics that alter the cost** (e.g. *Spleen* + *Bone Marrow* from the draft roster: sacrifice consumes only half effect). See [content/relic-roster.md](../content/relic-roster.md).
- **Free-revive threshold effect** when the party is deep into Penitent doctrine (already sketched in [doctrine-tracking.md](doctrine-tracking.md)).
- **Sacrificial extraction** (leaving a downed player behind to save the rest) as a distinct, weighty outcome — see [extraction.md](extraction.md).
- Cross-floor downed carry-over UX: today a downed player can enter the next floor still downed; make that risk legible without removing it.
