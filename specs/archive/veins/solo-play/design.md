# Solo Play — Design

Satisfies: R1, R2, R3, R4, P1, P2

---

## Solo detection: single-owner board

`evaluateSynergies` is the only place the ownership rule lives. Rather than thread a
"solo" flag through all six call sites (placement, linkedFates, roomCombat, weapon, sync,
index), we derive solo-ness from the board itself:

```
owners = distinct set of slot.ownerId across all board slots
soloBoard = owners.size <= 1
```

This is exact for real games: `buildInitialBoard(players)` assigns *every* one of the 19
cells an owner via `assignHomeQuadrants`, so the number of distinct owners on the board
equals the party size. A solo run → 1 owner; a 2–4 player run → 2–4 owners. The check is
O(slots) (≤19) and pure (P1).

The owner-isolation guard becomes:

```typescript
// src/server/src/board/synergy.ts
const soloBoard = owners.size <= 1;
...
if (!soloBoard && neighborSlot.ownerId === slot.ownerId) continue;  // R2 / R3
```

When `soloBoard` is true the owner check is skipped, so adjacent same-tag relics synergize
(R2). When false the original co-op rule holds (R3). The tag-overlap requirement is
untouched in both cases.

### Edge case: player leaves mid-run
The board's slot ownership is fixed at `startRun` and is not rebuilt when a player leaves.
A 2-player run that drops to 1 connected player still has a 2-owner board, so it keeps
co-op synergy rules. This is intended — solo *runs* (started solo) get the relaxed rule;
a co-op run that loses a player does not silently change its build mechanics.

---

## Minimum players

`MIN_PLAYERS_TO_START` in `src/shared/src/lobby.ts` drops from `2` to `1`. This is the
single source the server gate (`RoomManager.startRun`) and the client lobby
(`WaitingRoom`) both read, so lowering it enables solo end-to-end with no special-casing.

The server's `DEV_MIN_PLAYERS` env override is retained: it can now be set *higher*
(e.g. `2`) to force co-op-only behaviour for testing, rather than its previous role of
lowering the floor for dev.

`NOT_ENOUGH_PLAYERS` remains a valid error code (a room with 0 players is auto-deleted, so
in practice the guard never trips), kept for API stability.

---

## Client

`WaitingRoom` already keys its Start Run enable/hint off `MIN_PLAYERS_TO_START`, so the
constant change alone makes a lone host able to start. Add a small solo affordance: when
the host is the only player, show a hint that they can start solo or share the code.

No new socket events. No change to the trust boundary.
