<br>
<div align="center">

# 🩸 VEINS

### *A roguelike you literally cannot beat by yourself.*

A browser-based 2-4 player co-op action roguelike where the party shares **one** hexagonal relic board, and synergies only fire when your relic is touching a teammate's.

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=flat&logo=socketdotio&logoColor=white)
![Phaser](https://img.shields.io/badge/Phaser-2B2D2F?style=flat&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=flat&logo=vitest&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-F69220?style=flat&logo=pnpm&logoColor=white)

**No installs. No app stores. Open a link and play.**

</div>

---

## The Problem With Every Co-op Roguelike

In Hades, you play alone. In Enter the Gungeon, two players each have their own gun. In Risk of Rain 2, items stack on *your* character; a teammate's items don't interact with yours.

Every co-op roguelike treats the party as N solo players who happen to share a screen. The build space is additive, not combinatorial. You optimise *yourself.*

**Veins breaks this.**

---

## The Circulatory Board

The party shares **one hexagonal relic board.** Each player owns slots on it, but relics only fire their strongest (synergy) effect when adjacent to a compatible relic owned by a *different* player.

```
        [ P1: Ember Core ]
       /    🔥  fire, aoe    \
      /                       \
[ P2: Thornwall ]         [ P3: Chain Bolt ]
  🌿  poison, shield         ⚡  chain, aoe
      \                       /
       \                     /
        [ P4: Void Pulse ]
             💀  chain, party
```

In the board above:
- **Ember Core** (P1) is adjacent to **Chain Bolt** (P3): both share `aoe`, so **both synergies fire.**
- **Thornwall** (P2) is adjacent to **Ember Core**: no shared tag, so no synergy.

The build space is **combinatorial across players**, not additive per player. You're not optimising your character. You're optimising the **party organism.**

---

## Supporting Mechanics

### 🩸 Bleed Clock
The dungeon has a global HP bar draining in real time, faster the deeper you go. Loot scales with depth.

Every floor is a group negotiation: *"Do we extract now or push one more room?"* FTL-style dread, but shared and vocal. One greedy teammate can wipe the run.

### 💀 Linked Fates
Reviving a downed teammate costs **one of your own relics**, sacrificed into their board slot.

Death mid-run doesn't just remove a player; it **reshapes the party build.** The board you planned ten minutes ago is gone. Adapt or die.

---

## How a Run Feels

1. **Lobby**: share a room code, 2-4 players join in browser
2. **Descent**: seeded dungeon generated server-side; you fight, loot, place relics
3. **Tension**: Bleed Clock ticks; deeper floors drain it faster; better loot waits below
4. **Negotiation**: "I need a `fire` relic adjacent to my slot. Who has one?"
5. **Crisis**: someone goes down; the reviver sacrifices a relic; the build changes
6. **Extract or die**: post-run meta-progression updates (unlocks, relic roster)

Sessions: **20-40 minutes.** Meta: **months.**

---

## Tech Stack

| Layer | Tech | Why |
|---|---|---|
| Renderer | Phaser.js (WebGL) | 2D top-down, runs anywhere, no install |
| Frontend UI | React + Socket.io client | Lobby, menus, board UI |
| Server | Node.js + Socket.io | Authoritative game state; clients render deltas only |
| Dungeon Gen | Seeded BSP tree | < 5ms, deterministic from run ID (daily challenges + bug repro) |
| Collision | Spatial hashing | O(1) avg vs O(n²) naive |
| Database | Supabase | Meta-progression + auth only; rooms are ephemeral/in-memory |
| Frontend deploy | Vercel | Free tier |
| Server deploy | Fly.io | Free tier; stays alive on WebSockets unlike Render |
| Tests | Vitest | Fast, native ESM, same config as Vite |
| Packages | pnpm workspaces | `@veins/server`, `@veins/client`, `@veins/shared` |

**Cost: $0 until hundreds of concurrent players.**

Mobile: browser-based with auto-aim (nearest enemy) + manual override joystick. PWA support for fullscreen on iOS.

---

## Architecture

```
src/
├── server/    ← authoritative. All game state lives here. Never trust client input.
├── shared/    ← types + constants only. Single source of truth for both sides.
└── client/    ← render + UI only. Untrusted. Receives delta events and renders them.
```

All procedural logic (dungeon gen, synergy evaluation, loot rolls) runs server-side. Clients are thin renderers. The trust boundary lives in the folder structure.

---

## Project Status

> Spec-driven development: every feature follows `R# -> Design -> T# -> Test -> Implementation`.

**Foundation**
- [x] Workspace setup (pnpm workspaces, Vitest, strict TypeScript)
- [x] Shared type system (`HexCoord`, `RelicBoard`, `SynergyMap`)
- [x] Agent roster (netcode-engineer, gameplay-designer, spec-writer, code-reviewer)

**Circulatory Board** *(complete — 44 tests passing)*
- [x] Requirements (R1-R7) + design (types, algorithms, Socket.io events)
- [x] T1: `hexNeighbors` + `hexCoordKey` with tests
- [x] T2: `evaluateSynergies` (pure, deterministic) with property tests
- [x] T3: Relic placement handler + `RELIC_PLACED` event
- [x] T4: Linked Fates revive mechanic
- [x] T5: `BOARD_STATE_SYNC` on room join
- [x] T6: Board persistence across floor transitions

**Dungeon Generation** *(complete — 23 tests passing)*
- [x] Seeded RNG (mulberry32, deterministic from run ID)
- [x] BSP room generation (in-bounds, non-overlapping)
- [x] Corridor connection (spanning tree, fully connected)
- [x] `generateDungeon(runId, config)` (deterministic, < 5ms)

**Multiplayer Lobby + Rooms** *(complete — 43 tests passing)*
- [x] Lobby types + room codes (unambiguous alphabet, crypto-random)
- [x] Hex board construction (radius-2, 19 cells, angular home regions)
- [x] Placement hardening (server-authoritative ownership, no client spoofing)
- [x] `RoomManager` (create/join/leave/start, ephemeral in-memory)
- [x] Socket.io wiring (authoritative handlers, delta broadcasts)

**Bleed Clock** *(complete — 24 tests passing)*
- [x] Real-time drain math (pure, clamped, deterministic)
- [x] Depth scaling (deeper floors drain faster, tension carries over)
- [x] Run-end on depletion (wipe) + voluntary extraction
- [x] Delta broadcast (`BLEED_CLOCK_TICK`) + server game loop

**Up next**
- [ ] Enemy system + combat
- [ ] Mobile controls (virtual joystick + auto-aim)
- [ ] PWA manifest (fullscreen on iOS)
- [ ] Meta-progression (Supabase)

---

## Running Locally

```bash
# Prerequisites: Node >= 20, pnpm >= 9
git clone https://github.com/jerwintuchi/Veins.git
cd Veins
pnpm install

# Run server
pnpm dev:server

# Run client (separate terminal)
pnpm dev:client

# Run all tests
pnpm test
```

---

<div align="center">

*Built spec-first. Every mechanic is a requirement before it is a line of code.*

</div>
