# Distributed Perception

> **Status:** Drafted. The forced-cooperation engine (Pillar 4, TD-008).
> **Spine:** Observe → Hypothesize → Test → Record  ·  **Index:** [../README.md](../README.md)
> **See also:** [sign-language.md](sign-language.md) · [loadout-economy.md](loadout-economy.md) · [cooperation-and-scaling.md](cooperation-and-scaling.md)

## Purpose

Why the party must talk. Perception is split by **channel**, so no single Seeker ever
sees the whole sign table, and the theory can only be assembled out loud. This is the
heir to the prototype's forced-communication design, re-aimed at diagnosis.

## Design Philosophy

### Perception is distributed by the loadout

The six sign channels (Residue, Stress-mark, Reaction, Spoor, Liturgy, Omen) are read
through **perception gear** carried in the bag. Which channels a Seeker can read is
decided by what they brought ([loadout-economy.md](loadout-economy.md)), so **distributing
perception across the party and distributing the bag are the same decision** (TD-007).
A party that loads all its perception into one Seeker reads fast but is blind if that
Seeker goes down; a party that spreads it is resilient but stretched. That tradeoff is
the cooperation engine, and it is structural, not bolted on (vision.md non-negotiable 5).

### The read is a conversation

Because each member holds a different slice of the channels, the working theory exists
only in the space between players: "I have Residue, it is heat. Who has Stress-mark?"
The diagnosis is literally assembled by talking, which is the social heart of co-op.

### Solo relaxes, never lacks

A lone Seeker perceives **all** channels (so solo is complete, TD-008), but is stretched:
they cannot watch every channel at once, probing is serial rather than parallel, and they
carry the whole perception load in one bag against the same combat needs. Solo is the same
game at a different tempo, never a lesser one.

## Non-negotiable Rules

1. The party feels **complete at 1, 2, 3, and 4 players** (TD-008). Channels and overlap scale; the game does not change shape per size.
2. Cooperation is **structural** (perception is distributed), never "more enemies for more players" (vision.md non-negotiable 5).
3. Signs are still **server-derived and per-player filtered**: a client receives only the signs for channels that player perceives. The trait roll never crosses the wire (I5).
4. Solo is **never lacking**; it perceives all channels and is balanced by tempo and bag pressure, not by withholding information.

## Implementation Notes

- **Per-player perception set:** the server tracks, for each Seeker, which channels their loadout lets them read. `signsFor(player)` filters `deriveSigns(incarnate)` down to that set before broadcast.
- **Channel assignment** is a consequence of loadout, not a separate roll, so it stays a preparation decision.
- **Scaling:** solo = all channels to one player (tempo/bag constrained); 2-4 = channels divided with tuned overlap so every size can assemble a full read. The exact division and overlap are open tuning, deferred to a spec.
- This is new code; the prototype's per-socket broadcast plumbing is reused as the delivery mechanism, not the logic.

## Future Expansion

- **Perception specializations** (a Seeker who reads one channel deeper or faster), kept within the fair-edge bounds of the Choir rule (TD-015).
- An in-world **evidence hand-off** (sharing a confirmed reading) as a deliberate action.
- Cross-channel **inference** rewards for parties that connect two partial signs.
