# Requirements — Floor Progression

The live "descend" path. A party that chooses to push deeper advances to the next floor: a new dungeon is generated, the drain rate rises, and the shared board + Bleed Clock carry over. This wires the already-tested `advanceFloor` to a real server handler (closing the Bleed Clock review follow-up).

---

**R1**: As a party, we can descend to the next floor, incrementing the floor and raising the Bleed Clock drain rate so going deeper raises the stakes.
- AC: `descendFloor` increments `room.floor` by 1
- AC: after descending, `bleedClock.drainPerSecond === drainRateForFloor(newFloor)` and is strictly greater than before

**R2**: As a game system, each floor's dungeon is generated deterministically from `(runId, floor)` so the same run replays identically and daily challenges/bug-repro hold per floor (invariant I3).
- AC: the new floor's dungeon equals `generateDungeon(runId, config, newFloor)`
- AC: same `(runId, floor)` yields a deeply-equal dungeon; different floors of the same run yield different dungeons
- AC: the layout's `runId` field still equals the run's `runId` (floor is folded into the seed, not the id)

**R3**: As a party, descending preserves the Circulatory Board and the Bleed Clock's current value so strategic investment and tension compound across floors.
- AC: `room.board` is unchanged (deeply equal) across a descend
- AC: `room.bleedClock.current` is unchanged across a descend

**R4**: As a game system, descending is server-authoritative and validated: only an in-progress run can descend, rejected otherwise, with no state change on rejection (invariants I1, I2).
- AC: `descendFloor` / `descendRoom` on a non-in-progress room returns failure and mutates nothing
- AC: the `descend` socket handler rejects a requester not in an active room, emitting a targeted error only

**R5**: As a player, the new floor and its dungeon are broadcast as a `FLOOR_ADVANCED` delta event so the whole party transitions together (invariant I6).
- AC: a successful descend broadcasts `FLOOR_ADVANCED` carrying the new floor and the new dungeon layout to the room
- AC: no full game-state resync is sent (delta only)

**R6**: As a game system, the new floor begins in the `combat` phase so relic placement is gated until the floor is cleared.
- AC: after descending, `room.phase === 'combat'`
