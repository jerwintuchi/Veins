# Technical — Stack & Deployment

> **Status:** Canon (summary — authoritative source is DECISION_LOG.md + configs)
> **Sources:** DECISION_LOG.md (stack, renderer, test runner, deployment, PWA, browser-only entries)
> **See also:** [technical/architecture.md](architecture.md) · [ui-style-guide.md](../ui-style-guide.md) · [progression.md](../progression.md)

## Purpose

This file records **what Veins is built with and where it runs**, and *why* each choice was made. Its governing constraint is the pitch's hardest promise: *open a URL and play, free at $0 until hundreds of concurrent players.* Every technology here is chosen to keep that promise. It's the reference for anyone reconsidering a platform decision.

## Concepts

### Stack
| Concern | Choice | Notes |
|---------|--------|-------|
| UI / lobby | **React** | on Vercel |
| Game canvas | **Phaser 3 (WebGL)** | 2D top-down twin-stick; primitive shapes for now (no sprite sheets) |
| Server | **Node + Socket.io** | on Fly.io; authoritative |
| DB | **Supabase** | meta-progression + auth only; never touches active runs |
| Package manager | **pnpm workspaces** | `src/server`, `src/client`, `src/shared`; `@veins/shared` reference |
| Tests | **Vitest** | all packages; native ESM, fast |

**Renderer:** Phaser over 3D (Three/Babylon) — 3D adds load time, asset budget, payload with no gameplay benefit for a top-down crawler.

### Algorithms
- **Pathfinding:** A* on the dungeon tile grid.
- **Collision:** spatial hashing (O(1) average) for enemy-count scaling.
- (Detail: [systems/combat.md](../systems/combat.md), [determinism-and-rng.md](determinism-and-rng.md).)

### Deployment
- **Server → Fly.io** via Docker (Node 20 + `tsx` for ESM TypeScript). Fly stays alive on WebSockets (unlike Render, which spins down). `tsx` handles `@veins/shared` `.ts` imports at ~100ms startup — fine for a 20–40 min session game. Listens on `process.env.PORT || 3001`.
- **Client → Vercel** via Vite static build. `VITE_SERVER_URL` → the Fly.io URL.
- **Browser-only, no app stores** — avoids store fees, review delays, platform-policy risk. SSL free (Let's Encrypt via Vercel + Fly.io); custom domain optional.

### PWA / mobile fullscreen
`manifest.json` (`"display": "standalone"`) + iOS meta tags → add-to-home-screen, no browser chrome. Chosen over the Fullscreen API (blocked on iOS Safari for non-video elements). See [ui-style-guide.md](../ui-style-guide.md).

### Spec rotation (process)
Active spec switched by manually editing 3 `@import` lines in `CLAUDE.md` (chosen over Windows symlinks, which need Dev Mode/Admin and fail silently). Every switch logged in [DECISION_LOG.md](../DECISION_LOG.md).

## Player Experience (indirect)

The stack *is* the "open a URL and play" promise made real: no install, no store, instant load on desktop or phone, add-to-home-screen for a native feel. Players feel it as **zero friction to start** and **no cost barrier** — the difference between "send me the link" and "go buy and install this."

## Design alignment

Every choice serves the pitch and the *avoid generic conventions* stance: browser-first + PWA delivers the no-install promise; ephemeral rooms + Supabase-for-meta-only matches *I7* and the "only beliefs persist" progression model; free tiers honor the $0 constraint. This is also where the **Godot question lands**: the browser-first/$0/mobile-web pillar is exactly where a heavier engine would weaken the product — the stack is a design decision, not just an engineering one.

## Implementation Considerations

- **Free-tier coupling:** Fly.io (persistent WebSocket process) and Vercel (static) are chosen partly *because* they're free at the target scale. Re-evaluate only if concurrency exceeds free limits. **TODO(unknown):** is an instance live at a public URL? Record it here if so. **TODO(verify):** confirm workspace package names (root README cites `@veins/server`/`@veins/client`; only `@veins/shared` is confirmed). See [OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md) §A.
- **Shared constants gate two runtimes:** values like `CORRIDOR_HALF_WIDTH`, `AUTO_AIM_RANGE`, tick intervals live in `@veins/shared` so client render and server simulation never diverge. Change them in one place.
- **`tsx`-runtime tradeoff:** shipping `.ts` source from `@veins/shared` avoids a dual prod/dev build at a ~100ms startup cost — acceptable for session-length games; revisit if cold-start matters.
- **Art is a drop-in:** Phaser primitives → sprites changes only `GameScene` draw calls (see [art-bible.md](../art-bible.md)) — no pipeline rework.

## Future Expansion

- **Service worker / offline shell** to complete the PWA (deferred).
- **CDN/asset strategy** once real art lands (keep payloads small for mobile).
- **Scaling path** (room sharding / multiple server instances) if concurrency outgrows a single Fly machine — rooms are already independent and ephemeral.
- **Observability** (metrics/logging) for live ops as player counts grow.
