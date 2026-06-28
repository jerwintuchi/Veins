# Veins — Art Bible

> **Status:** Mixed (canon Atrium visual rules + draft aesthetic direction)
> **Sources:** SYSTEM DESIGN DOC.md §5 (Atrium visual rules); LORE_DESIGN.md §11 (Room-gen aesthetics); GPT_CHAT_HISTORY.txt (draft, the bulk of the aesthetic vision)
> **See also:** [ui-style-guide.md](ui-style-guide.md) · [content/biomes.md](content/biomes.md) · [vision.md](vision.md)

## Purpose

The art bible defines how Veins **looks, moves, and sounds** so that presentation reinforces — never contradicts — the spine. The art's job is to make the player *feel* they are inside one dying organism. This file governs visual, motion, and audio direction; UI specifics live in [ui-style-guide.md](ui-style-guide.md).

## Concepts — canon: the Atrium (v1 biome)

The Atrium is a **living cathedral-organism of flesh and bone**. Visual rules:

- pulsating walls
- vein-like corridors
- soft organic lighting
- no hard geometry repetition

Doctrine shapes room aesthetics (see [factions.md](factions.md)): Sanctum = geometric/symmetrical; Tumor = organic/asymmetric/evolving; Chorus = mirrored/synchronized; Penitent = sparse/oppressive.

> **Implementation note (current build):** rendering uses Phaser 3 primitive shapes (Graphics, Arc, Rectangle) — no sprite sheets yet. Real art is a drop-in swap for the primitive draw calls. See [technical/stack-and-deployment.md](technical/stack-and-deployment.md).

## Player Experience

The world should read as **alive and indifferent** — it breathes whether or not you're winning. The dread is ambient, not jump-scare: walls flex, particles drift like blood cells, the heartbeat in the score speeds as the Bleed Clock drains. The player should feel small inside a body that is failing, and beautiful sorrow rather than gore-horror revulsion. Readability must survive all of this: in a chaotic 4-player fight, enemies, projectiles, and the local player must stay legible at a glance, even on a phone.

## Design alignment

Art is **Lore = Mechanics** at the sensory layer: "the dungeon is an organism" must be *seen* (breathing walls) and the Bleed Clock's pressure must be *heard* (rising BPM). The "no hard geometry repetition" rule and doctrine-skewed aesthetics serve *interpretive world design* — the space itself reflects the party back. Avoiding pixel art and generic dungeon-stone is a deliberate rejection of *generic conventions*: the look should say "anatomy," not "fantasy crypt."

## Implementation Considerations

- Art is **decoupled from logic** by design: the server sends positions/events; the client renders. Swapping primitives → sprites changes only `GameScene` draw calls (see [systems/combat.md](systems/combat.md), [technical/architecture.md](technical/architecture.md)).
- **Readability budget** drives constraints: browser + mobile means small asset sizes, few overlapping bloom layers, high figure/ground contrast. Color is a *gameplay* tool (palette below encodes threat/healing/corruption), not only mood.
- Motion ("walls breathe") should be cheap shader/tween work, not per-frame geometry rebuilds, to hold frame rate on low-end devices.

## Future Expansion

- A **sprite/animation pass** replacing primitives, biome by biome, starting with the Atrium. **TODO(build):** sprite pass unstarted; current build is Phaser primitives. See [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md) §C.
- **Doctrine-reactive visual layer** (rooms subtly shift toward the dominant doctrine's aesthetic) — the visual counterpart to hidden doctrine tracking, still without a meter.
- **Adaptive audio system**: Bleed-stage-driven BPM/intensity already conceptually specified; formalize the stems and transition rules.

---

## Draft / Exploratory — Aesthetic & genre direction

> Mined from `GPT_CHAT_HISTORY.txt`. Captures the intended look/feel; not yet ratified into canon.

### Genre pillars
**Cosmic Biopunk + Bloodborne organism horror.** Not gore horror, not zombies. Veins, nerves, pulsating architecture, living dungeons, parasitic relics, strange anatomy.

### Inspirations
- **Visual:** Scorn, Darkest Dungeon, Bloodborne, Hyper Light Drifter, Signalis, Moonscars, Blasphemous.
- **Mechanical:** Risk of Rain 2, FTL, Deep Rock Galactic, Monster Hunter, Escape from Tarkov (extraction tension).

### Art style
Not pixel art (crowded; browser needs readability). Target: **2D top-down hand-painted biopunk** — Hyper Light Drifter shapes, Darkest Dungeon colors, Diablo atmosphere, Dead Cells readability. A stylized **PS1 / Signalis / Hyper Light Drifter hybrid** is also floated for browser-first delivery: low-poly sprites with bloom, optional CRT filter, blood-cell particles, soft shadows — tiny assets, distinctive identity.

### Color palette
- **Flesh:** reds, crimson, burgundy, rust.
- **Bone:** ivory, beige.
- **Organ:** blues, cyan, teal.
- **Corruption:** purple.

### Motion — everything feels alive
Walls breathe · roots pulse · doors contract open · particles drift like blood cells. Rooms aren't "stone rooms" — they're **anatomy** (heartroom → vein tunnel → abscess hall). See [content/biomes.md](content/biomes.md).

### Audio direction
**Dark ambient + organic synth.** Study: Disasterpeace, Atrium Carceri, Darkest Dungeon OST, Signalis OST. Not orchestral. Low drones, heartbeat percussion, breathing, pulses.
> When the Bleed Clock rises, music BPM rises too — players should feel stress physically.
