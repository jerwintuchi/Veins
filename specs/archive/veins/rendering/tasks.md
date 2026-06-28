# Tasks — Client Rendering (Phaser 3)

Order: store/bus first, then Phaser scene skeleton, then dungeon → players →
enemies → camera, then HUD React overlay, then mouse-aim upgrade.

---

- [x] T1 [R1, P2] — Create `src/client/src/game/SceneStore.ts` with the
  `SceneStore` singleton (EventEmitter + `camera` and `localPlayerPos` refs).
  Test: `src/client/src/game/SceneStore.test.ts`
  - `sceneStore` is a singleton instance
  - emitting `'bleed-tick'` notifies subscribers with `(current, max)`
  - emitting `'phase-changed'` notifies subscribers with the phase string
  - `camera` and `localPlayerPos` fields are initially `null`

- [x] T2 [R1, P2] — Update `App.tsx` to mount a Phaser.Game inside a
  `<div id="game-container">` and destroy it on unmount.
  Test: `src/client/src/App.test.tsx` (extended)
  - Phaser.Game is constructed once inside `useEffect`
  - `game.destroy(true)` is called in the `useEffect` cleanup
  - the `#game-container` div is present in the rendered output

- [x] T3 [R2, P3, P4] — Implement `GameScene.ts`: `create()` sets up
  `dungeonGraphics` and wires `FLOOR_ADVANCED` socket event to `drawDungeon`.
  Test: `src/client/src/game/GameScene.test.ts`
  - `drawDungeon` clears and redraws: calls `fillRect` once per room, calls
    `strokeLineShape` once per corridor
  - called twice with the same dungeon, produces the same number of draw calls
    (idempotent via clear+redraw)
  - passing a dungeon with 3 rooms and 2 corridors: 3 fillRect calls + 2 strokeLine calls

- [x] T4 [R3, R4, P3] — Add local and remote player sprites (Arc objects) to
  `GameScene`. Wire `PLAYER_MOVED`, `PLAYER_DOWNED`, `PLAYER_REVIVED`.
  Test: `src/client/src/game/GameScene.test.ts` (extended)
  - a `PLAYER_MOVED` event for the local player updates the arc's x/y
  - a `PLAYER_MOVED` event for a remote player updates that arc's x/y
  - `PLAYER_DOWNED` sets the arc fill color to `0x555555`
  - `PLAYER_REVIVED` restores the arc fill color to its player color

- [x] T5 [R5, R6, P4] — Add enemy containers to `GameScene`. Wire
  `ENEMY_SPAWNED`, `ENEMY_DIED`, `ENEMY_DAMAGED`.
  Test: `src/client/src/game/GameScene.test.ts` (extended)
  - `ENEMY_SPAWNED` creates a rectangle + HP bar at the given position
  - `ENEMY_DIED` removes the container (no lingering objects)
  - `ENEMY_DAMAGED` updates HP bar fill width proportional to `hp / maxHp`
  - `ENEMY_DAMAGED` with `hp = 0` sets HP bar fill to zero width (not negative)

- [x] T6 [R7, P3] — Wire camera to follow the local player and clamp to dungeon
  world bounds.
  Test: `src/client/src/game/GameScene.test.ts` (extended)
  - after `FLOOR_ADVANCED`, `camera.setBounds` is called with the dungeon dimensions
  - `camera.startFollow` is called with the local player's arc object
  - on floor change, the camera follow target is the updated player arc

- [x] T7 [R9] — Add the auto-aim ring to `GameScene`. Wire `PLAYER_AIM_CHANGED`
  for the local player only.
  Test: `src/client/src/game/GameScene.test.ts` (extended)
  - `PLAYER_AIM_CHANGED` with `mode: 'auto'` and a known `targetId` makes the ring
    visible at the enemy's position
  - `PLAYER_AIM_CHANGED` with `targetId: null` hides the ring
  - `PLAYER_AIM_CHANGED` for a remote player (different `playerId`) does not move
    or show the local ring

- [x] T8 [R8, P1] — Create `HUD.tsx` React component with Bleed Clock bar,
  floor number, and phase indicator. Wire to `sceneStore` events.
  Test: `src/client/src/components/HUD.test.tsx`
  - renders a bar element; after a `'bleed-tick'` emit with `(500, 1000)`, bar
    width is 50%
  - bar color is green when `ratio >= 0.5`, red when `ratio <= 0.1`
  - floor number updates on `'floor-changed'`
  - phase text updates on `'phase-changed'`

- [x] T9 [R10] — Update `App.tsx` mouse-aim handler to use world coordinates from
  `sceneStore.camera` and `sceneStore.localPlayerPos`.
  Test: `src/client/src/App.test.tsx` (extended)
  - when `sceneStore.camera` and `localPlayerPos` are set, `mousemove` emits
    `aim-player` with world-space `dx/dy` (not viewport-centre delta)
  - when `sceneStore.camera` is null (scene not ready), `mousemove` does not emit
