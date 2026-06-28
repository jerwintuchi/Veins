# Content — Biomes

> **Status:** Mixed (canon Atrium + draft additional biomes)
> **Sources:** SYSTEM DESIGN DOC.md §5 (Atrium); GPT_CHAT_HISTORY.txt (draft, additional biomes)
> **See also:** [art-bible.md](../art-bible.md) · [systems/bleed-clock.md](../systems/bleed-clock.md) · [content/enemies.md](enemies.md)

## Purpose

Biomes are the **anatomy the party descends through** — the spaces where every other system is staged. This file catalogues them and defines their room types. Its design rule: a biome is an *organ of a body*, not a themed tileset, and its layout must stay procedurally generated (deterministic), never hand-built.

## Concepts

### The Atrium (v1, the only biome)
**Theme:** a living cathedral-organism of flesh and bone.

**Visual rules** (see [art-bible.md](../art-bible.md)): pulsating walls · vein-like corridors · soft organic lighting · no hard geometry repetition.

**Room types:**
- **Combat Room** — enemies + environmental hazard.
- **Relic Room** — choose 1 of 3 relics.
- **Pressure Room** — high Bleed Clock gain, high reward.

Room aesthetics vary by dominant doctrine (Sanctum geometric, Tumor organic, Chorus mirrored, Penitent sparse) — see [factions.md](../factions.md).

## Player Experience

Moving through a biome should feel like moving through a **body that is failing** — corridors like veins, rooms like chambers, the space itself breathing. The room-type rhythm (fight → choose → risk) gives the descent a pulse: combat tension, then the quiet conversational beat of a relic room, then the gamble of a pressure room that trades Bleed for loot. Crucially the player can't memorize a biome — procedural layout means each descent is a fresh reading of the same organ.

## Design alignment

Biomes are *Lore = Mechanics* spatially: "the dungeon is an organism" is the level itself, and pressure rooms make the Bleed Clock's economy *a place you choose to enter*. Procedural-only layout is *emergence over hardcoded content* (no authored maps), and doctrine-skewed aesthetics serve *interpretive world design* (the space reflects the party). Anatomical framing rejects the *generic* dungeon crawl.

## Implementation Considerations

- **Generation is BSP, server-side, seeded** `runId#floor` — deterministic, <5ms, fully reproducible (see [technical/determinism-and-rng.md](../technical/determinism-and-rng.md)). The client receives rooms/corridors as events and renders them; it never sees the seed.
- **Current vs designed:** the implemented generator produces rooms + L-corridors with an elite last room; the **room *types*** (combat/relic/pressure as distinct, and doctrine-skewed aesthetics) are largely **design intent not yet wired** — today a floor is combat rooms + loot phase. Treat typed/aesthetic rooms as future. **TODO(build):** typed rooms + doctrine-skewed generation are unimplemented. See [OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md) §C.
- **Scale constraints are real:** dungeon is 1200×1200, `CORRIDOR_HALF_WIDTH = 20`, A* on a 10-unit grid — these are coupled to playability (player/enemy sizes) and shared between client render and server collision via `@veins/shared`. Don't change one side only.

## Future Expansion

> The draft biomes below are concepts only, beyond v1 scope. Each should ship as generation params + enemy set + aesthetic, deterministically — not as a bespoke level.

- Distinct **room types** (relic/pressure) and **doctrine-reactive aesthetics** in generation.
- The biome progression toward **The Hollow Heart** endgame (beat-synced, violent Bleed acceleration).
- Per-biome enemy sets and hazards (see [enemies.md](enemies.md)).

---

## Draft / Exploratory — Additional biomes

> Mined from `GPT_CHAT_HISTORY.txt`. Beyond v1 scope; concepts only.

- **Ossuary** — bone forests, pale and dead; skeletal antibody enemies.
- **Alveoli Fields** — floating sacs, air currents, spore enemies; dreamlike.
- **Neural Labyrinth** — blue, electric; teleporting enemies, distorted sound.
- **The Hollow Heart** — endgame; a massive chamber beat-synchronized with music; the Bleed Clock accelerates violently.

Floors read as **anatomy**, not stone rooms (heartroom → vein tunnel → abscess hall). See [art-bible.md](../art-bible.md).
