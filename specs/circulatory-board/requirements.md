# Requirements — Circulatory Board

The make-or-break mechanic. The party shares one hexagonal relic board. Relics fire their strongest effect when adjacent to a compatible relic owned by a *different* player.

---

**R1**: As a player, I can see the shared hexagonal relic board with all teammates' relics and their current synergy state so I can plan placements.
- AC: All connected players receive an identical board snapshot on room join (`BOARD_STATE_SYNC`)
- AC: Each visible slot shows: owner player color, relic name, and whether synergy is currently active

**R2**: As a player, I can place a relic into an empty board slot during a loot phase so my build contributes to the party.
- AC: Placing into an empty slot emits `RELIC_PLACED` and updates all clients' board views
- AC: Placing into an occupied slot is rejected: no state mutation, error emitted to requesting socket only
- AC: Placement outside a loot phase is rejected: no state mutation, error emitted to requesting socket only

**R3**: As a player, when my relic is adjacent to a teammate's relic that shares at least one tag, both relics fire their synergy (bonus) effect.
- AC: `evaluateSynergies` returns `true` for both relics in the above scenario
- AC: Synergy does NOT fire if the adjacent relic has the same `ownerId` (same player)
- AC: Synergy does NOT fire if adjacent relics share no tags
- AC: Synergy is mutual — if A synergizes with B, B synergizes with A

**R4**: As a game system, all relic placement and synergy calculations must execute server-side and be broadcast as events so clients cannot spoof synergies.
- AC: `evaluateSynergies` is only called from `src/server/`; it must not exist in `src/client/`
- AC: `RELIC_PLACED` event includes the updated synergy map for all affected relics

**R5**: As a player, the board state persists across floor transitions within a single run so my strategic investments compound.
- AC: Triggering a floor transition does not reset any relic positions or synergy state
- AC: The board after a floor transition is identical to the board before, absent any Linked Fates events

**R6**: As a player, when I revive a downed teammate (Linked Fates), I choose one of my relics to sacrifice into their board slot so death reshapes the party build.
- AC: The sacrificed relic is removed from the reviver's slot and placed in the downed player's slot
- AC: A `RELIC_REMOVED` event is emitted with `reason: 'linked-fates'` before `RELIC_PLACED` for the transfer
- AC: Synergies are re-evaluated after the transfer and broadcast in the `RELIC_PLACED` event
- AC: A player with no relics cannot revive (no relic to sacrifice)

**R7**: As a game system, synergy evaluation must be deterministic — given the same board state as input, the output is always identical so runs are reproducible and testable.
- AC: Calling `evaluateSynergies(board, registry)` twice with identical arguments returns identical results
- AC: `evaluateSynergies` is a pure function: no global state reads, no side effects, no `Math.random()`
- AC: The evaluation order of slots does not affect the output (order-independent)
