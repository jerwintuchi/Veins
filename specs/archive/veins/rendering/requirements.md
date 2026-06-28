# Requirements — Client Rendering (Phaser 3)

The rendering spec wires everything the server broadcasts into a visible game. All
game state comes from server delta events — the client never computes state. Assets
are deliberately placeholder (colored shapes) so the spec can ship before the art
pass. Real sprites are a drop-in swap; the rendering wiring does not change.

Out of scope: relic board UI (separate spec), lobby UI (separate spec), animation
frames, sound, post-processing, Supabase meta-progression.

---

**R1**: As a player, I see a Phaser 3 game canvas rendered inside the browser so
the game is visible on the page.
- AC: `src/client/src/game/GameScene.ts` exports a class `GameScene extends
  Phaser.Scene`; it is added to the Phaser.Game config and renders to a `<canvas>`
  mounted by `App.tsx`
- AC: the canvas fills the full viewport and resizes with the window
- AC: `App.tsx` creates the Phaser.Game instance once on mount and destroys it on
  unmount (no leak)

**R2**: As a player, I see the dungeon layout drawn on the canvas so I understand
the navigable space.
- AC: on `BOARD_STATE_SYNC` (initial join) and `FLOOR_ADVANCED`, `GameScene`
  renders each dungeon room as a filled rectangle and each corridor as a
  connecting line (placeholder art — color-coded: rooms = `#2a2a2a`, corridors =
  `#1a1a1a`)
- AC: dungeon graphics are drawn on a dedicated `dungeonGraphics` Phaser Graphics
  object and cleared + redrawn on each floor change
- AC: dungeon geometry uses world coordinates (same coordinate space as enemy/player
  positions)

**R3**: As a player, I see my character move smoothly and my position is always
correct.
- AC: the local player is rendered as a filled circle (radius 12, color `#4af`)
  centered at the player's world position
- AC: on `PLAYER_MOVED`, the local player sprite updates its position immediately
  (no interpolation in this spec)
- AC: on `FLOOR_ADVANCED`, player position resets to the server-reported position
  (received via `PLAYER_MOVED` after descent)

**R4**: As a player, I see remote players so I know where my teammates are.
- AC: each remote player is rendered as a filled circle (radius 12, color `#fa4`)
  at their last-known position
- AC: `PLAYER_MOVED` events update the correct remote player's position
- AC: `PLAYER_DOWNED` greys out the affected player's circle (color `#555`)
- AC: `PLAYER_REVIVED` restores the circle to its normal color

**R5**: As a player, I see enemies in the dungeon so I can react to threats.
- AC: on `ENEMY_SPAWNED`, a filled rectangle (24×24, color `#e44`) is created at
  the enemy's world position and stored by `enemyId`
- AC: each tick, enemy positions update via `ENEMY_SPAWNED` data (enemies move on
  the server; this spec does not yet receive live enemy position deltas — that hook
  is deferred to the weapon spec which adds `ENEMY_MOVED`)
- AC: on `ENEMY_DIED`, the enemy's rectangle and HP bar are removed from the scene
- AC: on `ENEMY_DAMAGED`, the enemy's HP bar fill updates to reflect new HP

**R6**: As a player, I see a health bar above each enemy so I can judge their
remaining HP.
- AC: each enemy has a background bar (width 24, height 4, color `#333`, offset
  `y - 16` from sprite center) and a fill bar (same dimensions, color `#e44`,
  scaled by `hp / maxHp`)
- AC: HP bars are attached to enemy containers and move with them
- AC: HP bars are removed when the enemy dies

**R7**: As a player, the camera follows my character so I can see my surroundings.
- AC: the Phaser camera tracks the local player's world position; the dungeon and
  all entities are visible within the camera's viewport
- AC: the camera does not move beyond the dungeon's bounding box (clamp to world
  bounds)
- AC: on floor change, the camera position jumps to the player's new position
  (no transition animation in this spec)

**R8**: As a player, I see the Bleed Clock as a HUD bar so I understand the run's
remaining time.
- AC: `src/client/src/components/HUD.tsx` renders a React overlay (positioned over
  the Phaser canvas) containing a Bleed Clock bar: fills left-to-right, color
  transitions from green → yellow → red as `current / max` goes from 1.0 → 0.5 → 0
- AC: `BLEED_CLOCK_TICK` updates the HUD bar reactively (via React state or a
  reactive store)
- AC: the HUD also shows the current floor number and phase (`COMBAT` / `LOOT`)
- AC: `FLOOR_ADVANCED` and `PHASE_CHANGED` update the HUD

**R9**: As a player, I see a highlight ring on the enemy I am auto-targeting so
I know where my attacks will land.
- AC: on `PLAYER_AIM_CHANGED` with `mode: 'auto'` and a non-null `targetId`, a
  circle stroke (radius 16, color `#ff0`, line width 2) is drawn around the
  targeted enemy; it moves with the enemy's position
- AC: when `targetId` becomes `null` or `mode` becomes `'manual'`, the ring is
  hidden
- AC: only the local player's aim indicator is shown (other players' indicators
  are ignored on the local client)

**R10**: As a desktop player, the `aim-player` event uses the correct world
coordinates so aiming is accurate relative to the game world.
- AC: `App.tsx` replaces the viewport-centre mouse-aim calculation from the mobile
  controls spec with a world-space calculation: `mouseWorldPos = camera.getWorldPoint(e.clientX, e.clientY)`, then `dx = mouseWorldPos.x - playerPos.x`, `dy = mouseWorldPos.y - playerPos.y`
- AC: this requires the `GameScene` to expose the camera reference and local player
  position to `App.tsx` via a `SceneEvents` EventEmitter
