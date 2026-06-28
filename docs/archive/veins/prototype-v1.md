# Veins — Prototype v1 (Playable Vertical Slice)

> **Status:** Canon
> **Sources:** SYSTEM DESIGN DOC.md §0 (Scope), §1 (Game loop + session length), §9 (Success criteria); cross-ref DECISION_LOG.md for current build status
> **See also:** [systems/](systems/) · [content/](content/) · [DECISION_LOG.md](DECISION_LOG.md)

## Purpose

This file is the **cut-line**. It defines what the first playable proves and — just as importantly — what it deliberately leaves out, so scope creep has somewhere to bounce off. It is the contract between the vision and a shippable thing.

## Concepts — scope of v1

**In scope:**
- 1 full playable dungeon run loop
- 1 biome set (the initial **Atrium** — see [content/biomes.md](content/biomes.md))
- 10–15 relics (see [content/relic-roster.md](content/relic-roster.md))
- 1 boss (the Doctrine Test Boss — see [content/bosses.md](content/bosses.md))
- Circulatory Board system (core mechanic — [systems/circulatory-board.md](systems/circulatory-board.md))
- Basic doctrine tracking (hidden — [systems/doctrine-tracking.md](systems/doctrine-tracking.md))
- Extraction + Bleed Clock loop ([systems/extraction.md](systems/extraction.md), [systems/bleed-clock.md](systems/bleed-clock.md))

**NOT in v1:**
- full faction roster
- full mutation system (see [content/mutations.md](content/mutations.md))
- multiple biomes
- full meta-progression system

### Core game loop
1. Lobby (room code join, 2–4 players — solo also supported, see [systems/solo-play.md](systems/solo-play.md))
2. Spawn in Atrium
3. Repeat: combat room → loot room (relic choice) → board placement phase → Bleed Clock updates
4. Mid-boss encounter
5. Final boss encounter
6. Extraction OR wipe
7. Reward + persistence update (see [progression.md](progression.md))

**Session length target:** 20–30 min/run · 5–8 rooms before boss · 1 boss per run (v1).

## Player Experience — what v1 must make a player feel

V1 succeeds only if the *organism* feeling lands with the minimum content. The success criteria are phrased as player quotes precisely because they test feeling, not feature completeness:

- "Our build felt like a philosophy."
- "The boss reacted to how we played."
- "We accidentally built synergy that felt intentional."
- "The game felt like it was watching us."

A v1 that has all the systems but produces none of these quotes has failed; a v1 that produces them with three relics and one room has succeeded.

## Design alignment

V1 is scoped to prove the **spine** end-to-end at small scale: a build that means something (theology), a boss that reads behavior (delayed consequence), synergy that feels authored but isn't (emergence). It intentionally excludes the breadth (full rosters, multiple biomes) that would add content without testing the loop — a direct application of *favor emergent systems over hardcoded content*.

## Implementation Considerations — current build status

The implemented vertical slice has progressed well beyond the original paper design (625 tests passing as of 2026-06-24): board, synergy, bleed clock with stage escalation, enemy/weapon/projectile combat, A* pathfinding, collision, lobby, rendering, loot pools, doctrine *scoring*, solo mode. Authoritative, dated build history lives in the append-only [DECISION_LOG.md](DECISION_LOG.md).

**Known gaps against v1 paper scope** (so agents don't assume parity): the **boss** is designed but not implemented; **doctrine threshold effects** are designed and partially wired; the relic roster is the implemented 10 (`STARTER_RELICS`), not the paper 12. Where paper design and code diverge, the relevant system/content file flags it as the source of truth for *current behavior*.

## Future Expansion

- A **v1 → v1.1 punch-list** derived from the gaps above (land the boss; finish threshold effects; reconcile the relic roster).
- A **v2 scope sketch**: second biome, the mutation system, meta-progression depth, and the first non-Atrium boss — each gated on v1's success quotes being reliably reproduced in playtests.
