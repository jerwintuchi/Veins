# Migration Plan — Veins → Testament

> **Status:** Plan. Documentation has been reorganized; **no source code or specs
> have been moved yet.** Code/spec moves below are gated and await go-ahead.
> **See also:** [../technical.md](../technical.md) · [../DECISION_LOG.md](../DECISION_LOG.md) · [../ROADMAP.md](../ROADMAP.md)

## Purpose

A single, auditable plan for turning the Veins repository into the Testament
repository: what was found, what is preserved, what is archived, and the ordered,
gated steps to get from here to a clean Testament tree, without breaking the
server's passing tests along the way.

## 1. Audit (what is in the repo)

| Area | Path | Nature |
|------|------|--------|
| Root config | `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `vitest.config.ts` | TS monorepo wiring, named `veins` / `@veins/*` |
| Deploy | `Dockerfile`, `fly.toml`, `vercel.json`, `.dockerignore` | Server on Fly.io; static client on Vercel |
| Repo readme | `README.md` | Veins-facing, needs replacement |
| Server | `src/server/src/**` | Authoritative Node server (mixed: reusable tech + Veins rules) |
| Shared | `src/shared/src/**` | `@veins/shared` types/constants (mixed) |
| Client | `src/client/src/**` | React + Phaser UI (entirely Veins; to be replaced by Godot) |
| Specs | `specs/**` | 28 Veins feature specs |
| Agents/rules | `.claude/**` | 4 agents, 2 rules, settings (mostly reusable) |
| Docs | `docs/**` | **Already reorganized**: new bible at root, Veins docs in `docs/archive/veins/` |

## 2. Files that belong to Veins (identity, retire)

- **Whole React/Phaser client:** `src/client/**` (App, GameScene, BoardPanel, HUD,
  DescendPanel, PostRunScreen, PhaseToast, WaitingRoom, LobbyScreen,
  VirtualJoystick, SceneStore, SoundManager, hooks, PWA manifest).
- **Veins game-rule modules (server):** `src/server/src/board/**` (synergy,
  placement, layout, linkedFates), `src/server/src/bleed/**`, `src/server/src/doctrine/**`,
  `src/server/src/loot/**`, `src/server/src/relic/**`.
- **Veins shared modules:** `src/shared/src/board.ts`, `bleedClock.ts`,
  `relics.ts`, and the Veins-specific parts of `floorProgression.ts`.
- **All 28 Veins specs:** `specs/**` (circulatory-board, bleed-clock, loot,
  relic-effects, linked-fates-ui, synergy-anim, doctrine-adjacent, etc.).
- **Naming:** the `veins` package name and every `@veins/*` filter.

## 3. Systems to PRESERVE (kept tech, the reason the reboot is cheap)

| System | Path | Why kept |
|--------|------|----------|
| Room/session lifecycle | `src/server/src/room/{manager,state,roomCode,sync,reconnection}.ts` | Ephemeral rooms, join/rejoin/disconnect retention; engine-agnostic |
| Tick scheduler | `src/server/src/index.ts` (`runCombatTick` loop) | 20Hz authoritative loop; reusable shell |
| Seeded RNG | `src/server/src/rng/**` | Deterministic generation (mulberry32 + hash) |
| Dungeon/layout gen | `src/server/src/dungeon/{bsp,pathfinding,collision}.ts` | Procedural sites; seed-deterministic |
| Movement + collision | `src/server/src/combat/movement.ts`, `dungeon/collision.ts` | `PLAYER_SPEED` integration + wall clamp |
| Projectiles + weapons | `src/server/src/combat/{weapon,spawn,types}.ts` | Real-time combat substrate (reskin, keep) |
| Enemy step + separation | `src/server/src/combat/{roomCombat,separation,tick,autoAim}.ts` | AI step loop and crowd separation |
| Socket abstraction | `SocketIOServerLike` / `ServerSocket` in `index.ts` | The seam that makes the raw-WS swap contained |
| Shared tech types | `src/shared/src/{combat,dungeon,lobby,events}.ts` | Movement constants, dungeon types, room types, event contract (reshape `events` into the protocol) |
| Netcode invariants + spec workflow | `.claude/rules/**` | Process and trust rules; game-agnostic |
| Test harness pattern | `**/*.test.ts` (server/shared) | Pure-core + fake-transport testing style |

## 4. Systems to ARCHIVE / RETIRE (Veins game rules)

| System | Path | Disposition |
|--------|------|-------------|
| Circulatory Board + synergy | `src/server/src/board/**` | Retire; superseded by loadout + sign systems |
| Bleed Clock | `src/server/src/bleed/**`, `src/shared/src/bleedClock.ts` | Retire; replaced by reactive pressure (TD-004) |
| Doctrine scoring | `src/server/src/doctrine/**` | Retire; replaced by the sign-language reading (TD-005) |
| Loot pools | `src/server/src/loot/**` | Retire; replaced by contract rewards + loadout |
| Relic effects | `src/server/src/relic/**`, `src/shared/src/relics.ts` | Retire as-is; concept returns reshaped under relics-and-rites |
| React/Phaser client | `src/client/**` | Retire wholesale; Godot replaces it |
| Veins specs | `specs/**` | Move to `specs/archive/veins/` |

> Archiving means **moving to an `archive/` path within the repo**, not deleting.
> History stays in git; the modules stay readable as reference while new systems
> are built. Code is removed from the build only when its replacement lands.

## 5. The phased migration (ordered, gated)

Each phase has an exit gate; do not start the next until the gate is green. The
server test suite must stay green through every phase that touches `src/server`.

**Phase A — Documentation & architecture (this work).** Reorg docs (done), audit
(done), this plan, the directory hierarchy, doc placeholders, the roadmap.
*Gate:* bible ratified by the user; lore metaphysics decided.

**Phase B — Archive Veins specs + rename shell.** `git mv specs/* specs/archive/veins/`.
Rename `veins` -> `testament` and `@veins/*` -> `@testament/*` across
`package.json`, workspace, and imports (mechanical, test-covered).
*Gate:* `pnpm -r test` still green; no `@veins` references remain.

**Phase C — Stand up the Godot client + transport.** Add `client/` (Godot 4),
implement `SocketIOServerLike` over a raw-WS (`ws`) adapter, drop socket.io. Godot
`WebSocketPeer` connects; one player moves authoritatively in an HTML5 export.
*Gate:* browser round-trip works; existing server handlers unchanged.

**Phase D — Reshape `shared` into the protocol contract.** Define the JSON envelope
and event catalog; add the `tools/` codegen that emits GDScript constants.
*Gate:* one source of truth for messages; client and server share it.

**Phase E — Prune retired server rules.** Remove `board/`, `bleed/`, `doctrine/`,
`loot/`, `relic/` from the build (move to a server `archive/` or delete now that
they are in git history), and excise their wiring from `index.ts`.
*Gate:* server builds and tests green with only kept tech remaining.

**Phase F onward — new gameplay.** Begins only after A–E. Governed by the roadmap
and the R# -> design -> T# -> test chain. **No gameplay is implemented before this.**

## What is already done

- Docs reorganized: new bible at `docs/`, Veins docs at `docs/archive/veins/`.
- `CLAUDE.md`, `GLOSSARY.md`, `DECISION_LOG.md`, `vision.md`, `gameplay.md`, and this
  technical set rewritten for Testament.
- Veins WIP preserved on branch `testament-reboot` (checkpoint `7983aba`);
  `master` parked at the last clean Veins commit.

## Risks and mitigations

- **Import breakage during rename (Phase B):** mechanical and fully test-covered;
  do it as one commit and run `pnpm -r test`.
- **socket.io behaviors the handlers rely on (Phase C):** rooms/broadcast are
  re-created by the `ws` adapter behind the same interface; reconnection logic is
  already in `room/reconnection.ts` and transport-agnostic.
- **Deleting too early:** retired modules move to `archive/` first; they leave the
  build only when their replacement exists and is tested.
