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

---

## 2026-06-14 — Code Review #3 (Bleed Clock) PASS + minor fixes
**Decision**: Code-reviewer audited the Bleed Clock spec. PASS, no blockers. All R1-R8 ACs implemented and tested; R3/R5/R6/R8/P5/I2/I6 confirmed. This was the first review run via the actual `code-reviewer` subagent (the frontmatter fix made the custom agents addressable in this harness).
**Acted on findings**:
1. (WARNING) Added an explicit negative test asserting a non-depleting `runBleedTick` emits ONLY `BLEED_CLOCK_TICK` — exactly one broadcast, no `RUN_ENDED`, no full resync — closing R4's "no full game-state resync per tick" AC (I6).
2. (NOTE) Fixed stale comment on `advanceFloor` in `state.ts`: it tagged "R5" referencing the Circulatory Board spec's numbering (ambiguous against Bleed Clock R5 = the clamp). Reworded to cite both Circulatory Board R5 (board untouched) and Bleed Clock R6 (current preserved) by description.
**Documented follow-up (not in this spec's scope)**: `advanceFloor` is pure and unit-tested but has no live `descend`/`advance-floor` socket handler — R2/R6 floor-transition behavior is verified at the unit level only, not end-to-end. A future floor-progression spec should add the inbound handler that calls `advanceFloor` and broadcasts the new floor + dungeon. Tracked here.
**Result**: 136 tests total (124 server + 12 shared), clean typecheck. Bleed Clock spec verified complete.

---

## 2026-06-14 — Active Spec switched: Bleed Clock -> Floor Progression
**Decision**: Bleed Clock complete; active spec swapped to Floor Progression.
**Reason**: Directly closes the documented follow-up from code review #3 — `advanceFloor` was pure/tested but had no live socket handler. Floor Progression ties together per-floor dungeon gen, drain scaling, and board/clock persistence into a real `descend` flow.

---

## 2026-06-14 — Per-floor dungeon seeding: runId#floor
**Decision**: `generateDungeon` gained an optional `floor` param (default 1) folded into the RNG seed as `hashSeed(\`${runId}#${floor}\`)`. The layout's `runId` field stays the bare run id.
**Reason**: Each floor of a run needs a distinct dungeon that is still fully deterministic and reproducible (I3). Folding floor into the seed (not the id) keeps daily-challenge/bug-repro guarantees per floor while preserving the run identity in the payload. Floor 1 behaviour is unchanged for callers that omit the param (default 1).

---

## 2026-06-14 — Floor Progression spec complete
**Decision**: Floor Progression spec fully implemented. T1-T4 done, 14 new tests (150 total: 137 server + 13 shared), clean typecheck.
**Coverage**: R1 (floor++/drain up), R2 (per-floor deterministic dungeon), R3 (board + clock.current carry-over), R4 (server-authoritative, rejects non-in-progress, no mutation on failure), R5 (`FLOOR_ADVANCED` delta broadcast), R6 (combat phase on arrival).
**Design notes**:
- `descendFloor(room, config?)` reuses the pure `advanceFloor` for carry-over, then generates the new floor's dungeon and sets phase `combat`. It mutates the room in place (manager holds the reference), consistent with `advanceBleedForRoom`/`extractRun`.
- Same thin-plumbing pattern: pure-ish core -> `RoomManager.descendRoom` -> `descend` socket handler broadcasting `FLOOR_ADVANCED`.
- Note: combat->loot phase transition within a floor (which re-enables relic placement) is NOT part of this spec; it belongs to the future enemy/combat/encounter spec. Descending sets `combat`; nothing yet flips it back to `loot`.

---

## 2026-06-21 — Active Spec switched: Floor Progression -> Enemy System + Combat
**Decision**: Floor Progression complete; active spec swapped to Enemy System + Combat.
**Reason**: Closes the documented open thread from Floor Progression: `descend` sets `phase = 'combat'` but nothing flips it back to `'loot'`. This spec adds enemy spawning, AI tick, attack resolution, player HP, the combat->loot phase transition (last enemy dies), and wires the `move-player` handler and Linked Fates phase guard.

---

## 2026-06-14 — Code Review #4 (Floor Progression) PASS
**Decision**: Code-reviewer audited Floor Progression. PASS, no blockers, no warnings — only informational notes. Confirmed R1-R6 + P1-P4 covered, floor-1 default proven non-breaking against existing dungeon/manager suites, trust boundary + I1-I4/I6/I7 intact.
**Acted on a NOTE**: Strengthened the R3 board-preservation test to also assert reference identity (`toBe`), not just deep equality — descend carries the board by reference and must never clone/rebuild it. Documents the stronger-than-required guarantee the reviewer highlighted.
**Result**: 150 tests total (137 server + 13 shared), clean typecheck. Floor Progression verified complete. All five specs to date are code-reviewed PASS.

---

## 2026-06-21 — Enemy System + Combat spec complete
**Decision**: Enemy System + Combat spec fully implemented. T1-T14 done, 206 server + 28 shared = 234 tests passing, clean typecheck.
**Coverage**: R1 (ENEMY_TYPES: shambler/spitter stats), R2 (PlayerState + per-player HP map), R3 (deterministic spawnEnemies), R4 (pure tickEnemies), R5 (applyEnemyAttacks + downed state), R6 (wipe check + terminal once), R7 (allEnemiesDead + combat->loot phase transition), R8 (move-player handler), R9 (server authority — no enemy state from client), R10 (delta events: ENEMY_SPAWNED/DAMAGED/DIED/PLAYER_DAMAGED/DOWNED/REVIVED/MOVED/PHASE_CHANGED), R11 (revive phase guard — combat only), R12 (COMBAT_TICK_MS=100ms loop, stops on phase leave).
**Architecture decisions**:
- Enemy IDs are deterministic strings `${runId}-${floor}-${room.id}-${i}` (not UUIDs) to keep `spawnEnemies` a pure function with no side effects.
- Spawn seed `${runId}#${floor}#spawn` is distinct from dungeon layout seed `${runId}#${floor}` so the two procedural systems are independently reproducible but never collide.
- `Room.dungeon: DungeonLayout | null` added so `stepCombat` can access dungeon bounds for `movePlayer` clamping (and future wall collision).
- `stepCombat` returns a `CombatStepResult` discriminated union; the Socket.io tick driver (`runCombatTick`) is thin plumbing that fans out delta events. Same pure-core / thin-socket pattern as all prior specs.
- Player positions initialized at the center of room-0 (entry room) on `startRun`. Per-room wall collision is a follow-up.
- `newlyDeadEnemyIds` tracked in `stepCombat` for `ENEMY_DIED` events — currently always empty (player attacks not yet implemented), but the hook is in place for the weapon/attack spec.

---

## 2026-06-21 — Active Spec switched: Enemy System + Combat → Mobile Controls
**Decision**: Enemy System + Combat complete; active spec swapped to Mobile Controls + Auto-Aim.
**Reason**: Mobile controls unlock real playability — without a virtual joystick, the game is unplayable on any touch device. Auto-aim is tightly coupled to the client controls spec (the server must know which players are in manual vs auto mode to emit `PLAYER_AIM_CHANGED` correctly).

---

## 2026-06-21 — Code Review #5 (Enemy System + Combat) FAIL → fixed
**Decision**: Code-reviewer audited the Enemy System + Combat spec. FAIL on first pass — 6 blockers found and all fixed before marking the spec complete.
**Fixes applied**:
1. (BLOCKER) `ENEMY_SPAWNED` was never emitted on floor entry. Added a loop over `room.enemies.values()` at the end of the `descend` socket handler emitting one `ENEMY_SPAWNED` per enemy (R10 AC).
2. (BLOCKER) IEEE-754 float drift: `attackCooldownRemaining === 0` strict equality permanently blocked second+ attacks after the first (accumulated subtraction of 0.1 from 1.2 leaves ~2.7e-17, not 0.0). Fixed by comparing the pre-clamp value `drainedCooldown = remaining - dt` against `<= 0` instead of checking the post-clamp stored value against `=== 0`. Regression test added (25-tick multi-attack cycle).
3. (BLOCKER) `descend` handler had no phase guard — a client could send `descend` during `combat` phase, silently replacing the enemy map mid-fight (I2 violation). Added `if (room.phase !== 'loot')` guard emitting `LOBBY_ERROR { code: 'WRONG_PHASE' }`. Tests added.
4. (BLOCKER) Revive handler: if `playerStates.get(revivedId)` returned undefined (inconsistent state), the board mutation was already committed but `PLAYER_REVIVED` was never emitted and hp/downed were not restored. Added else branch emitting `LINKED_FATES_ERROR` to the requesting socket.
5. (WARNING) Revive handler mutated the `PlayerState` object in-place (`ps.hp = ps.maxHp`) rather than calling `room.playerStates.set(...)` with a new object. Fixed to use `{ ...ps, hp: ps.maxHp, downed: false }` consistent with the codebase's immutability convention.
6. (WARNING) If `spawnEnemies` returns an empty map (degenerate dungeon with no non-entry rooms), the room entered `combat` phase with zero enemies. `allEnemiesDead` vacuously returned true on the first tick, emitting a spurious `PHASE_CHANGED`. Fixed in `descendRoom`: if `room.enemies.size === 0` after spawn, set `room.phase = 'loot'` immediately.
**Deferred (documented)**: `ENEMY_DAMAGED` has no emission path in `runCombatTick` — no player attack source exists yet. Hook is missing for when the weapon spec lands. `move-player` uses a fixed `COMBAT_TICK_MS/1000` dt, allowing event-flood speed exploit. Both deferred to the weapon/controls spec where rate-limiting and player attack logic will be added. Downed-player carry-over across floors is intentional design: players must be revived (costing a relic) before descending, or enter the next floor still downed and rely on a revive in the new combat phase.
**Result**: 209 tests total (181 server + 28 shared), clean typecheck. All six specs to date are code-reviewed and verified complete.

---

## 2026-06-21 — Active Spec switched: Enemy System + Combat -> Mobile Controls
**Decision**: Enemy System + Combat complete and code-reviewed; active spec swapped to Mobile Controls + Auto-Aim.
**Reason**: Mobile controls is the next foundational layer — the `aim-player` event wires aim state that the weapon/attack spec will consume for projectile direction. PWA setup enables testing the game on mobile devices during development.
**Scope decision**: Touch joystick for aiming (right stick) deferred to the weapon spec since there is nothing to aim at yet; the `aim-player` socket event is fully designed and wired. Mouse-aim world-to-screen coordinate math deferred until a Phaser camera reference exists.

---

## 2026-06-21 — Mobile Controls + Auto-Aim spec complete
**Decision**: Mobile Controls spec fully implemented. T1-T10 done. 260 server/shared tests passing (root vitest) + 16 client tests passing (client vitest).
**Coverage**: R1 (PWA manifest.json with `display:standalone` + iOS meta tags in index.html), R2 (vite.config.ts + App.tsx + useSocket.ts compile and socket connects once on mount), R3 (VirtualJoystick.tsx — left half moves, right half aims, rAF throttle, zero-vector on release), R4 (`AimState` discriminated union in shared, `Room.aimStates` initialized to auto on startRun), R5 (`selectAutoAimTarget` pure function returning nearest alive enemy within `AUTO_AIM_RANGE=250`), R6 (`aim-player` handler — zero vector → auto, non-zero → manual with server-normalized dx/dy), R7 (`PlayerAimChangedEvent` in shared), R8 (combat tick refreshes auto-aim targets; emits delta only on change), R9 (desktop mouse-aim: `mousemove` → `aim-player`; 500ms idle → zero vector auto-revert).
**Architecture decisions**:
- VirtualJoystick uses a `rafPending` boolean flag (not a null-sentinel handle) so the rAF scheduling check survives synchronous stub callbacks in tests. The handle from `requestAnimationFrame` is discarded; the pending flag drives scheduling.
- Auto-aim refresh runs inside `runCombatTick` (post-stepCombat, before wipe/phase events) — same tick driver handles AI and aim, no second interval. Only emits `PLAYER_AIM_CHANGED` when `targetId` actually changes (P3: no duplicate deltas).
- Client tests use `happy-dom` environment; root vitest config (`vitest.config.ts`) excludes `src/client/**` so root and client runners never conflict.
- `@testing-library/react` + `happy-dom` installed as client devDependencies. `@vitest-environment happy-dom` docblock on each client test file makes the environment explicit.
**Deferred (open threads)**: Right-stick aim joystick (needs a weapon to fire), gamepad support, service worker / offline mode, mouse world-to-screen coordinate projection (needs Phaser camera reference — closed in Rendering spec), `PLAYER_AIM_CHANGED` client rendering (needs game canvas — closed in Rendering spec).

---

## 2026-06-21 — Active Spec switched: Mobile Controls → Client Rendering (Phaser 3)
**Decision**: Mobile Controls complete; active spec swapped to Client Rendering.
**Reason**: Rendering is the next foundational layer — it closes the mouse world-coordinate thread from mobile controls (needs Phaser camera), makes all server-broadcast events visible, and enables manual testing of everything built so far. Weapon/Attack spec follows after rendering since it requires seeing hits land.
**Scope decision**: All rendering uses Phaser primitive shapes (Graphics, Arc, Rectangle) — no sprite sheets or external assets. Art is a drop-in swap after the rendering pipeline is wired. This lets the spec ship before any pixel art exists.

---

## 2026-06-21 — Client Rendering (Phaser 3) spec complete
**Decision**: Client Rendering spec fully implemented. T1-T9 done. 260 server/shared tests + 43 client tests, all passing.
**Coverage**: R1 (Phaser.Game mounts in `#game-container`, destroyed on unmount), R2 (dungeon rooms + corridors drawn as Phaser Graphics primitives), R3 (local player Arc follows PLAYER_MOVED), R4 (remote player Arcs, PLAYER_DOWNED greys out, PLAYER_REVIVED restores), R5 (enemy rectangles created on ENEMY_SPAWNED, removed on ENEMY_DIED), R6 (HP bar fill scales by hp/maxHp), R7 (camera follows local player, setBounds = dungeon size), R8 (HUD.tsx Bleed Clock bar + floor/phase from sceneStore), R9 (auto-aim ring shows/hides on PLAYER_AIM_CHANGED for local player), R10 (mouse-aim uses camera.getWorldPoint when scene is ready, falls back to viewport-centre).
**Architecture decisions**:
- `SceneStore` is a typed EventEmitter singleton (no React state in game logic, no game logic in React — P1). Phaser scene writes to it; React HUD subscribes.
- All Phaser objects are plain primitives (no sprite sheets). Real sprites are a drop-in: replace `add.circle/rectangle` calls in `GameScene.ts` with `add.sprite(...)` and the rest of the pipeline is unchanged.
- `GameScene` is tested by mocking Phaser's scene methods (not by running a real Phaser instance). All stubs return `self` for chaining. Scene logic is separated from event-binding so `create()` is callable without a socket.
- `ENEMY_MOVED` event does not exist yet (enemies move server-side but clients only see spawn positions until the weapon spec adds live position updates). Noted in R5 AC.
**Deferred (open threads)**: `ENEMY_MOVED` delta for live enemy position updates (weapon spec), animation frames (art pass), camera smooth-follow / lerp (art pass), relic board overlay UI (separate spec), lobby join UI (separate spec).

---

## 2026-06-22 — Weapon / Attack System spec complete
**Decision**: Weapon spec fully implemented. T1-T6 done. 297 server/shared + 48 client = 345 tests passing.
**Coverage**: R1 (ProjectileState + weapon constants in shared), R2 (three new delta events in shared), R3 (Room weapon state maps initialized in startRun), R4 (move-player stores direction; combat tick applies movement once per tick — closes rate-limiting exploit), R5 (tryAutoFire per-player cooldown, aim-direction resolution), R6 (stepProjectiles advances positions, collision, hp clamp), R7 (PROJECTILE_FIRED / ENEMY_DAMAGED + PROJECTILE_REMOVED(hit) / PROJECTILE_REMOVED(range) events), R8 (ENEMY_MOVED for all alive enemies per tick, closes rendering spec open thread), R9 (GameScene.spawnProjectile/removeProjectile/moveEnemy wired).
**Architecture decisions**:
- `tickEnemies` now marks enemies dead when `hp <= 0` (added end-of-loop check). stepProjectiles reduces hp without touching alive; tickEnemies clones (sees hp=0, alive=true), sets alive=false; stepCombat newlyDeadEnemyIds comparison (before.alive=true && !after.alive) fires ENEMY_DIED correctly.
- runCombatTick order: player move → auto-fire → step projectiles → stepCombat → ENEMY_MOVED → auto-aim refresh. Projectiles before stepCombat so hp=0 enemies die in the same tick.
- No client fire-weapon event. Server auto-fires every WEAPON_COOLDOWN_MS — clients cannot trigger shots (P1, server authority).
- Room carries playerMoveInputs + weaponCooldowns as separate maps; shared PlayerState unchanged (I4).
**Closed open threads**: ENEMY_DAMAGED emission path (Enemy Combat spec), move-player rate-limiting (Enemy Combat spec), ENEMY_MOVED delta (Rendering spec).
**Deferred**: Relic synergy on damage (relic spec), AoE projectiles (relic spec), multiple weapon types, ENEMY_MOVED delta-only optimization (currently emits for all alive enemies; can diff later).

---

## 2026-06-22 — Switched active spec: weapon → board-ui
Weapon spec complete (T1-T6). Switching to Relic Board UI.

---

## 2026-06-22 — Relic Board UI spec complete
**Decision**: Board UI spec fully implemented. T1-T3 done. 308 server/shared + 61 client = 369 tests passing.
**Coverage**: R1 (STARTER_RELICS: 6 relics, 3 tag-pairs, in shared), R2 (startRun populates registry), R3 (RUN_STARTED carries relicRegistry as plain object), R4 (BoardPanel SVG hex grid, owner colors, synergy highlight, loot-phase visibility), R5 (RelicTray lists unplaced relics, selection state, deselect on re-click), R6 (clicking owned empty slot with selection emits place-relic, optimistic deselect), R7 (RELIC_PLACED updates slot + synergy; BOARD_STATE_SYNC replaces all), R8 (App.tsx renders BoardPanel; phase tracked from PHASE_CHANGED; localPlayerId from socket.id).
**Architecture decisions**:
- BoardPanel is a self-contained React component (not routed through sceneStore). Board state is UI state, not game-world state.
- Players list for owner-color assignment comes from ROOM_UPDATE event stored in App.tsx state; no duplication in GameScene.
- synergyMap received from server is the sole synergy truth — no client-side evaluation (P3, I5).
- STARTER_RELICS hard-coded in shared for the prototype; loot-drop rewards (per-floor relic offers) deferred to a separate spec.
**Deferred**: Per-floor loot drops (relic offers on floor clear), relic removal UI (Linked Fates removes via revive handler — already server-complete, needs client visual), drag-and-drop placement, synergy animation effects, lobby UI (create/join room screen).

---

## 2026-06-22 — Switched active spec: board-ui → lobby-ui
Board UI spec complete (T1-T3). Switching to Lobby UI.

---

## 2026-06-22 — Switched active spec: lobby-ui → loot
Lobby UI spec complete (T1-T3). Switching to Per-Floor Loot Drops + Synergy Animation.

---

## 2026-06-22 — Per-Floor Loot Drops + Synergy Animation spec complete
**Decision**: Both specs fully implemented. 321 server/shared + 19 client = 340 tests passing.
**Coverage (loot drops)**: R1 (generateLootPool: seeded Fisher-Yates shuffle, returns min(3, unplaced) relic IDs, deterministic per runId+floor), R2 (Room.lootPool added; createRoom initialises [], startRun generates floor-1 pool), R3 (PHASE_CHANGED carries lootPool when phase='loot'; RUN_STARTED carries lootPool), R4 (place-relic handler validates relic is in lootPool before calling placeRelic; on success removes placed relic from lootPool), R5 (BoardPanel RelicTray filters by lootPool only; updates on PHASE_CHANGED; RELIC_PLACED removes placed relic from tray).
**Coverage (synergy animation)**: R1 (CSS @keyframes synergy-pulse injected via <style> tag on BoardPanel mount; removed on unmount), R2 (<g> elements for synergized slots have className="synergized" and data-synergized="true"), R3 (empty/unsynergized slots have neither attribute).
**Architecture decisions**:
- generateLootPool lives in src/server/src/loot/pool.ts — pure, seeded, server-only (I1, I3).
- Seed namespace: \`${runId}#${floor}#loot\` — independent of enemy spawn seed (\`#spawn\`).
- Loot pool validation in index.ts handler (before placeRelic) rather than inside placeRelic — keeps placeRelic focused on board manipulation; RELIC_NOT_IN_POOL error code added to RelicPlaceErrorEvent.
- BoardPanel uses useState initial value pattern for lootPool (same as board/registry). PHASE_CHANGED handler updates only lootPool (not full board state); RELIC_PLACED handler removes placed relic from lootPool client-side.
- Synergy animation uses CSS injection (not inline styles) so it works with SVG <g> elements; data-synergized attribute enables testability without CSS parser.
**Deferred**: Per-floor loot drops from enemy kills (relics dropping in combat), relic rarities, multi-pick loot, relic upgrades.

---

## 2026-06-22 — Lobby UI spec complete
**Decision**: Lobby UI spec fully implemented. T1-T3 done. 308 server/shared + 77 client = 385 tests passing.
**Coverage**: R1 (LobbyScreen: create-room, join-room, LOBBY_ERROR display), R2 (WaitingRoom: room code, player list, host-only start button, ROOM_UPDATE updates list), R3 (App screen state machine: lobby→waiting→game; Phaser lazy mount on game screen), R4 (RUN_STARTED payload captured in App state; passed as initialBoard/initialSynergyMap/initialRegistry props to BoardPanel — fixes race where BoardPanel wasn't mounted when event fired), R5 (ROOM_UPDATE handler corrected to read ev.room.players, not ev.players; RoomUpdateEvent type confirms the nested shape).
**Architecture decisions**:
- Screen state machine in App.tsx: 'lobby' | 'waiting' | 'game'. Each screen renders exactly one top-level UI; Phaser only constructed in 'game'.
- Child components (LobbyScreen, WaitingRoom) are self-contained with their own socket subscriptions. App.tsx drives transitions only.
- BoardPanel accepts optional initialBoard/initialSynergyMap/initialRegistry props; uses them as useState initial values. RUN_STARTED listener kept as secondary path (for tests and future reconnect). Production path uses props.
- players prop to BoardPanel derived from roomSummary?.players — no separate players state in App.
**Fixed**: ROOM_UPDATE payload bug (ev.players → ev.room.players) — was a silent bug since players state was used only for BoardPanel coloring.
**Deferred**: Auth/persistent player names, spectator mode, rematch flow, reconnection handling (currently room is lost on disconnect).

## 2026-06-22 — Switched active spec: loot → linked-fates-ui
**Decision**: Relic effects in combat (specs/relic-effects) is complete (T1–T5, 351 tests passing). Switched active spec to linked-fates-ui.
**What shipped**:
- `evaluateRelicHit` / `evaluateIncomingDamage` pure functions (effects.ts)
- `fireDurations: Map<EnemyId, number>` and `combatRng: Rng` wired into Room state
- `stepProjectiles` applies ember-core bonus/splash, torch-brand fire, arc-bolt chain
- `stepCombat` ticks fire DoT per enemy, applies iron-skin damage reduction
- `runCombatTick` emits `ENEMY_DAMAGED` for splash, chain, and fire DoT hits
**Next**: Linked Fates client UI — downed player visual, revive button, relic sacrifice confirmation.

## 2026-06-22 — Linked Fates client UI complete; switching to post-run screen
**Decision**: Linked Fates UI (specs/linked-fates-ui) complete (T1–T2, 92 client tests passing).
**What shipped**:
- `BoardPanel` handles `RELIC_REMOVED` — clears relic from slot; synergy pulse removed
- `BoardPanel` shows revive panel on `PLAYER_DOWNED` (teammate only); hides on `PLAYER_REVIVED`
- Two-step revive flow: select source relic → select downed player's empty slot → emit 'revive'
- `LINKED_FATES_ERROR` shows inline error; slots highlighted with `data-revive-source` / `data-revive-target`
**Next**: Post-run screen spec + implementation.

## 2026-06-22 — Post-run screen complete; no active spec
**Decision**: Post-run screen (specs/post-run) complete (T1, 98 client tests passing).
**What shipped**:
- `PostRunScreen` component: shows WIPED/EXTRACTED outcome + final floor + return button
- `App` handles `RUN_ENDED` → transitions to `'post-run'` screen (Phaser + overlays unmounted)
- Return to Lobby clears runEndData and returns to `'lobby'` screen
**Next**: No active spec. Update CLAUDE.md active spec when next feature begins.

## 2026-06-22 — Player HUD + lootPool bug fix; switching active spec to player-hud (complete)
**Decision**: Fixed a bug where `lootPool` from `RUN_STARTED` was dropped by `App`
(RunData type missing the field; initialLootPool never passed to BoardPanel). Floor 1 loot
placement was completely broken. Also added player HP display to the HUD.
**Why**: Both gaps were discovered by reading the code — not spec-driven regressions.
**What shipped**:
- `RunData` in App gains `lootPool: string[]`; `initialLootPool` prop passed to BoardPanel
- `HUD` accepts `socketRef` + `localPlayerId`; subscribes to `PLAYER_DAMAGED`/`PLAYER_DOWNED`/`RUN_STARTED`
- `data-testid="player-hp"` renders current HP / max HP in the HUD
**How to apply**: When touching App data flow, check all props passed to children match the server payload shape.

## 2026-06-22 — Descend/Extract buttons complete
**Decision**: DescendPanel component ships, wired into App alongside BoardPanel.
**What shipped**:
- `DescendPanel` renders during loot phase only; hidden during combat
- "Descend ↓" emits `descend`; "Extract ↑" emits `extract`
- Both buttons disable immediately on click (pending guard) to prevent double-tap
- Re-enable on `FLOOR_ADVANCED`, `RUN_ENDED`, or `LOBBY_ERROR`
- `LOBBY_ERROR` message surfaced in `data-testid="descend-error"`
**Impact**: Core run loop is now fully playable — loot → place relics → descend/extract → combat → repeat.

## 2026-06-22 — Combat HUD improvements + relic detail panel
**What shipped**:
- HUD: enemy count (tracks ENEMY_SPAWNED/ENEMY_DIED/FLOOR_ADVANCED/PHASE_CHANGED/RUN_STARTED)
- HUD: teammate HP rows for all players other than local (data-testid="teammate-hp-{id}")
- HUD: PLAYER_REVIVED restores teammate HP display to PLAYER_MAX_HP
- BoardPanel: relic detail card appears on selection — shows base effect + synergy effect text
- App now passes `players` prop to HUD
**Impact**: Players can see enemy count during combat and all teammates' HP; relic decision-making is now informed.

## 2026-06-22 — Placement feedback, empty tray hint, phase toast
**What shipped**:
- BoardPanel: RELIC_PLACE_ERROR → shows `placement-error` with server message; cleared on next attempt or on RELIC_PLACED
- BoardPanel: Empty tray shows `tray-ready-hint` ("All relics placed — ready to descend!") instead of blank space when all lootPool relics are placed
- PhaseToast: New component, absolute-positioned, listens for PHASE_CHANGED and FLOOR_ADVANCED; COMBAT/FLOOR CLEARED/FLOOR N shown for 2.5s with auto-dismiss; timer resets on new event
- App: PhaseToast mounted in game screen alongside HUD and DescendPanel
**Impact**: Silent placement failures now give user feedback; phase transitions are clearly announced.

## 2026-06-22 — Doctrine Tracking System designed (R8-R11)
**Decision**: Added doctrine scoring, threshold effects, and the BOARD_DOCTRINE_SHIFT event to the Circulatory Board design spec. R8 (Sanctum), R9 (Tumor), R10 (Chorus), R11 (Penitent) are now formal requirements.
**Key design choices**:
- Scores are server-only integers on Room state; no score value is ever sent to the client. Only flavor-text toasts via BOARD_DOCTRINE_SHIFT reveal that a threshold was crossed (and the doctrine is intentionally omitted from the payload).
- Scoring hooks into existing events only: RELIC_PLACED, ENEMY_DIED, RELIC_REMOVED(linked-fates), extract, and the wipe outcome. No new event needed for scoring itself.
- Threshold effects are all expressible as server-side number changes: drain rate multiplier (Sanctum), enemy attack speed multiplier (Tumor), ward protection doubling (Chorus), free revive flag (Penitent). No art assets or animations required.
- Scores do not decay in v1. Decay formula (multiply by 0.85 on floor descent) is documented in the spec as a future balance option, not implemented now.
- Doctrine tags ('sanctum', 'tumor', 'chorus', 'penitent') should be added to the RelicTag union and applied to the 10 existing relics. void-lens is intentionally left neutral (no doctrine tag).
**Reason**: The LORE_DESIGN.md and SYSTEM DESIGN DOC.md both establish doctrine tracking as a core v1 system. All effects are scoped to what the current server implementation can express without new subsystems.

## 2026-06-22 — GameScene rendering fixes + copy button + post-run stats
**What shipped**:
- GameScene: RUN_STARTED handler added — draws floor-1 dungeon, spawns all players at initial positions
- GameScene: `localPlayerId` now read from game registry (set by App.tsx at game creation time)
- GameScene: camera startFollow called on local player arc when first spawned (smooth lerp 0.08)
- GameScene: projectile interpolation — spawnProjectile now stores vx/vy from dx*PROJECTILE_SPEED,dy*PROJECTILE_SPEED; update() loop moves all live projectiles every frame
- Server: RUN_STARTED event now includes `playerPositions` record for initial spawn coordinates
- WaitingRoom: Copy Code button with 1.5s "Copied!" flash feedback
- PostRunScreen: shows enemiesKilled count with singular/plural label
- Server+shared: `RunEndedEvent` extended with `enemiesKilled: number`; Room state tracks cumulative kills via `room.enemiesKilled`; incremented in stepCombat on each enemy death (projectile + fire DoT kills both counted)
**Impact**: Game is now visually playable — players appear on screen, move, projectiles travel, camera follows. Post-run screen shows a meaningful stat.

## 2026-06-22 — Collision + A* Pathfinding spec complete
**Decision**: Collision + Pathfinding spec (T1-T6) fully implemented. 370 server + 51 shared + 161 client = 582 tests passing.
**Coverage**: R1 (player wall-slide via `clampToWalkable`), R2 (projectile terminates on wall entry), R3 (enemy A* pathfinding via `findNextWaypoint`), R4 (`isWalkable` = rooms ∪ corridor L-shapes).
**Architecture decisions**:
- `isWalkable` and `clampToWalkable` live in `src/server/src/dungeon/collision.ts` (pure, server-only).
- `findNextWaypoint` in `src/server/src/dungeon/pathfinding.ts`: A* on integer tile grid with Manhattan heuristic, MAX_ITERATIONS=2000 guard.
- **LOS shortcut**: `findNextWaypoint` first checks `hasLineOfSight` (ray-sampling at 0.5-unit steps). If the straight line to the goal is fully walkable, returns null immediately — the caller's direct-chase fallback is then optimal, and tile-center snapping does not introduce y-drift.
- **Source-in-wall escape**: `clampToWalkable` allows the move if the source itself is not walkable (prevents permanently trapping entities that start in invalid positions, e.g. test helpers).
- All existing weapon/tick/movement tests updated to use flat dungeon constants so synthetic positions at (0,0), (100,0) etc. remain walkable. New collision/pathfinding tests use real multi-room layouts.
- Active spec swapped to dungeon-ruleset.

## 2026-06-22 — Bleed Clock stage escalation (R8-stage, SYSTEM DESIGN DOC §2.2)
**What shipped**:
- `bleedStageOf(current, max)` pure function in `state.ts`: returns 0/1/2/3 based on % bled (0-30%/30-60%/60-80%/80-100%)
- `AGGRESSION_COOLDOWN_MULT = 0.7`: stage 1+ makes enemies attack 30% faster; applied in `tickEnemies` via new optional `aggressionCooldownMult` param
- Stage 2 drain bonus (1.5×) and stage 3 drain bonus (2.0×) applied in `clock.ts` `effectiveDrain()`
- `BleedClockTickEvent` extended with `stage: 0|1|2|3` so client receives current stage on every tick
- New `BleedStageChangedEvent` broadcast when stage escalates; client plays `bleedWarning` sound on stage change
- Doctrine tags (`sanctum`, `tumor`, `chorus`, `penitent`) added to `RelicTag` union and applied to all 10 existing relics; `void-lens` intentionally left neutral
**Key choices**:
- Stage tracked by computing before/after in `runBleedTick` rather than storing on Room — no Room schema change
- Aggression is a cooldown multiplier on reset (not on drain) so the enemy attacks `def.attackCooldown × 0.7` seconds after each hit — cleanly decoupled from the cooldown drain path
- Drain bonus is separate from floor scaling — stages activate within-floor as the clock depletes; floor depth multiplies the base rate
**Impact**: Bleed Clock now has meaningful escalation. At 30% remaining, combat pressure increases; at 40% and 20% remaining, the drain itself accelerates, ratcheting tension toward forced extraction.

---

## 2026-06-23 — Dungeon Ruleset spec complete (specs/dungeon-ruleset/, T1-T4)
**Decision**: Dungeon ruleset implements R1 (floor-scaled enemy counts), R2 (floor-weighted type distribution), R3 (elite last room), R4 (entry room always clear). All changes confined to `src/server/src/combat/spawn.ts`. 593 total tests passing.
**Key choices**:
- `countRange(floor)`: `extra = min(floor(floor-1)/2, 2)` → floors 1-2 give [1,2], floors 3-4 give [2,3], floor 5+ give [3,4]
- `pickEnemyType(floor, rng)`: `spitterProb = min(0.7, 0.15 + 0.1*(floor-1))` — floor 1 = 15% spitters, floor 7+ = 70% spitters (capped)
- Elite room = last room in BSP traversal order (`dungeon.rooms[length-1]`); deterministic, no extra RNG. 2× HP, 1.5× damage, +1 count, stacked on top of floor multipliers.
- Active spec cleared after T4; no new types or events required.

---

## 2026-06-23 — Deployment: Fly.io (server) + Vercel (client)
**Decision**: Server deployed to Fly.io via Docker (Node 20 + tsx runtime for ESM TypeScript); client deployed to Vercel via Vite static build.
**Reasoning**:
- Fly.io: WebSocket-friendly, persistent Node process, free tier sufficient for launch.
- tsx runtime in Docker: `@veins/shared` exports `.ts` source (pnpm workspace); a multi-stage tsc build would require updating shared exports for prod vs dev, adding complexity. tsx handles the workspace imports at a ~100ms startup cost — acceptable for a 20-40 min session game.
- Vercel: zero-config Vite deployment, `VITE_SERVER_URL` env var points to Fly.io URL.
- Port: server listens on `process.env.PORT || 3001`; client fallback updated to match.

---

## 2026-06-23 — Dungeon scale + playability pass
**Decision**: Scale STANDARD_DUNGEON_CONFIG from 80×80 to 1200×1200 (minLeafSize=150, roomPadding=20). Export `CORRIDOR_HALF_WIDTH=20` from `@veins/shared` (was a local constant of 1). Switch GameScene corridor rendering from `strokeLineShape` to L-shaped `fillRect`. Add WASD keyboard input via `useEffect` + RAF loop. Add `cameras.main.setZoom(3)` on scene create.
**Reason**: 80×80 dungeon produced rooms smaller than the player sprite. CORRIDOR_HALF_WIDTH=1 (2-unit corridors) was impassable for a 24-unit player diameter. Both values were buried as local constants; exporting from shared keeps client rendering and server collision in sync.
**A* tile size**: Changed from 1-unit to 10-unit coarse grid. With CORRIDOR_HALF_WIDTH=20, a 1-unit A* grid put 40×80=3200 equal-f-score tiles into the open set per corridor, exceeding MAX_ITERATIONS=2000. A 10-unit tile gives 4-wide corridors, reducing expansions to ~50 for test dungeons and ~500 for real 1200×1200 dungeons. MAX_ITERATIONS raised to 5000 as belt-and-suspenders.

## 2026-06-23 — Body collision spec complete (T1–T4)
**Decision**: `separateBodies` is called from `stepCombat` in `roomCombat.ts` (not from inside `tickEnemies`).
**Reason**: `tickEnemies` is a pure function — it clones enemies but never mutates the input `players` map. Calling `separateBodies` inside it would violate that purity guarantee (confirmed by a failing test: "does not mutate the input player map"). The correct integration point is `stepCombat`, after both `room.enemies = nextEnemies` and `room.playerStates = players` have been assigned — at that point both maps are the live mutable room maps. tasks.md T3 updated to reflect this.

---

## 2026-06-24 — Active Spec switched: (none) → Solo Play
**Decision**: Started a new spec `specs/solo-play/` and pointed CLAUDE.md's Active Spec block at it.
**Reason**: User decision that solo play should be supported. This required a spec because it changes a core mechanic rule (synergy ownership), not just a config value.

---

## 2026-06-24 — Solo Play: relax synergy ownership for single-owner boards
**Decision**: Solo runs are now first-class. Two changes: (1) `MIN_PLAYERS_TO_START` lowered 2 → 1 in `@veins/shared` so a lone host can start; (2) `evaluateSynergies` relaxes the "different owner" rule **only** when the board has a single distinct owner (a solo run). Co-op boards (≥2 owners) keep the original rule unchanged.
**Chosen approach — board-derived solo detection**: `evaluateSynergies` computes `soloBoard = (distinct slot owners) <= 1` and skips the `ownerId === slot.ownerId` guard when true. This is exact because `buildInitialBoard` assigns every one of the 19 cells an owner, so distinct-owner count equals party size. Kept the function pure (no flag threaded through its six call sites; no player-count parameter), satisfying I4/I5's "synergy is a pure server-side function of board state" (P1).
**Rejected**:
- Threading an explicit `solo` flag through all six callers — more surface area, more drift risk, and every caller would have to re-derive the same fact.
- "Practice mode" solo where synergies never fire — honest to the original pitch but a degenerate solo experience.
- Multi-quadrant solo (one player owns several virtual owners) — closest to co-op feel but the largest change; deferred as a possible future mode.
**Edge case (documented)**: a co-op run that loses players mid-run keeps its multi-owner board, so it retains co-op synergy rules — solo relaxation applies only to runs *started* solo. Intended.
**Test impact**: the prior `synergy.test.ts` "owner isolation" case (P2) built a single-owner board to encode the co-op rule; that now reads as solo. Updated it to a genuine multi-owner (co-op) board, which is what the rule is actually about, and added solo-board synergy + determinism cases. `manager.test.ts` "rejects NOT_ENOUGH_PLAYERS" replaced with a solo-start success case. `lobby.test.ts` expects `MIN_PLAYERS_TO_START === 1`.
**Conflicts with the pitch (flagged for product)**: DESIGN.md and the GLOSSARY frame Veins as forced co-op ("a roguelike you literally cannot beat by yourself"), and that exact tagline now sits on the lobby. Co-op remains the intended/headline experience; solo is a relaxed secondary mode. GLOSSARY "Synergy" annotated with the solo exception; DESIGN.md gained a Solo Play note. The literal lobby tagline was left as-is pending a product call on wording.
**Result**: 625 tests passing (60 shared + 394 server + 171 client). Zero new typecheck errors (pre-existing baselines unchanged: shared 4, server 41, client 13).

---

## 2026-06-25 — Active Spec switched: Solo Play → Reconnection; spec complete
**Decision**: Built `specs/reconnection/` (T1–T6) end-to-end. Active Spec in CLAUDE.md switched solo-play → reconnection.
**What shipped**:
- **Stable identity** (R1): server reads `socket.handshake.auth.playerId` (falls back to `socket.id`); client persists a UUID in `localStorage` and sends it via the socket `auth` handshake, using it as `localPlayerId`. The handshake seam already existed in `registerHandlers`.
- **Disconnect retention** (R2): `RoomManager.markDisconnected` keeps a disconnecting player in an in-progress room (ownership/synergy unchanged — the same guarantee solo-play relies on), flags them in `room.disconnectedPlayers`, and deletes the room only when *every* player is disconnected. Lobby disconnect still leaves (ROOM_UPDATE).
- **Rejoin + snapshot** (R3/R4): `RoomManager.rejoin` + `buildStateResync(room)` (pure; single-socket `STATE_RESYNC` — the only full-state push besides the initial board sync, I6 exception). New shared events `STATE_RESYNC`, `PLAYER_CONNECTION_CHANGED`; new `CANNOT_REJOIN` lobby error.
- **Client** (R6): auto-`rejoin` on (re)connect using a `sessionStorage` room code; `STATE_RESYNC` rebuilds `runData` and re-enters the game screen.
**Conflict-analysis correction**: the investigation found the **doctrine threshold effects are already fully wired and consumed** (`bleedDrainMult`→`bleed/clock.ts`, `tumorAggressionActive`→`combat/roomCombat.ts`, `chorusVotiveBonus`→`roomCombat.ts`/`relic/effects.ts`, `penitentFreeRevive`→`index.ts`). The OPEN-QUESTIONS `TODO(verify)` was stale — register + docs corrected.
**Scope boundary (documented follow-up)**: enemy/projectile *sprite* rehydration into the running Phaser scene on resync — the snapshot carries them, but `GameScene` spawns enemies only on `ENEMY_SPAWNED`. Tracked in OPEN-QUESTIONS §C.
**Result**: 648 tests passing (60 shared + 410 server + 178 client). Zero new typecheck errors (baselines unchanged: shared 4, server 41, client 13).
