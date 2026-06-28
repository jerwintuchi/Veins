# Technical — Code Map (Design → Source → Test)

> **Status:** Canon (living index — verify against the tree; code is truth)
> **Sources:** generated from the repo source tree + the design bible
> **See also:** [architecture.md](architecture.md) · [README.md](../README.md) · [OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md)

## Purpose

This file lets a future session **jump from a design concept straight to the code and its test** without searching. Each row is: the bible doc that describes a system → the authoritative source file(s) → the test(s) proving it. It is the navigation layer of the knowledge base.

> **Staleness caveat:** paths are verified at creation but *will* drift as the code moves. If a link 404s, the **code is truth** — fix the row. Keep entries coarse (module-level), not line-level, to slow rot.

Path convention: source/test links are `../../src/...` (repo root from `docs/technical/`); doc links point into the bible.

---

## Board & relics

| Concept | Design doc | Source | Test |
|---------|-----------|--------|------|
| Synergy evaluation (pure, server-only) + **solo detection** | [circulatory-board](../systems/circulatory-board.md), [solo-play](../systems/solo-play.md) | [board/synergy.ts](../../src/server/src/board/synergy.ts) | [synergy.test.ts](../../src/server/src/board/synergy.test.ts) |
| Relic placement + ownership | [circulatory-board](../systems/circulatory-board.md) | [board/placement.ts](../../src/server/src/board/placement.ts) | [placement.test.ts](../../src/server/src/board/placement.test.ts) |
| Board build / home quadrants | [circulatory-board](../systems/circulatory-board.md) | [board/layout.ts](../../src/server/src/board/layout.ts) | [layout.test.ts](../../src/server/src/board/layout.test.ts) |
| Linked Fates (revive) | [linked-fates](../systems/linked-fates.md) | [board/linkedFates.ts](../../src/server/src/board/linkedFates.ts) | [linkedFates.test.ts](../../src/server/src/board/linkedFates.test.ts) |
| Relic combat effects (ember/torch/arc/iron) | [relics](../systems/relics.md), [relic-roster](../content/relic-roster.md) | [relic/effects.ts](../../src/server/src/relic/effects.ts) | [effects.test.ts](../../src/server/src/relic/effects.test.ts) |
| Loot pools (seeded) | [relics](../systems/relics.md), [extraction](../systems/extraction.md) | [loot/pool.ts](../../src/server/src/loot/pool.ts) | [pool.test.ts](../../src/server/src/loot/pool.test.ts) |
| Shared board types | — | [shared/board.ts](../../src/shared/src/board.ts) | [board.test.ts](../../src/shared/src/board.test.ts) |
| Shared relic data (`STARTER_RELICS`, tags) | [relic-roster](../content/relic-roster.md) | [shared/relics.ts](../../src/shared/src/relics.ts) | [relics.test.ts](../../src/shared/src/relics.test.ts) |

## Bleed Clock & doctrine

| Concept | Design doc | Source | Test |
|---------|-----------|--------|------|
| Bleed drain tick (pure) | [bleed-clock](../systems/bleed-clock.md) | [bleed/clock.ts](../../src/server/src/bleed/clock.ts) | [clock.test.ts](../../src/server/src/bleed/clock.test.ts) |
| Drain-by-floor + stage (`drainRateForFloor`, `bleedStageOf`) | [bleed-clock](../systems/bleed-clock.md) | [room/state.ts](../../src/server/src/room/state.ts) | [state.test.ts](../../src/server/src/room/state.test.ts) |
| Shared bleed state | [bleed-clock](../systems/bleed-clock.md) | [shared/bleedClock.ts](../../src/shared/src/bleedClock.ts) | [bleedClock.test.ts](../../src/shared/src/bleedClock.test.ts) |
| Doctrine scoring (hidden) | [doctrine-tracking](../systems/doctrine-tracking.md) | [doctrine/scoring.ts](../../src/server/src/doctrine/scoring.ts) | [scoring.test.ts](../../src/server/src/doctrine/scoring.test.ts) |

> **Verified (2026-06-25):** `scoring.ts` computes scores; the threshold *effects* are consumed in `bleed/clock.ts` (drain), `combat/roomCombat.ts` (aggression + votive bonus → `relic/effects.ts`), and `index.ts` (free revive).

## Combat

| Concept | Design doc | Source | Test |
|---------|-----------|--------|------|
| Combat step + tick driver (`stepCombat` / `runCombatTick`) | [combat](../systems/combat.md) | [combat/roomCombat.ts](../../src/server/src/combat/roomCombat.ts) | [roomCombat.test.ts](../../src/server/src/combat/roomCombat.test.ts) |
| Enemy AI tick | [combat](../systems/combat.md) | [combat/tick.ts](../../src/server/src/combat/tick.ts) | [tick.test.ts](../../src/server/src/combat/tick.test.ts), [tickLoop.test.ts](../../src/server/src/combat/tickLoop.test.ts) |
| Enemy spawning (floor-scaled, elite) | [enemies](../content/enemies.md) | [combat/spawn.ts](../../src/server/src/combat/spawn.ts) | [spawn.test.ts](../../src/server/src/combat/spawn.test.ts) |
| Weapons / projectiles | [combat](../systems/combat.md) | [combat/weapon.ts](../../src/server/src/combat/weapon.ts) | [weapon.test.ts](../../src/server/src/combat/weapon.test.ts) |
| Auto-aim target selection | [ui-style-guide](../ui-style-guide.md) | [combat/autoAim.ts](../../src/server/src/combat/autoAim.ts) | [autoAim.test.ts](../../src/server/src/combat/autoAim.test.ts) |
| Player movement | [combat](../systems/combat.md) | [combat/movement.ts](../../src/server/src/combat/movement.ts) | [movement.test.ts](../../src/server/src/combat/movement.test.ts) |
| Body separation | [combat](../systems/combat.md) | [combat/separation.ts](../../src/server/src/combat/separation.ts) | [separation.test.ts](../../src/server/src/combat/separation.test.ts) |
| Combat types (server) | [combat](../systems/combat.md) | [combat/types.ts](../../src/server/src/combat/types.ts) | [types.test.ts](../../src/server/src/combat/types.test.ts) |
| Shared combat types (`ENEMY_TYPES`?) | [enemies](../content/enemies.md) | [shared/combat.ts](../../src/shared/src/combat.ts) | [combat.test.ts](../../src/shared/src/combat.test.ts) |

> **TODO(verify):** exact home of `ENEMY_TYPES` (shared/combat.ts vs combat/spawn.ts vs combat/types.ts).

## Dungeon & determinism

| Concept | Design doc | Source | Test |
|---------|-----------|--------|------|
| Seeded RNG (`mulberry32` + `xfnv1a`) | [determinism-and-rng](determinism-and-rng.md) | [rng/seeded.ts](../../src/server/src/rng/seeded.ts) | [seeded.test.ts](../../src/server/src/rng/seeded.test.ts) |
| BSP dungeon generation | [biomes](../content/biomes.md), [determinism-and-rng](determinism-and-rng.md) | [dungeon/bsp.ts](../../src/server/src/dungeon/bsp.ts) | [bsp.test.ts](../../src/server/src/dungeon/bsp.test.ts) |
| Walkability / collision | [combat](../systems/combat.md) | [dungeon/collision.ts](../../src/server/src/dungeon/collision.ts) | [collision.test.ts](../../src/server/src/dungeon/collision.test.ts) |
| A* pathfinding | [combat](../systems/combat.md) | [dungeon/pathfinding.ts](../../src/server/src/dungeon/pathfinding.ts) | [pathfinding.test.ts](../../src/server/src/dungeon/pathfinding.test.ts) |
| Shared dungeon types | — | [shared/dungeon.ts](../../src/shared/src/dungeon.ts) | [dungeon.test.ts](../../src/shared/src/dungeon.test.ts) |

## Rooms, lobby, floor flow, netcode

| Concept | Design doc | Source | Test |
|---------|-----------|--------|------|
| Room manager (create/join/leave/start) | [architecture](architecture.md), [solo-play](../systems/solo-play.md) | [room/manager.ts](../../src/server/src/room/manager.ts) | [manager.test.ts](../../src/server/src/room/manager.test.ts) |
| Room state | [architecture](architecture.md) | [room/state.ts](../../src/server/src/room/state.ts) | [state.test.ts](../../src/server/src/room/state.test.ts) |
| Room codes (`node:crypto`) | [netcode](netcode.md) | [room/roomCode.ts](../../src/server/src/room/roomCode.ts) | [roomCode.test.ts](../../src/server/src/room/roomCode.test.ts) |
| State sync / `SocketLike` seam | [netcode](netcode.md) | [room/sync.ts](../../src/server/src/room/sync.ts) | [sync.test.ts](../../src/server/src/room/sync.test.ts) |
| Reconnection: disconnect retention + rejoin | [netcode](netcode.md) | [room/manager.ts](../../src/server/src/room/manager.ts) (`markDisconnected`/`rejoin`) | [reconnection.test.ts](../../src/server/src/room/reconnection.test.ts) |
| State resync snapshot (`buildStateResync`) | [netcode](netcode.md) | [room/sync.ts](../../src/server/src/room/sync.ts) | [reconnection.test.ts](../../src/server/src/room/reconnection.test.ts) |
| Floor progression (`advanceFloor`/descend) | [extraction](../systems/extraction.md) | [floor/progression.ts](../../src/server/src/floor/progression.ts) | [progression.test.ts](../../src/server/src/floor/progression.test.ts) |
| Socket.io handlers + server entry | [netcode](netcode.md) | [index.ts](../../src/server/src/index.ts) | [index.test.ts](../../src/server/src/index.test.ts) |
| Shared events (delta payloads) | [netcode](netcode.md) | [shared/events.ts](../../src/shared/src/events.ts) | [events.test.ts](../../src/shared/src/events.test.ts) |
| Shared lobby (`MIN_PLAYERS_TO_START`) | [solo-play](../systems/solo-play.md) | [shared/lobby.ts](../../src/shared/src/lobby.ts) | [lobby.test.ts](../../src/shared/src/lobby.test.ts) |
| Shared floor-progression types | [extraction](../systems/extraction.md) | — | [floorProgression.test.ts](../../src/shared/src/floorProgression.test.ts) |

## Client (render + UI only — untrusted)

| Concept | Design doc | Source | Test |
|---------|-----------|--------|------|
| App shell / screen state machine | [ui-style-guide](../ui-style-guide.md) | [App.tsx](../../src/client/src/App.tsx) | [App.test.tsx](../../src/client/src/App.test.tsx) |
| Board UI / synergy highlight / revive | [circulatory-board](../systems/circulatory-board.md), [linked-fates](../systems/linked-fates.md) | [components/BoardPanel.tsx](../../src/client/src/components/BoardPanel.tsx) | [BoardPanel.test.tsx](../../src/client/src/components/BoardPanel.test.tsx) |
| HUD (bleed/HP/enemies) | [ui-style-guide](../ui-style-guide.md) | [components/HUD.tsx](../../src/client/src/components/HUD.tsx) | [HUD.test.tsx](../../src/client/src/components/HUD.test.tsx) |
| Descend/Extract panel | [extraction](../systems/extraction.md) | [components/DescendPanel.tsx](../../src/client/src/components/DescendPanel.tsx) | [DescendPanel.test.tsx](../../src/client/src/components/DescendPanel.test.tsx) |
| Phase toast | [ui-style-guide](../ui-style-guide.md) | [components/PhaseToast.tsx](../../src/client/src/components/PhaseToast.tsx) | [PhaseToast.test.tsx](../../src/client/src/components/PhaseToast.test.tsx) |
| Lobby / waiting room | [ui-style-guide](../ui-style-guide.md) | [components/LobbyScreen.tsx](../../src/client/src/components/LobbyScreen.tsx), [WaitingRoom.tsx](../../src/client/src/components/WaitingRoom.tsx) | [LobbyScreen.test.tsx](../../src/client/src/components/LobbyScreen.test.tsx), [WaitingRoom.test.tsx](../../src/client/src/components/WaitingRoom.test.tsx) |
| Post-run screen | [progression](../progression.md) | [components/PostRunScreen.tsx](../../src/client/src/components/PostRunScreen.tsx) | [PostRunScreen.test.tsx](../../src/client/src/components/PostRunScreen.test.tsx) |
| Virtual joystick / auto-aim override | [ui-style-guide](../ui-style-guide.md) | [components/VirtualJoystick.tsx](../../src/client/src/components/VirtualJoystick.tsx) | [VirtualJoystick.test.tsx](../../src/client/src/components/VirtualJoystick.test.tsx) |
| Phaser scene (rendering) | [art-bible](../art-bible.md) | [game/GameScene.ts](../../src/client/src/game/GameScene.ts) | [GameScene.test.ts](../../src/client/src/game/GameScene.test.ts) |
| Scene store (React↔Phaser bridge) | [architecture](architecture.md) | [game/SceneStore.ts](../../src/client/src/game/SceneStore.ts) | [SceneStore.test.ts](../../src/client/src/game/SceneStore.test.ts) |
| Sound | [art-bible](../art-bible.md) | [game/SoundManager.ts](../../src/client/src/game/SoundManager.ts) | [SoundManager.test.ts](../../src/client/src/game/SoundManager.test.ts) |
| Socket hook | [netcode](netcode.md) | [hooks/useSocket.ts](../../src/client/src/hooks/useSocket.ts) | — |
| PWA install prompt | [ui-style-guide](../ui-style-guide.md) | [hooks/useInstallPrompt.ts](../../src/client/src/hooks/useInstallPrompt.ts) | — |
| PWA manifest | [stack-and-deployment](stack-and-deployment.md) | TODO(verify) `public/manifest.json` path | [manifest.test.ts](../../src/client/src/manifest.test.ts) |

## Not in code yet

These have design docs but **no source** — see [OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md) §C: boss ([bosses](../content/bosses.md)), mutations ([mutations](../content/mutations.md)), meta-progression persistence ([progression](../progression.md)), forced/sacrificial extraction ([extraction](../systems/extraction.md)), typed/doctrine-skewed rooms ([biomes](../content/biomes.md)).
