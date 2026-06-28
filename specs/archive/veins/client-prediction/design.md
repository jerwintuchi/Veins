# Design — Client-Side Movement Prediction (Local Player)

Satisfies: R1, R2, R3, R4, R5, R6, P1, P2, P3, P4

This is a **client-only, visual** feature. It changes nothing on the server and adds no socket
events. The server remains the sole authority (I1): the predicted position is an estimate that the
client always converges back to the authoritative `PLAYER_MOVED` position. No new authority flows to
the client (I2) — prediction reads input the client already has and sends nothing extra.

---

## What stays exactly as it is

- **Server.** `runCombatTick` in `src/server/src/index.ts` still applies stored input via
  `movePlayer` (`src/server/src/combat/movement.ts`) and broadcasts `PLAYER_MOVED { playerId, x, y }`
  once per 20Hz tick, combat phase only. `clampToWalkable` (`src/server/src/dungeon/collision.ts`)
  is still the only collision authority. Nothing in `src/server` is touched by this spec.
- **Outbound input.** `src/client/src/App.tsx` still emits `move-player { dx, dy }` from the WASD
  rAF loop and the `VirtualJoystick`. Prediction is additive (R6 AC2).
- **Remote players + enemies.** The `update` loop in `GameScene.ts` still lerps remote player arcs
  toward `playerTargets` and enemy rects toward `enemyTargets` via the existing exponential factor
  `f = 1 - exp(-LERP_SPEED * dt)`. Only the *local* player's arc gets a different code path (R5, P4).

---

## Data Models

New client-side store fields (extend `SceneStore` in `src/client/src/game/SceneStore.ts`; this is
React↔Phaser bridge state, not game-world state):

```typescript
// Local player's current normalized input vector, written by App.tsx input sources
// (WASD rAF loop + VirtualJoystick), read by GameScene.update each frame (R6).
// Zero vector means "no movement input this frame".
localMoveInput: { dx: number; dy: number }; // default { dx: 0, dy: 0 }

// The client's view of the current run phase, mirrored from PHASE_CHANGED / RUN_STARTED /
// STATE_RESYNC. Prediction only integrates input while this is 'combat' (R4).
phase: GamePhase; // default 'loot'
```

New `GameScene` private state (in `src/client/src/game/GameScene.ts`):

```typescript
// The local player's predicted position, integrated from localMoveInput each frame.
// Null until the local player arc exists. This is the value the local arc renders at.
private localPredicted: { x: number; y: number } | null = null;

// The authoritative server position for the local player — the reconciliation goal.
// Set from PLAYER_MOVED for the local player. playerTargets already holds this for
// remote players; the local player uses this dedicated field so the two code paths
// (predict vs interpolate) stay cleanly separated (P4).
private localServerPos: { x: number; y: number } | null = null;
```

New client-side tuning constants (in `src/client/src/game/GameScene.ts` — NOT in `src/shared`,
because I4 forbids logic/movement helpers in shared):

```typescript
// Per-frame fraction of remaining local prediction error removed when the error is
// small (smooth catch-up, no visible snap). Applied as predicted += error * factor,
// where factor = 1 - exp(-RECONCILE_DECAY * dt), matching the existing lerp form.
const RECONCILE_DECAY = 12; // 1/second; ~smooth correction over a few frames

// Error magnitude (world units) at or above which the local prediction snaps directly
// to the server position in one frame (firm correction, e.g. after a server wall clamp),
// preventing a slow drift-back that reads as rubber-banding. Tunable.
const RECONCILE_SNAP_DISTANCE = 48; // ~2 player radii (PLAYER_RADIUS = 12)
```

`PLAYER_SPEED` (= 120, `src/shared/src/combat.ts`) is imported and used as the prediction velocity
— the single source of truth shared with the server (P1, I4).

---

## Algorithm — local player in `GameScene.update(time, delta)`

Replace the local player's branch of the existing player-lerp loop. Remote players keep the current
branch untouched (R5, P4).

```
dt = delta / 1000

// --- Local player: predict + reconcile (only if a local arc exists) ---
if localPredicted != null and localArc exists:
    { dx, dy } = sceneStore.localMoveInput
    mag = sqrt(dx*dx + dy*dy)

    // 1. PREDICT (R1, R4, P1): integrate input only during combat.
    if sceneStore.phase == 'combat' and mag > 0:
        localPredicted.x += (dx / mag) * PLAYER_SPEED * dt
        localPredicted.y += (dy / mag) * PLAYER_SPEED * dt
        // v1: no client-side collision — brief wall overshoot is corrected by
        //     reconciliation when the server clamp arrives (see Decision below).

    // 2. RECONCILE toward the authoritative server position (R2, R3, P2, P3).
    if localServerPos != null:
        ex = localServerPos.x - localPredicted.x
        ey = localServerPos.y - localPredicted.y
        err = sqrt(ex*ex + ey*ey)
        if err >= RECONCILE_SNAP_DISTANCE:
            // Firm: server hard-corrected us (wall clamp / big desync) → snap.
            localPredicted.x = localServerPos.x
            localPredicted.y = localServerPos.y
        else if err > 0:
            // Smooth: decay the error toward zero, same exp form as the lerp.
            g = 1 - exp(-RECONCILE_DECAY * dt)
            localPredicted.x += ex * g
            localPredicted.y += ey * g

    // 3. Render the local arc at the predicted position.
    localArc.x = localPredicted.x
    localArc.y = localPredicted.y
    sceneStore.localPlayerPos = { x: localPredicted.x, y: localPredicted.y } // for mouse-aim

// --- Remote players: unchanged (existing lerp toward playerTargets) ---
for each non-local player:
    (existing exponential lerp toward playerTargets[id])
```

`movePlayer(playerId, x, y)` (the `PLAYER_MOVED` handler in `GameScene`) splits by ownership:
- **local player** → set `localServerPos = { x, y }`; initialise `localPredicted` to `{ x, y }` if
  still null (first server fix snaps); also write `sceneStore.localPlayerPos` as today.
- **remote player** → existing behaviour: `playerTargets.set(id, { x, y })` (unchanged, R5).

`addOrUpdatePlayer(id, x, y, isLocal)` initialises `localPredicted` and `localServerPos` to the
spawn position when `isLocal` is true (so the first frame renders at spawn, not 0,0), and is
otherwise unchanged for remote players.

### Why this satisfies the properties

- **P1 (parity):** step 1 uses the same `PLAYER_SPEED` and the same `dir/mag * speed * dt` form as
  the server's `movePlayer`. In open space the predicted displacement equals the server's.
- **P2 (convergence):** with zero input, step 1 is skipped and step 2 multiplies the error by
  `g ∈ (0,1)` each frame (or snaps once), so the error is monotonically non-increasing and reaches
  ~0 within a bounded number of frames.
- **P3 (authority):** `localServerPos` is set from every local `PLAYER_MOVED` and is the only
  reconciliation goal; once input stops, step 2 drives `localPredicted` to `localServerPos`, so the
  prediction cannot persist against the server.
- **P4 (scope):** remote players never touch `localPredicted` / `localServerPos` / `localMoveInput`
  and keep the existing `playerTargets` lerp.

---

## Phase handling (R4)

`sceneStore.phase` mirrors the authoritative phase the client already receives:
- `RUN_STARTED` → set to `ev.phase ?? 'combat'`.
- `STATE_RESYNC` → set to `ev.phase`.
- `PHASE_CHANGED` → set to `ev.phase`.

`App.tsx` already tracks `phase` in React state and `GameScene` already handles `PHASE_CHANGED`
via `sceneStore.emitPhaseChanged`; this spec additionally stores the latest phase value on
`sceneStore.phase` so `update` can read it synchronously without a React round-trip. Prediction
integration (step 1) is gated on `phase === 'combat'` so the local player does not drift during
`loot`/`transition`.

---

## Socket events

**No new socket events. No changes to existing event payloads.**

- Outbound (unchanged): `move-player { dx, dy }` — emitted by `App.tsx` exactly as today.
- Inbound (unchanged): `PLAYER_MOVED { playerId, x, y }` — the local one becomes the reconciliation
  goal; remote ones drive interpolation as before.

This is stated explicitly to satisfy I6 (no new full-state pushes) and I1/I2 (no new authority): the
client→server contract is byte-for-byte identical to before this spec.

---

## Design decision — v1 has no client-side collision

The server's collision (`isWalkable` / `clampToWalkable`) is server-only and must stay there (I4 —
no movement/collision logic in `src/shared`). Two options for prediction:

- **(a) Recommended for v1 — no client collision.** Predict freely; if the player runs into a wall,
  the predicted sprite briefly overshoots into the wall, then the next local `PLAYER_MOVED` carries
  the server's clamped position and reconciliation corrects it (a large error → `RECONCILE_SNAP`
  firm correction). Pros: zero duplication of server collision, no risk of a client/server collision
  mismatch causing permanent disagreement, smallest surface. Cons: a few frames of visible
  wall-overshoot when sliding along walls — acceptable for v1 given the 20Hz correction cadence.
- **(b) Future — client collision mirror.** Port a read-only copy of `isWalkable`/`clampToWalkable`
  into `src/client` (NOT shared, per I4) and clamp the predicted position locally so overshoot never
  renders. Deferred: it duplicates server logic that must be kept in lock-step, and any drift between
  the two implementations reintroduces the very desync prediction is meant to hide.

**Recommendation: ship (a).** The `RECONCILE_SNAP_DISTANCE` firm-correction branch exists precisely
to make wall clamps look like a clean settle rather than a rubber-band. Track (b) as future
expansion.

---

## Correctness Properties

**P1** — Prediction/server parity: a predicted step with input `D` over `dt` equals the server's
`movePlayer` displacement for the same `D`/`dt` in open space (both use `PLAYER_SPEED`).

**P2** — Convergence: zero-input reconciliation drives predicted → server within a bounded number of
frames; error is monotonically non-increasing.

**P3** — Authority: the latest local `PLAYER_MOVED` is always the reconciliation goal; once input
stops, the predicted position settles on the server position.

**P4** — Scope isolation: remote players and enemies use the unchanged interpolation path and never
read or write prediction state.

---

## Future expansion (out of scope)

- Client-side collision mirror (option (b)) to eliminate wall-overshoot frames.
- Predicting non-combat phases (e.g. free movement during `loot`) — currently the server freezes
  movement outside `combat`, so prediction matches by also freezing.
- Input buffering / replay of unacknowledged inputs against authoritative snapshots (full
  rollback-style reconciliation). v1 uses single-goal error-decay, which is sufficient for a 20Hz
  authoritative tick and forgiving hit windows (per the netcode decision).
