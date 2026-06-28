# Content — Enemies

> **Status:** Mixed (canon implemented roster + draft "pathologies")
> **Sources:** DECISION_LOG.md (Enemy System + Combat; Dungeon Ruleset); GPT_CHAT_HISTORY.txt (draft, enemy concepts)
> **See also:** [systems/combat.md](../systems/combat.md) · [content/bosses.md](bosses.md) · [content/biomes.md](biomes.md)

## Purpose

This file catalogues the **threats** — the bodies that apply pressure inside the combat system. Its design rule: enemies are *pathologies of the organism*, simple alone and complex in groups, and they exist to make the Bleed Clock and doctrine choices matter, not to be bespoke set-pieces. Rules live in [systems/combat.md](../systems/combat.md); this is the content.

## Concepts

### Implemented enemies (current build)
`ENEMY_TYPES` defines stats per type:
- **Shambler** — melee approacher.
- **Spitter** — ranged attacker.

Both use A* pathfinding with a line-of-sight direct-chase shortcut. Behavior and the combat tick: [systems/combat.md](../systems/combat.md).

### Spawn rules (Dungeon Ruleset)
- **Counts scale with floor:** `extra = min(floor((floor-1)/2), 2)` → floors 1–2 give [1,2], floors 3–4 give [2,3], floor 5+ give [3,4] per room.
- **Type distribution scales with floor:** `spitterProb = min(0.7, 0.15 + 0.1*(floor-1))` → 15% spitters floor 1, capped at 70% from floor 7+.
- **Elite last room:** the last room in BSP traversal order spawns an elite — 2× HP, 1.5× damage, +1 count, on top of floor multipliers. Deterministic (no extra RNG).
- **Entry room always clear:** no enemies in room 0.
- Spawn seed `runId#floor#spawn` is independent of the layout seed (see [technical/determinism-and-rng.md](../technical/determinism-and-rng.md)).

## Player Experience

Individually, enemies are *legible problems* — a melee thing closing in, a ranged thing to break line-of-sight with. The challenge is **emergent from the mix**: a spitter behind a shambler wall while the Bleed Clock's stage-1 aggression speeds them all up. The elite-last-room rule gives each floor a felt **crescendo** — players learn to expect the final room to bite hardest, shaping the extract/descend call. Enemies should read as *symptoms of a sick world*, not as a fantasy bestiary.

## Design alignment

Enemies serve *emergence over hardcoded content*: difficulty comes from floor-scaled counts, seeded type mix, and bleed-stage aggression interacting — not from authored encounters. They are the pressure that turns *Theology = Behavior* into stakes (your doctrine is tested *against something*). Framing them as pathologies keeps *Lore = Mechanics* (the dungeon is a body; its threats are diseases), not generic dungeon mobs.

## Implementation Considerations

- **Deterministic & pure:** `spawnEnemies` is pure with deterministic enemy IDs (`${runId}-${floor}-${room.id}-${i}`); the elite is the last BSP room (no extra RNG). Same seed → same spawns (I3).
- **Stats are data** in `ENEMY_TYPES`; the elite is a multiplier overlay, not a separate type — keep it that way so new enemies are data, not code.
- **Degenerate guard:** a floor that spawns zero enemies must transition straight to loot (no vacuous combat phase) — existing fix; preserve it.
- **Aggression coupling:** bleed stage feeds `tickEnemies` via `aggressionCooldownMult` — enemies don't know about the clock directly; the tick passes it in.

## Future Expansion

> The draft "pathologies" below are concepts only. Each should land as **data + a behavior** in the existing pure tick, never as a scripted encounter.

- Behaviors that interact with the board/synergy directly (e.g. parasites that shrink synergy radius) — making enemies part of the *theology*, not just damage.
- Group tactics (splitters, interrupt-required casters) that demand co-op focus-fire.
- Per-biome enemy sets (see [biomes.md](biomes.md)).

---

## Draft / Exploratory — Pathologies

> Mined from `GPT_CHAT_HISTORY.txt`. Enemies are **pathologies**, not monsters. Concepts only — not implemented.

- **Hematoma** — blob creatures that split when killed.
- **Clot Knights** — armored white-blood-cell guardians with charge attacks.
- **Parasites** — attach to players, reduce synergy radius, force teammates to save each other.
- **Carrion Choir** — floating angel-like masses whose singing increases Bleed Clock speed; must be interrupted.
