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
