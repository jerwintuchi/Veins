# Requirements — Client-Side Movement Prediction (Local Player)

## Context

Movement today is fully authoritative with no client-side prediction. The server runs a
20Hz combat tick (`COMBAT_TICK_MS = 50` in `src/server/src/index.ts`); each tick it applies
the player's stored input via `movePlayer` (`src/server/src/combat/movement.ts`) and broadcasts
`PLAYER_MOVED { playerId, x, y }`. The client (`src/client/src/game/GameScene.ts`) lerps every
player sprite — local and remote — toward the last `PLAYER_MOVED` target via exponential
smoothing (`LERP_SPEED = 25`). Because the local player's own sprite only moves *after* its
input round-trips to the server and back, its motion trails input by roughly one tick plus the
interpolation tail, which reads as "not fluid."

This spec acts on the deferred netcode decision (`docs/DECISION_LOG.md`, "Netcode: Authoritative
Server, Delta Updates" — "Client-side prediction (start simple, add later if needed)"). It adds
prediction **for the LOCAL player only**, with smooth server reconciliation. Remote players and
enemies keep their current pure interpolation, unchanged. No new socket events are introduced and
no new authority flows to the client: the client still sends only `move-player { dx, dy }` and the
server still validates, clamps, and ticks exactly as today.

`PLAYER_SPEED = 120` (units/sec) is the shared movement constant (`src/shared/src/combat.ts`);
both the server and the client prediction must use it as the single source of truth (I4).

---

## Functional Requirements

**R1** — As the local player, when I press a movement key (or push the move joystick), my own
sprite starts moving on the very next animation frame, so input feels immediate instead of waiting
for a server round-trip.
- AC: with a non-zero local input vector, after one `GameScene.update(time, delta)` call the local
  player sprite has advanced in the input direction by approximately `PLAYER_SPEED * dt` units,
  *without* any `PLAYER_MOVED` event having been received first.
- AC: with a zero input vector and no pending divergence, one `update` call leaves the local sprite
  position unchanged.

**R2** — As a game system, the predicted local position must be reconciled toward the
authoritative server position whenever a `PLAYER_MOVED` for the local player arrives, so the client
never permanently disagrees with the server.
- AC: given a predicted local position that differs from the server position, after a `PLAYER_MOVED`
  for the local player and a bounded number of zero-input `update` frames, the local sprite position
  converges to within a small epsilon of the server position.
- AC: a `PLAYER_MOVED` for the local player updates the reconciliation goal (the authoritative
  target); a `PLAYER_MOVED` for any other player still drives that player's existing interpolation
  target unchanged.

**R3** — As a game system, a small prediction error corrects smoothly and a large one corrects
firmly, so the player never sees a rubber-band snap on small errors nor a slow drift back after the
server hard-clamps them at a wall.
- AC: when the local error magnitude is below `RECONCILE_SNAP_DISTANCE`, the predicted position
  decays toward the server position by an error-decay factor (no instantaneous jump) across frames.
- AC: when the local error magnitude is at or above `RECONCILE_SNAP_DISTANCE`, the predicted
  position snaps to the server position within a single `update` (firm correction, e.g. after a
  wall clamp).
- AC: `RECONCILE_DECAY` and `RECONCILE_SNAP_DISTANCE` are named, tunable constants defined in the
  client (not in `src/shared`).

**R4** — As the local player, prediction must only run while the server is actually moving players,
so I do not drift during phases where movement is frozen.
- AC: when the client's tracked phase is not `combat`, an `update` call with a non-zero local input
  vector does not advance the predicted local position.
- AC: when the client's tracked phase becomes `combat`, an `update` call with a non-zero local input
  vector advances the predicted local position again.

**R5** — As a developer, prediction is scoped strictly to the local player; remote players and
enemies render exactly as before.
- AC: a `PLAYER_MOVED` for a remote player produces the same interpolation behaviour as today
  (target set, sprite lerps toward it on `update`), with no prediction state created for that
  player.
- AC: enemy interpolation (`ENEMY_MOVED` → target → lerp) is unchanged: no enemy code path reads
  or writes prediction state.

**R6** — As the local player, my last input vector is captured from the existing input sources and
made available to the scene each frame, so prediction can integrate it without changing how input
is sent to the server.
- AC: the local input vector set by the WASD `requestAnimationFrame` loop and by the
  `VirtualJoystick` (both already emitting `move-player { dx, dy }` in `src/client/src/App.tsx`) is
  also written to a single client-side store that `GameScene.update` reads each frame.
- AC: the client still emits `move-player { dx, dy }` to the server exactly as before — the input
  plumbing for prediction is additive and changes no outbound traffic.

---

## Correctness Properties

**P1** — Prediction/server parity. One predicted integration step with input vector `D` over `dt`
produces the same displacement the server's `movePlayer` produces for the same `D` and `dt`
(modulo collision clamping), because both derive velocity from the shared `PLAYER_SPEED`.
- AC: a unit test feeds the same normalized `D` and `dt` to the client predictor and to a
  reference computation using `PLAYER_SPEED`; the predicted displacement magnitude equals
  `PLAYER_SPEED * dt` within floating-point epsilon (collision-free open space).

**P2** — Convergence. With the predicted position diverged from the server position and zero input,
reconciliation drives predicted → server within a bounded number of frames (it never oscillates or
diverges).
- AC: a test seeds a sub-snap-distance error, then steps `update` with zero input N frames and
  asserts the error is strictly decreasing and below epsilon by frame N.

**P3** — Authority. A `PLAYER_MOVED` for the local player is always honoured as the reconciliation
goal; once local input stops, the predicted position cannot persist in contradiction to the latest
server position.
- AC: a test diverges the prediction, stops input, applies a `PLAYER_MOVED`, steps `update` to
  steady state, and asserts the final local position equals the server position (not the
  pre-reconciliation predicted position).

**P4** — Scope isolation. Remote players are unaffected — they remain pure interpolation with no
prediction applied.
- AC: a test moves a remote player via `PLAYER_MOVED` and asserts its sprite lerps toward the
  target identically whether or not the local player has an active predicted divergence (the remote
  path never reads local input or prediction state).
