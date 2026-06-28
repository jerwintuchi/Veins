# Tasks — Client-Side Movement Prediction (Local Player)

All tasks: R# (and/or P#) cited → test named → implementation → mark done.
Tests follow the existing client harness in `src/client/src/game/GameScene.test.ts`
(fake Phaser surface, node env, driving `update(time, delta)` and the public scene methods
directly) and the React harness in `src/client/src/App.reconnect.test.tsx` (happy-dom) for the
input-plumbing task.

Ordered: store/input plumbing first, then prediction, then reconciliation, then phase gating +
end-to-end wiring. No task is "implement the whole feature."

---

- [ ] T1 [R6] — Add `localMoveInput: { dx, dy }` (default `{0,0}`) and `phase: GamePhase`
  (default `'loot'`) to `SceneStore` in `src/client/src/game/SceneStore.ts`, with a setter the
  input sources call. Wire `src/client/src/App.tsx` so the WASD rAF loop and `VirtualJoystick`
  `handleMove` write the same normalized vector they already emit as `move-player` into
  `sceneStore.localMoveInput`; keep the existing `socket.emit('move-player', …)` calls unchanged.
  Test: `src/client/src/App.prediction.test.tsx`
  - holding a key / moving the joystick writes the normalized `{dx,dy}` to `sceneStore.localMoveInput`
  - the `move-player` emit still fires with the same vector (outbound traffic unchanged, R6 AC2)
  - releasing input writes `{dx:0, dy:0}` to `sceneStore.localMoveInput`

- [ ] T2 [R1, P1] — Add `localPredicted` + `RECONCILE_*`/`PLAYER_SPEED` usage and the predict step
  (step 1 of the algorithm) to `GameScene.update` in `src/client/src/game/GameScene.ts`; initialise
  `localPredicted` to the spawn position in `addOrUpdatePlayer` when `isLocal`. Render the local arc
  at `localPredicted`.
  Test: `src/client/src/game/GameScene.prediction.test.ts`
  - with `sceneStore.localMoveInput = {dx:1,dy:0}`, `sceneStore.phase='combat'`, and NO `PLAYER_MOVED`
    received, one `update(0, dt)` advances the local arc by ~`PLAYER_SPEED*dt` in +x (R1 AC1)
  - displacement magnitude for a normalized input equals `PLAYER_SPEED*dt` within epsilon (P1)
  - zero input with no divergence leaves the local arc position unchanged (R1 AC2)

- [ ] T3 [R2, R3, P2, P3] — Add `localServerPos` + the reconcile step (step 2) to `GameScene.update`,
  and split `movePlayer(id,x,y)` so a local `PLAYER_MOVED` sets `localServerPos` (and snaps
  `localPredicted` on first fix) while remote ids keep setting `playerTargets`.
  Test: `src/client/src/game/GameScene.prediction.test.ts`
  - sub-snap-distance error + zero input: error strictly decreases across frames and is < epsilon by
    a bounded frame count (R2 AC1, P2)
  - error ≥ `RECONCILE_SNAP_DISTANCE`: one `update` snaps the local arc to the server position
    (R3 AC2, firm correction after a simulated wall clamp)
  - error < `RECONCILE_SNAP_DISTANCE`: predicted decays toward server without an instant jump
    (R3 AC1)
  - authority: diverge prediction, stop input, apply local `PLAYER_MOVED`, step to steady state →
    local arc equals the server position, not the pre-reconcile predicted position (P3)

- [ ] T4 [R4, R5, P4] — Gate the predict step on `sceneStore.phase === 'combat'`; set
  `sceneStore.phase` from `RUN_STARTED` / `STATE_RESYNC` / `PHASE_CHANGED` in the scene's socket
  bindings (and/or App). Confirm the remote-player and enemy branches of `update` are untouched.
  Test: `src/client/src/game/GameScene.prediction.test.ts`
  - phase `'loot'` + non-zero local input: `update` does NOT advance `localPredicted` (R4 AC1)
  - phase flips to `'combat'`: `update` advances `localPredicted` again (R4 AC2)
  - a remote `PLAYER_MOVED` lerps the remote arc toward its target identically whether or not the
    local player has an active predicted divergence (R5 AC1, P4)
  - enemy `ENEMY_MOVED` → lerp path is unchanged (R5 AC2) — regression assertion that the existing
    enemy interpolation test still passes with prediction wired in
