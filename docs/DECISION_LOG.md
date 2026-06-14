# Decision Log
> Append-only. Never edit past entries. Add new entries at the bottom with date + context.

---

## 2026-06-14 — Renderer: Phaser.js (WebGL)
**Decision**: Use Phaser.js for 2D top-down twin-stick rendering (WASD + mouse).
**Rejected**: 3D (Three.js / Babylon.js).
**Reason**: 3D adds load time, asset budget, and network payload with no gameplay benefit for a top-down dungeon crawler. Phaser's WebGL renderer hits our performance targets in browser without an install.

---

## 2026-06-14 — Netcode: Authoritative Server, Delta Updates
**Decision**: Single authoritative server (Node + Socket.io). Clients receive delta events and render them only.
**Rejected**: Client-side prediction (start simple, add later if needed).
**Reason**: Room-based play with forgiving hit windows makes 50–80ms RTT imperceptible. Authoritative server is simpler, correct by construction, and required for anti-cheat. Client-prediction can be layered on later if latency becomes a user complaint.

---

## 2026-06-14 — Dungeon Gen: Seeded BSP Tree
**Decision**: BSP tree dungeon generation seeded from run ID. Runs server-side only.
**Reason**: <5ms generation, fully deterministic (enables daily challenges + bug reproduction from run ID alone). Client never receives the seed — only the resulting room/connection data as events.

---

## 2026-06-14 — Pathfinding: A* on Grid; Collision: Spatial Hashing
**Decision**: A* for enemy pathfinding on the dungeon grid. Spatial hashing for collision detection.
**Reason**: A* is correct and well-understood for grid graphs. Spatial hashing brings collision from O(n²) to O(1) average — necessary once enemy counts grow.

---

## 2026-06-14 — Stack: React + Phaser client, Node server, Supabase DB
**Decision**: Frontend: React (UI/lobby) + Phaser (game canvas) on Vercel. Backend: Node + Socket.io on Fly.io. DB: Supabase (meta-progression + auth only).
**Reason**: All free tiers. Fly.io stays alive on WebSockets (unlike Render which spins down). Rooms are ephemeral/in-memory — never persisted to DB. Supabase handles only the cross-session data (unlocks, auth).

---

## 2026-06-14 — Package Manager: pnpm Workspaces
**Decision**: pnpm with workspace packages at `src/server`, `src/client`, `src/shared`.
**Reason**: Strict dependency isolation, shared types via `@veins/shared` workspace reference, separate build pipelines for Vercel (client) and Fly.io (server). Better memory efficiency and install speed than npm/yarn.

---

## 2026-06-14 — Test Runner: Vitest
**Decision**: Vitest for all packages.
**Reason**: Native ESM, same config as Vite, ~10× faster than Jest for TypeScript projects. Consistent across server (Node) and client (browser) test environments.

---

## 2026-06-14 — Active Spec Rotation: Manual CLAUDE.md Swap
**Decision**: Switch active spec by manually editing 3 @import lines in CLAUDE.md.
**Rejected**: Windows symlink pointing to `specs/ACTIVE/`.
**Reason**: Windows symlinks require Developer Mode or Admin rights and fail silently when broken. Manual swap is explicit, shows in git diff, and impossible to accidentally skip.

---

## 2026-06-14 — Deployment: Browser-Only, No App Stores
**Decision**: Ship as a browser game only. No iOS App Store, no Google Play.
**Reason**: Avoids app store fees (~$25 one-time Android, $99/yr iOS), review delays, and platform policy risk. Browser covers the target audience (casual co-op, short sessions).
**SSL**: Free via Vercel + Fly.io (Let's Encrypt auto-provisioned). Custom domain optional (~$10–15/yr) but not required at launch.

---

## 2026-06-14 — Mobile Fullscreen: PWA (Progressive Web App)
**Decision**: Add PWA manifest (`manifest.json`, `"display": "standalone"`) so users can add the game to their home screen and play without browser chrome.
**Rejected**: Relying solely on Fullscreen API — blocked on iOS Safari for non-video elements.
**Reason**: PWA standalone mode is the standard cross-platform workaround. Hides URL bar and navigation on both iOS and Android once installed. Implementation cost is low (one JSON file + meta tags).

---

## 2026-06-14 — Control Scheme: Auto-Aim with Manual Override
**Decision**: Default to auto-aim when the right joystick (aim stick) is at rest. Manual aim activates when the player actively moves the aim joystick.
**Rejected**: Manual-aim-only (too punishing for casual mobile players); auto-aim-only (removes strategic targeting for boss fights with minions).
**Reason**: Mirrors Vampire Survivors' proven model — lowers skill floor for casual players, preserves ceiling for players who need to prioritize targets (e.g., targeting a specific minion during a boss fight). Desktop (mouse) is always explicit aim; the system applies primarily to mobile touch input.
**Auto-aim priority rule**: Nearest enemy (Euclidean distance from player position). No cone bias — enemies can approach from any direction, so a directional cone would create unfair dead zones. Lowest HP and highest threat rejected: counterintuitive during chaotic fights. To be implemented in the controls spec.

---

## 2026-06-14 — Board Logic: Pure Functions Returning Result Objects
**Decision**: All Circulatory Board operations (`placeRelic`, `reviveWithLinkedFates`, `advanceFloor`, `evaluateSynergies`) are pure functions. They take current state plus a request and return a new state plus a discriminated-union result (`{ ok: true, board, event } | { ok: false, error }`). They never mutate inputs and never touch Socket.io directly.
**Reason**: Keeps the entire game-logic core testable without a live server (44 tests, zero mocks of network code). The eventual Socket.io handlers become thin plumbing: validate via the pure function, then emit the returned event(s). Immutability also makes desync debugging tractable, since prior state is never destroyed in place.
**Related**: Linked Fates returns its two events as an ordered tuple type `[RELIC_REMOVED, RELIC_PLACED]`, making the spec's required emit order (R6) impossible to violate at compile time, not just at test time.

---

## 2026-06-14 — Circulatory Board Spec Complete
**Decision**: First spec (Circulatory Board) is fully implemented. T1 through T6 done, 44 tests passing, clean typecheck.
**Coverage**: R1 (board state), R2 (placement + validation), R3 (synergy adjacency), R4 (server-authoritative synergy), R5 (board persists across floors), R6 (Linked Fates), R7 (deterministic synergy). All five correctness properties (P1 to P5) have dedicated tests.
**Note**: Socket.io wiring is deliberately deferred. The logic is complete and tested; the network layer is thin plumbing to be added when the multiplayer lobby/room spec begins. `SocketLike` interface in `room/sync.ts` is the seam.

---

## 2026-06-14 — Code Review: Circulatory Board PASS + deferred hardening
**Decision**: Code-reviewer audit of the Circulatory Board returned PASS (no blockers, no warnings). 51 tests pass, clean typecheck, all invariants I1-I7 hold, all correctness properties P1-P5 tested.
**Deferred hardening (from review NOTE)**: `placeRelic` emits `request.ownerId` (client-supplied) rather than `slot.ownerId`. A client could claim authorship of a relic placed into an empty slot. Not a current spec violation. Fix belongs in the multiplayer/rooms spec, where the placing player's identity will come from the authenticated socket rather than a request field. Track and resolve there.

---

## 2026-06-14 — Active Spec switched: Circulatory Board -> Dungeon Generation
**Decision**: Circulatory Board complete; active spec in CLAUDE.md swapped to Dungeon Generation.
**Reason**: Next core system per the roadmap. Its determinism requirement (same run ID -> same dungeon) pairs directly with netcode invariant I3 (seeded RNG, server-only) and enables daily challenges + bug reproduction.

---

## 2026-06-14 — Seeded RNG: mulberry32 + xfnv1a hash
**Decision**: Implement the server seeded RNG as mulberry32 (PRNG) seeded by an xfnv1a string hash of the runId. Lives in `src/server/src/rng/seeded.ts`.
**Rejected**: `Math.random()` (non-deterministic, violates I3); pulling in a third-party PRNG dependency (unnecessary weight for ~15 lines).
**Reason**: Tiny, fast, dependency-free, fully deterministic. `hashSeed` maps a UUID runId to a uint32 seed; same runId always yields the same value sequence. This is the single randomness source for all server procedural systems (dungeon now; loot and spawns later), satisfying I3 across the board.

---

## 2026-06-14 — Dungeon Generation spec complete
**Decision**: Dungeon Generation spec fully implemented. T1-T5 done, 23 tests passing (10 RNG + 13 BSP), clean typecheck.
**Coverage**: R1 (determinism), R2 (multiple non-overlapping rooms), R3 (in-bounds), R4 (full connectivity via spanning-tree corridors), R5 (RNG-only, no Math.random/Date.now), R6 (<5ms perf, asserted), R7 (RNG determinism + ranges). Correctness properties P1-P5 each tested, with non-overlap, in-bounds, and connectivity also fuzzed across 50 distinct seeds.
**Design note**: Corridors carry both room ids and geometric endpoints. The id graph makes connectivity provable/testable (BFS reaches all rooms); the geometry lets the client render L-shaped passages. BSP emits exactly (roomCount - 1) corridors = a spanning tree, so connectivity holds by construction. Socket.io `DUNGEON_LAYOUT` event deferred to the multiplayer/rooms spec.

---

## 2026-06-14 — Active Spec switched: Dungeon Generation -> Multiplayer Rooms
**Decision**: Dungeon Generation complete; active spec swapped to Multiplayer Lobby + Rooms.
**Reason**: This layer finally wires Socket.io to the unit-tested core (board + dungeon) and resolves the deferred placement-ownership hardening from the Circulatory Board review.

---

## 2026-06-14 — Placement Ownership Hardening (resolves deferred review note)
**Decision**: `placeRelic` now takes the authoritative `playerId` (from the authenticated socket), and `PlaceRelicRequest` no longer carries a client-supplied `ownerId`. A player may only place into a slot they own (else `NOT_OWNER`); the emitted event reports `slot.ownerId` (server truth). The `revive` handler likewise forces `reviverId` to the authenticated player.
**Reason**: Closes the trust gap flagged in the Circulatory Board code review. Identity is now server-derived everywhere, satisfying invariant I2 ("never trust client"). This is a breaking change to `placeRelic`'s signature and `PlaceRelicRequest`; placement tests updated accordingly.

---

## 2026-06-14 — Room Codes: node:crypto, not seeded RNG
**Decision**: `generateRoomCode()` uses `node:crypto` (randomInt) over an unambiguous alphabet (no O/0/I/1), 5 chars.
**Reason**: Room codes need uniqueness and unpredictability, NOT reproducibility, so they sit outside invariant I3's seeded-RNG mandate (which exists for reproducible procedural game state). Using the seeded RNG here would make codes predictable. The unambiguous alphabet makes codes easy to read aloud and type.

---

## 2026-06-14 — Home Quadrants: angular sector partition
**Decision**: Board ownership is assigned by sorting the 18 outer hex cells by angle around the origin and splitting into N contiguous arcs (one per player); the center cell goes to the first player.
**Reason**: Contiguous arcs give each player a coherent "home region" while guaranteeing that different players' regions border each other, so cross-player adjacency (and therefore synergy) always exists regardless of player count (2-4). Deterministic.

---

## 2026-06-14 — Multiplayer Lobby + Rooms spec complete
**Decision**: Multiplayer spec fully implemented. T1-T6 done, 43 new tests (110 total across the project), clean typecheck.
**Coverage**: R1 (create + unique codes), R2 (join + all four rejections), R3 (leave/cleanup/host reassignment), R4 (run lifecycle + deterministic dungeon), R5 (19-cell board, total ownership, cross-player adjacency), R6 (server-authoritative ownership), R7 (validated Socket.io handlers, delta broadcasts).
**Design note**: Socket.io wiring is typed against minimal `SocketIOServerLike`/`ServerSocket` interfaces so the handler logic is fully testable with fakes (smoke + flow tests pass); the real socket.io Server is cast at a single boundary in `startServer`. Production bootstrap is guarded by an `isMain` check so importing the module under tests never opens a port. Rooms remain ephemeral and in-memory (I7).

---

## 2026-06-14 — Code Review #2 (Dungeon Gen + Multiplayer) PASS + socket payload hardening
**Decision**: Second code review audited both Dungeon Generation and Multiplayer Rooms. Both PASS, no blockers. Confirmed R6 server-authoritative ownership is genuinely enforced and the deferred Circulatory Board ownership note is fully resolved.
**Acted on review WARNING**: The `place-relic` and `revive` socket handlers cast untrusted payloads and relied on the pure handler to fault — a malformed `coord` would throw inside the listener (uncaught) instead of returning a targeted error. Added an `isCoord` shape guard at the socket boundary for both handlers; malformed payloads now emit `INVALID_COORD` to the requesting socket and never throw. Two regression tests added (102 server tests total).
**Left as-is (documented)**: `join-room` emits `ROOM_NOT_FOUND` for a malformed code shape (slightly misleading vs a distinct bad-request code), and cross-player-adjacency is asserted only for the 2-player case (structurally guaranteed for 3-4 by the center cell bordering all arcs). Minor; revisit if it ever matters.

---

## 2026-06-14 — Addressed both remaining review #2 WARNINGs
**Decision**: Resolved the two minor items left documented above.
1. Added `INVALID_REQUEST` to `LobbyErrorEvent`; `join-room` now emits `INVALID_REQUEST` (not `ROOM_NOT_FOUND`) for a malformed payload, so a bad-shape request is no longer conflated with a genuinely missing room. Regression test added.
2. Extended the cross-player adjacency test to assert the property for 2-, 3-, and 4-player boards (previously only 2). Confirms synergy is structurally possible at every supported player count.
**Result**: 113 tests total (103 server + 10 shared), clean typecheck. No outstanding review findings.

---

## 2026-06-14 — Subagent frontmatter format + extension discovery limitation
**Decision**: Converted the `tools:` frontmatter in all four `.claude/agents/*.md` files from YAML-list form to the canonical comma-separated inline form (e.g. `tools: Read, Grep, Glob`).
**Reason**: Per Claude Code docs, the documented format is comma-separated; the YAML-list form is not the standard and may not parse. This makes the agents correctly loadable.
**Known limitation (not fixable in-repo)**: Custom subagents in `.claude/agents/` are discoverable/invocable in the Claude Code **terminal CLI** (verify with `/agents`), but the **VS Code extension / Agent SDK harness** only exposes built-in agent types (claude, claude-code-guide, Explore, general-purpose, Plan, statusline-setup) and rejects custom names with "Agent type not found" (tracked upstream as claude-code issue #24439). This is why both code reviews this session were run via `general-purpose` with the `code-reviewer` role injected, rather than invoking the agent directly. When using the terminal CLI, the four agents should be directly invocable.

---

## 2026-06-14 — Active Spec switched: Multiplayer Rooms -> Bleed Clock
**Decision**: Multiplayer Rooms complete; active spec swapped to Bleed Clock (third core pillar).
**Reason**: Most existing scaffolding (the `BleedClock` type + `drainRateForFloor` placeholders from the Circulatory Board floor-transition work) fed directly into it, making it the natural next build.

---

## 2026-06-14 — Bleed Clock spec complete
**Decision**: Bleed Clock spec fully implemented. T1-T5 done, 24 new tests (135 total: 123 server + 12 shared), clean typecheck.
**Coverage**: R1 (real-time drain), R2 (depth scaling), R3 (wipe on depletion), R4 (delta `BLEED_CLOCK_TICK` broadcast), R5 (clamp >= 0), R6 (descend raises drain but preserves current — tension carries over), R7 (voluntary extraction), R8 (pure deterministic tick). Properties P1-P5 each tested, including "terminal once" (an already-ended room is not re-ended).
**Design notes**:
- The `BleedClock` type moved from server `room/state.ts` to shared `bleedClock.ts` as `BleedClockState`, since the client must render it (I4). `Room` gained `outcome: RunOutcome | null`.
- Drain math is a single pure function `tickBleedClock(clock, dt)`; room transitions (`advanceBleedForRoom`, `extractRun`) wrap it; `RoomManager` exposes `activeRooms/tickRoom/extractRoom`; the socket layer adds a `runBleedTick(io, manager, dt)` step (exported for tests) driven by a `setInterval` in `startServer` (guarded out of tests) plus an `extract` handler. Same thin-plumbing-over-pure-core pattern as prior specs.
- Tuning (DUNGEON_START_HP=1000, drain rates) remains placeholder; balance belongs to a future gameplay-tuning pass, not this mechanic spec.
