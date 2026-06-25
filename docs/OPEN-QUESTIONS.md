# Veins — Open Questions & TODO Register

> **Status:** Canon (living index)
> **Sources:** synthesized from the design bible's flagged gaps + DECISION_LOG.md + code state
> **See also:** [README.md](README.md) · [prototype-v1.md](prototype-v1.md) · [DECISION_LOG.md](DECISION_LOG.md)

## Purpose

This is the **self-sufficiency layer** of the knowledge base: a single place that tells a future session (human or Claude Code) *what is not yet known, not yet decided, and not yet built* — so nobody guesses or silently invents canon. Every other doc describes intent; this one describes the **edges of certainty**.

**How to use this file**
- Before implementing or documenting something flagged here, **resolve the question first** (check code, ask the human, or make + log a decision in `DECISION_LOG.md`).
- When an item is resolved: update the relevant doc, append a `DECISION_LOG.md` entry, and **delete the item here** (this register shrinks as the project matures).
- `TODO(verify)` = a fact a session can confirm from code/config now. `TODO(decide)` = needs a human/product call. `TODO(build)` = designed, just not implemented. `TODO(unknown)` = genuinely undetermined; do **not** fill in by guessing.

Items are grouped by disposition, not priority.

---

## A. Unknowns — verify before relying on (`TODO(verify)` / `TODO(unknown)`)

These are stated as uncertain *on purpose*. Do not document them as settled until checked.

- **Live deployment status.** Deploy *config* exists (Fly.io + Vercel, DECISION_LOG 2026-06-23). Whether an instance is currently live at a public URL is unknown from the repo. `TODO(unknown)`: confirm with the human; if live, record the URL in [technical/stack-and-deployment.md](technical/stack-and-deployment.md).
- **Workspace package names.** The root README references `@veins/server` / `@veins/client`; only `@veins/shared` is confirmed in use. `TODO(verify)`: read each `package.json` and correct any doc that names the others.
- **Exact balance/tuning values are placeholder.** `DUNGEON_START_HP=1000`, base drain, per-floor drain, `PLAYER_MAX_HP`, weapon cooldowns, `AUTO_AIM_RANGE=250` are explicitly placeholder, not balanced. `TODO(unknown)`: real values await a tuning pass — do not treat current numbers as intended design.

## B. Open decisions — need a human/product call (`TODO(decide)`)

Do not resolve these unilaterally; they are judgment calls with no "correct" code answer.

- **Solo vs. the pitch tagline.** "A roguelike you literally cannot beat by yourself" is on the lobby, but solo play is supported. `TODO(decide)`: keep tagline / reframe solo as "practice mode" / reword. See [systems/solo-play.md](systems/solo-play.md) ("Pitch conflict"), [pitch.md](pitch.md).
- **Faction naming reconciliation.** Canonical four doctrines (Sanctum / Tumorous Host / Synaptic Chorus / Penitent) vs. the draft meta-faction orgs (Platelets / Marrow Cult / Synapse Choir / Tumorous Host). `TODO(decide)`: are the draft orgs a meta-layer over the four, a rename, or cut? See [factions.md](factions.md) ("Conflict flag").
- **Canonical relic roster.** Three sets exist: implemented 10 (`STARTER_RELICS`), paper 12 (SYSTEM §3), draft "organs." `TODO(decide)`: pick the canonical roster (or a merge); until then, **code is truth for behavior**. See [content/relic-roster.md](content/relic-roster.md).
- **Meta-progression model.** What persists, how unlocks gate, and the Supabase schema are undefined beyond "unlocks + cosmetics + flags, post-run only." `TODO(decide)` + `TODO(build)`. See [progression.md](progression.md).

## C. Designed, not yet built (`TODO(build)`)

Clear intent exists; these are implementation gaps, not unknowns. Safe to build *to the spec* without new decisions (flag if a decision surfaces).

- **Boss encounter — "The Pulsing Interpreter."** Fully designed (adapts to dominant doctrine, 3 phases, collapses into relic fragments); no code. The headline v1 gap. See [content/bosses.md](content/bosses.md), [prototype-v1.md](prototype-v1.md).
- **Forced & sacrificial extraction.** Normal extract + wipe are implemented; forced-at-100% (beyond plain wipe) and sacrificial (leave a downed Vessel) are designed only. See [systems/extraction.md](systems/extraction.md).
- **Typed rooms + doctrine-skewed aesthetics.** Relic/pressure room types and doctrine-reactive generation are designed; current floors are combat rooms + a loot phase. See [content/biomes.md](content/biomes.md), [factions.md](factions.md).
- **Pattern-aware doctrine scoring ("theology syntax").** Chains/clusters/mirrors/isolates affecting doctrine is conceptual; implemented synergy is tag-overlap only. See [doctrines.md](doctrines.md), [systems/doctrine-tracking.md](systems/doctrine-tracking.md).
- **Mutation system.** Out of v1 scope; no mechanics specified beyond examples. See [content/mutations.md](content/mutations.md).
- **Real art pass.** Phaser primitives → sprites; drop-in at `GameScene` draw calls. See [art-bible.md](art-bible.md).
- **Resync sprite rehydration.** `STATE_RESYNC` (reconnection, shipped 2026-06-25) carries enemies/projectiles, but `GameScene` spawns enemies only on `ENEMY_SPAWNED`, so a rejoining client won't see existing enemies/projectiles until they next change. `TODO(build)`. See `specs/reconnection/design.md`.

## D. Knowledge-base self-sufficiency gaps (this register's own backlog)

Missing *documentation* artifacts that would further help future sessions — proposed, not yet created:

- `TODO(build)` **Inline TODO markers** threaded into individual bible files at each gap above (so a reader hits the flag in context, not only here).
- `TODO(build)` **`docs/technical/code-map.md`** — a concept → source-file → test map (e.g. "synergy → `src/server/src/board/synergy.ts` + `synergy.test.ts`") so a session jumps from design to code without searching. *Risk: staleness; keep it coarse.*
- `TODO(decide)` Whether to add an **R#/T# traceability index** linking `specs/` requirements to the systems files that document them.

---

## Maintenance

This file is **append-and-shrink**: add an item the moment a gap or unknown is discovered; remove it the moment it's resolved (with a `DECISION_LOG.md` entry). If this file is empty, the knowledge base is fully settled — which it will rarely be.
