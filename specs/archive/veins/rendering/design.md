# Design — Client Rendering (Phaser 3)

## Architecture

```
App.tsx
  ├── creates Phaser.Game (once, on mount)
  │     └── GameScene (Phaser.Scene)
  │           ├── dungeonGraphics: Phaser.GameObjects.Graphics
  │           ├── playerSprites: Map<PlayerId, PlayerContainer>
  │           ├── enemyContainers: Map<EnemyId, EnemyContainer>
  │           ├── aimRing: Phaser.GameObjects.Graphics
  │           └── camera → follows local player
  ├── HUD.tsx (React, absolutely positioned over canvas)
  │     ├── BleedClockBar (reactive to BLEED_CLOCK_TICK)
  │     ├── FloorIndicator (reactive to FLOOR_ADVANCED)
  │     └── PhaseIndicator (reactive to PHASE_CHANGED)
  └── VirtualJoystick.tsx (unchanged from mobile-controls spec)
```

The Phaser game and React HUD share data through a lightweight `SceneStore` — a
simple EventEmitter the scene writes to and React reads from. No game state lives
in React; React only holds presentation-level state (bar fill %, floor number).

---

## Data Models

### SceneStore (`src/client/src/game/SceneStore.ts`)

```typescript
// Minimal event bus between Phaser scene and React HUD / App.tsx.
// Scene emits; App/HUD subscribe.
export type SceneStoreEvents = {
  'bleed-tick':     (current: number, max: number) => void;
  'floor-changed':  (floor: number) => void;
  'phase-changed':  (phase: GamePhase) => void;
  'player-moved':   (playerId: PlayerId, x: number, y: number) => void;
  'camera-ready':   (camera: Phaser.Cameras.Scene2D.Camera) => void;
};

export class SceneStore extends EventEmitter { ... }
export const sceneStore = new SceneStore(); // singleton; App.tsx imports it
```

### PlayerContainer (internal to GameScene)

```typescript
type PlayerContainer = {
  circle: Phaser.GameObjects.Arc;
};
```

A simple arc (filled circle). Color: `0x44aaff` for local player, `0xffaa44` for
remote; `0x555555` when downed. No container object needed — just the arc.

### EnemyContainer (internal to GameScene)

```typescript
type EnemyContainer = {
  rect:    Phaser.GameObjects.Rectangle; // 24×24 enemy body
  hpBg:   Phaser.GameObjects.Rectangle; // HP bar background
  hpFill: Phaser.GameObjects.Rectangle; // HP bar fill
  maxHp:  number;
};
```

---

## Algorithms

### Dungeon rendering (`drawDungeon`)

```
drawDungeon(dungeon: DungeonLayout):
  dungeonGraphics.clear()
  for each room in dungeon.rooms:
    dungeonGraphics.fillStyle(0x2a2a2a)
    dungeonGraphics.fillRect(room.rect.x, room.rect.y, room.rect.width, room.rect.height)
  for each corridor in dungeon.corridors:
    dungeonGraphics.lineStyle(8, 0x1a1a1a)
    dungeonGraphics.strokeLineShape(new Phaser.Geom.Line(
      corridor.from.x, corridor.from.y, corridor.to.x, corridor.to.y))
```

### Camera setup

```
this.cameras.main.setBounds(0, 0, dungeon.width, dungeon.height)
this.cameras.main.startFollow(localPlayerSprite, true)
```

Called after `drawDungeon` establishes world bounds.

### World bounds from dungeon

```typescript
function dungeonBounds(dungeon: DungeonLayout): { width: number; height: number } {
  // DungeonLayout already has width and height fields (set by BSP generator).
  return { width: dungeon.width, height: dungeon.height };
}
```

### HP bar update

```
updateHpBar(container: EnemyContainer, hp: number):
  const ratio = Math.max(0, hp / container.maxHp)
  container.hpFill.setScale(ratio, 1)  // scale width by ratio; bar is 24px wide
```

### Auto-aim ring

```
showAimRing(enemyId: string | null):
  if enemyId is null:
    aimRing.setVisible(false)
    return
  const enemy = enemyContainers.get(enemyId)
  if enemy is undefined:
    aimRing.setVisible(false)
    return
  aimRing.setPosition(enemy.rect.x, enemy.rect.y)
  aimRing.setVisible(true)
```

The ring is redrawn once in `create()` (strokeCircle at origin, radius 16,
color 0xffff00, lineWidth 2) and repositioned each time aim changes or enemies
move. Because enemies don't yet have live-position updates, the ring follows
the last-known position.

### Mouse-aim world coordinates (R10)

In `App.tsx` `mousemove` handler (replaces viewport-centre version from
mobile-controls spec):

```typescript
function onMouseMove(e: MouseEvent) {
  const camera = sceneStore.camera;
  const playerPos = sceneStore.localPlayerPos;
  if (!camera || !playerPos) return;
  const worldPoint = camera.getWorldPoint(e.clientX, e.clientY);
  const dx = worldPoint.x - playerPos.x;
  const dy = worldPoint.y - playerPos.y;
  socket.emit('aim-player', { dx, dy });
  // idle timer as before
}
```

`sceneStore` exposes `camera` and `localPlayerPos` as mutable properties set
by `GameScene` and read by `App.tsx`.

---

## Client Structure additions

```
src/client/src/
  game/
    GameScene.ts          ← Phaser.Scene subclass
    SceneStore.ts         ← EventEmitter bus + camera/pos refs
  components/
    HUD.tsx               ← React overlay: Bleed Clock bar, floor, phase
    VirtualJoystick.tsx   ← unchanged
  App.tsx                 ← updated: mounts Phaser.Game, updates mouse-aim
  hooks/
    useSocket.ts          ← unchanged
```

---

## Socket → Scene event mapping

| Socket event          | Scene action                                      |
|-----------------------|---------------------------------------------------|
| `BOARD_STATE_SYNC`    | (future: initial sync — dungeon comes from `FLOOR_ADVANCED`) |
| `FLOOR_ADVANCED`      | `drawDungeon(event.dungeon)`, reset player pos    |
| `ENEMY_SPAWNED`       | create enemy container at (x, y)                  |
| `ENEMY_DIED`          | destroy enemy container                           |
| `ENEMY_DAMAGED`       | `updateHpBar(container, event.hp)`                |
| `PLAYER_MOVED`        | move player arc to (x, y)                        |
| `PLAYER_DOWNED`       | set player arc color to `0x555555`                |
| `PLAYER_REVIVED`      | restore player arc color                          |
| `PLAYER_AIM_CHANGED`  | `showAimRing(event.targetId)` for local player   |
| `BLEED_CLOCK_TICK`    | `sceneStore.emit('bleed-tick', ...)`              |
| `PHASE_CHANGED`       | `sceneStore.emit('phase-changed', ...)`           |

---

## Phaser.Game config

```typescript
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,         // WebGL with Canvas fallback
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#0d0d0d',
  scene: [GameScene],
  parent: 'game-container',  // div id in App.tsx
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};
```

---

## HUD color transitions (Bleed Clock)

```
ratio = current / max
color = lerp(
  { r: 0x22, g: 0x88, b: 0x22 },  // green at 1.0
  { r: 0xcc, g: 0x22, b: 0x22 },  // red at 0.0
  1 - ratio
)
```

Implemented as a CSS `background` on a `<div>` with `width: ${ratio * 100}%`. Color
interpolated as inline style via a helper `bleedColor(ratio)`.

---

## Correctness Properties

**P1 (No game state in React)**: The HUD displays values passed from the socket
via `sceneStore`. It never computes health, phase, or floor — it only renders what
the server says.

**P2 (Single Phaser instance)**: The Phaser.Game is created once in `App.tsx`
`useEffect` (empty dep array). `app.destroy(true)` is called in the cleanup. No
re-creation on re-render.

**P3 (World coordinates)**: All positions (players, enemies, dungeon rooms) use
the same world coordinate system. No coordinate conversion needed between
dungeon geometry and sprite positions.

**P4 (Placeholder-only)**: No sprite sheets, atlases, or external assets are
loaded in this spec. All graphics are Phaser primitives (Graphics, Arc, Rectangle).
Asset loading is a separate art pass.

---

## Satisfies Requirements

R1, R2, R3, R4, R5, R6, R7, R8, R9, R10
