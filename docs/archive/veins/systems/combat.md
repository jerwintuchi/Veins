# System — Combat

> **Status:** Canon
> **Sources:** SYSTEM DESIGN DOC.md §4; DECISION_LOG.md (Enemy System + Combat, Weapon/Attack, Collision + Pathfinding, Body Collision, Dungeon Ruleset entries)
> **See also:** [content/enemies.md](../content/enemies.md) · [systems/relics.md](relics.md) · [ui-style-guide.md](../ui-style-guide.md) · [technical/netcode.md](../technical/netcode.md)

## Purpose

Combat is the **pressure medium** in which doctrine is tested and the Bleed Clock bites. It must be *readable* (legible at a glance, even on mobile, even with four players) yet *modified by the deeper systems* (relics, doctrine, bleed stage). This file specifies the server-authoritative combat tick, movement/collision/pathfinding, and the delta events that drive rendering.

## Concepts

### Format (design intent)
Top-down action combat: light/heavy or ability attacks; dodge/dash. Combat is **readable, but modified by doctrine systems**. Enemies are simple individually but complex in groups.

### The implemented combat loop
A server-side `runCombatTick` runs at `COMBAT_TICK_MS = 100ms` while in the combat phase. Per tick, in order:
1. **player move** — `move-player` stores intended direction; movement applied once per tick (rate-limit exploit closed).
2. **auto-fire** — `tryAutoFire` per-player on `WEAPON_COOLDOWN_MS`; the server auto-fires, clients cannot trigger shots (server authority). Aim from auto-aim or override (see [ui-style-guide.md](../ui-style-guide.md)).
3. **step projectiles** — `stepProjectiles` advances positions, resolves collision, clamps HP, applies relic effects (ember-core splash, torch-brand fire, arc-bolt chain).
4. **stepCombat** — enemy AI (`tickEnemies`), attack resolution (`applyEnemyAttacks`), downed state, fire DoT, iron-skin reduction, body separation (`separateBodies`), wipe check, and combat→loot transition when the last enemy dies (`allEnemiesDead`).
5. **ENEMY_MOVED** — emitted for all alive enemies.
6. **auto-aim refresh** — re-targets nearest enemy; emits `PLAYER_AIM_CHANGED` only on change.

### Player state
`PlayerState` (per-player HP map): `hp`, `maxHp`, `downed`, position. `PLAYER_MAX_HP` baseline. Players spawn at the entry room's center on `startRun`.

### Movement, collision, pathfinding
- **Player:** wall-slide via `clampToWalkable`; a source-in-wall escape hatch prevents trapping.
- **Projectiles:** terminate on wall entry.
- **Enemies:** A* (`findNextWaypoint`) on a 10-unit tile grid, Manhattan heuristic, `MAX_ITERATIONS = 5000`, with a line-of-sight shortcut deferring to direct-chase when the straight line is clear.
- **Walkable** = rooms ∪ corridor L-shapes; `CORRIDOR_HALF_WIDTH = 20`.

### Delta events
`ENEMY_SPAWNED/DAMAGED/DIED/MOVED` · `PLAYER_DAMAGED/DOWNED/REVIVED/MOVED` · `PLAYER_AIM_CHANGED` · `PROJECTILE_FIRED/REMOVED` · `PHASE_CHANGED`.

## Player Experience

Combat should feel **clear on the surface, deep underneath**. A new player reads the screen instantly — those are enemies, that's me, my shots auto-aim — and survives. A coordinating party feels the second layer: their relics turning plain shots into chains and splashes, the floor getting meaner as the Bleed Clock climbs, the need to override auto-aim to interrupt a priority threat. The fantasy is *fighting as one body* — positioning that keeps the organism's synergies intact while the dungeon tries to pull it apart.

## Design alignment

Combat keeps *readability* (a hard constraint from browser/mobile co-op) while making the deeper systems *felt* not *shown* — relic and doctrine effects modify combat without UI meters (*avoid generic conventions*). Server-authoritative auto-fire embodies *no client game logic* and supports a low skill floor (*co-op accessibility*). Bleed-stage aggression makes difficulty *emergent* (clock × combat), not a scripted spike.

## Implementation Considerations

- **Pure core, thin tick driver.** `stepCombat` returns a `CombatStepResult` discriminated union; `runCombatTick` is thin plumbing that fans out deltas. `tickEnemies` is pure — it clones enemies and must **not** mutate the input `players` map (`separateBodies` is therefore called from `stepCombat`, after the live maps are assigned, not inside `tickEnemies`).
- **Server authority (I1/I2):** no client fire event; clients send only movement intent; the server validates and applies once per tick. Float-drift bug class is closed by comparing pre-clamp cooldown `<= 0`, not post-clamp `=== 0`.
- **Determinism (I3):** spawns seeded `runId#floor#spawn` (independent of layout seed); combat RNG is a per-run `Rng`. No `Math.random`. Enemy IDs are deterministic strings `${runId}-${floor}-${room.id}-${i}`, keeping `spawnEnemies` pure.
- **Delta-only (I6):** never re-push full state per tick; `ENEMY_MOVED` currently emits for all alive enemies (a known un-optimized spot — diffable later).
- **Tick ordering matters:** projectiles step *before* `stepCombat` so an enemy reaching `hp<=0` dies in the same tick (`ENEMY_DIED` fires correctly).

## Future Expansion

- **The boss encounter** (designed, not implemented) — adaptive to dominant doctrine (see [content/bosses.md](../content/bosses.md)).
- **Richer enemy archetypes** (the draft "pathologies": splitters, parasites, choir — see [content/enemies.md](../content/enemies.md)).
- **Dodge/dash + heavy attacks** from the paper format; multiple weapon types.
- **`ENEMY_MOVED` delta-only optimization** (emit on meaningful change rather than every alive enemy).
- **Doctrine-reactive combat** (Tumor mutating enemies mid-fight, Chorus synchronized hazards).
