# Technical — Determinism & Seeded RNG

> **Status:** Canon (summary — authoritative source is the code + DECISION_LOG.md)
> **Sources:** DECISION_LOG.md (seeded RNG, dungeon gen, per-floor seeding, spawn/loot seed namespaces)
> **See also:** [technical/netcode.md](netcode.md) (I3) · [systems/circulatory-board.md](../systems/circulatory-board.md) · [systems/extraction.md](../systems/extraction.md)

## Purpose

This file specifies **how Veins makes "the same run is the same run" true**. Determinism is not a nicety here — it is what lets the world credibly *interpret* the party (a reproducible function of recorded behavior), enables daily challenges, and makes any bug reproducible from a single run ID. This document defines the RNG, the seed namespaces, and the rules that keep generation pure.

## Concepts

### Why it matters
Invariant **I3**: the run seed (`runId`) never leaves the server; all procedural generation is server-side and deterministic. Same `runId` → identical dungeon, identical loot sequence, always. This enables daily challenges and **bug reproduction from a run ID alone**.

### The RNG
`mulberry32` PRNG seeded by an `xfnv1a` hash of the `runId`, in `src/server/src/rng/seeded.ts`. Tiny, fast, dependency-free. `hashSeed` maps a UUID `runId` to a uint32 seed. The single randomness source for all server procedural systems. `Math.random()` is never used for game state.

### Seed namespaces (independent, never collide)
Each system folds a distinct suffix into the seed so systems are independently reproducible:

| System | Seed |
|--------|------|
| Dungeon layout | `runId#floor` |
| Enemy spawns | `runId#floor#spawn` |
| Loot pool | `runId#floor#loot` |
| Combat RNG | per-run `combatRng` |

The dungeon's `runId` field stays the bare run id; folding `floor` into the seed (not the id) preserves per-floor reproducibility while keeping run identity in the payload. Floor 1 is unchanged for callers omitting the floor param (default 1).

### Dungeon generation
**BSP tree**, server-side only. <5ms, fully deterministic. The client never receives the seed — only resulting rooms/corridors as events. BSP emits exactly `(roomCount − 1)` corridors = a spanning tree, so connectivity holds by construction. Non-overlap, in-bounds, and connectivity are fuzzed across many seeds.

**Outside the mandate:** room codes use `node:crypto` (they need unpredictability, not reproducibility).

## Player Experience (indirect)

Determinism is what makes "**the game felt like it was watching us**" honest rather than smoke-and-mirrors: the world's reaction is a real function of what the party did, replayable to the frame. It also unlocks shared experiences — two parties can run the *same* seeded dungeon and compare — and lets a player report a bug as a run ID, knowing it reproduces exactly.

## Design alignment

Determinism is the technical substrate of *interpretive world design* and *delayed consequence*: an interpretation that can't be reproduced isn't interpretation, it's noise. Seeded generation is also the core of *emergence over hardcoded content* — infinite distinct-but-reproducible dungeons from rules + a seed, zero hand-authored maps. The strict "no `Math.random` in game state" rule is what holds the whole claim together.

## Implementation Considerations

- **Every procedural path must draw from the seeded RNG**, never `Math.random`/`Date.now`. This includes future systems: doctrine threshold timing, boss adaptation, mutation rolls — all must be pure functions of (seed + recorded state).
- **Namespace new systems** with their own `#suffix` so they're independently reproducible and never entangle with existing draws (follow `#spawn` / `#loot`).
- **Determinism is testable and tested:** generation is fuzzed across seeds for non-overlap/in-bounds/connectivity; synergy and bleed ticks are pure (same input → same output). New procedural code should add the same kind of property test.
- **Reproducibility is a debugging tool:** a run ID + the event stream fully reconstructs a session — preserve that (don't introduce hidden nondeterminism like map-iteration-order dependence).

## Future Expansion

- **Daily/seeded challenges** + leaderboards (a natural payoff of the architecture — see [progression.md](../progression.md)).
- **Deterministic replays / spectating** from a run ID + input log.
- **Seed-sharing** so parties can run identical dungeons.
- Keep determinism as systems grow (doctrine, boss, mutations) — the hardest discipline to maintain at scale, and the most valuable.
