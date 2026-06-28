# Requirements — Bleed Clock

The dungeon's global HP bar, draining in real time, faster the deeper you go. Creates the "extract now or push one more floor?" group tension. Server-authoritative; broadcast as delta events. Hitting zero ends the run.

---

**R1**: As a party, the dungeon's Bleed Clock drains in real time at the current floor's drain rate so there is constant time pressure.
- AC: `tickBleedClock(clock, dt)` reduces `current` by `drainPerSecond * dt`
- AC: the server owns the clock; clients never compute it, they render broadcast values (invariant I1)

**R2**: As a party, deeper floors drain the clock faster so pushing onward raises the stakes.
- AC: the drain rate used after a floor transition equals `drainRateForFloor(newFloor)` and is strictly greater than the previous floor's rate

**R3**: As a party, when the Bleed Clock reaches zero the run ends in a wipe so greed has a real cost.
- AC: when `current` reaches 0 the room status becomes `ended` with outcome `wiped`
- AC: a `RUN_ENDED` event with outcome `wiped` is emitted

**R4**: As a player, the clock value is broadcast as a delta event so the whole party sees the same countdown.
- AC: each tick emits a `BLEED_CLOCK_TICK` delta carrying the current clock state
- AC: no full game-state resync is sent per tick (invariant I6)

**R5**: As a game system, the clock never goes negative so downstream UI and logic stay valid.
- AC: after any tick, `current` is clamped to `>= 0`

**R6**: As a party, descending a floor increases the drain rate but does NOT refill or reset the current clock value so tension compounds across floors.
- AC: after `advanceFloor`, `bleedClock.current` is unchanged from before the transition
- AC: after `advanceFloor`, `bleedClock.drainPerSecond` reflects the new (deeper) floor

**R7**: As a party, we can extract to end the run successfully and stop the clock so "bank the loot now" is a real choice.
- AC: extracting sets room status `ended` with outcome `extracted`
- AC: a `RUN_ENDED` event with outcome `extracted` is emitted
- AC: extraction is rejected if the run is not in progress

**R8**: As a game system, the tick is a pure, deterministic function of `(clock, dt)` so it is reproducible and testable.
- AC: `tickBleedClock` has no side effects and no `Date.now()` / `Math.random()`
- AC: identical `(clock, dt)` inputs yield identical outputs
