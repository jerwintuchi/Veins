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
