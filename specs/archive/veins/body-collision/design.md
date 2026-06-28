# Body Collision — Design

Satisfies: R1, R2, R3, R4, R5, P1, P2, P3

---

## New Shared Constants

Add to `src/shared/src/combat.ts`:

```typescript
export const PLAYER_RADIUS         = 12;  // world units — diameter 24, fills 60% of a corridor
export const ENEMY_RADIUS_SHAMBLER = 12;  // same footprint as player; one shambler blocks a corridor
export const ENEMY_RADIUS_SPITTER  =  8;  // smaller, faster; two can stand side-by-side in a corridor
```

Add to `src/shared/src/dungeon.ts`:

```typescript
// Target visible height in world units on all devices (mobile and PC).
// Dynamic zoom = viewport.height / DESIGN_VIEW_HEIGHT.
// At 390px viewport height (iPhone 14 landscape): zoom ≈ 1.5, player = 9.2% of view height.
// At 1080px (1080p desktop): zoom ≈ 4.15, same world area, crisper pixels.
export const DESIGN_VIEW_HEIGHT = 260;
```

Invariant check (testable):
```
CORRIDOR_HALF_WIDTH * 2 >= PLAYER_RADIUS * 2   →  40 >= 24  ✓
ENEMY_RADIUS_SHAMBLER + ENEMY_RADIUS_SHAMBLER > CORRIDOR_HALF_WIDTH * 2   →  24 > 40  ✗
```
Two shamblers side-by-side (combined diameter 24) fit in a 40-unit corridor individually,
but two shamblers *centred* at the same point would overlap and get pushed apart along the
corridor axis — effectively queuing single-file in narrow passages. Intended.

---

## Algorithm: `separateBodies`

**File:** `src/server/src/combat/separation.ts`

**Inputs:**
- `players: Map<PlayerId, PlayerState>` (server-owned, mutable)
- `enemies: Map<EnemyId, EnemyState>` (server-owned, mutable)
- `dungeon: DungeonLayout` (for `clampToWalkable`)

**Output:** `void` — mutates `.x` and `.y` in place.

**Steps (single pass per tick):**

```
1. Build entity list:
   bodies = [
     ...players.values()  → { ref: PlayerState,  radius: PLAYER_RADIUS,         isPlayer: true  },
     ...enemies.values()  → { ref: EnemyState,   radius: enemyRadius(typeId),   isPlayer: false },
   ]

2. For each pair (i, j) where i < j:
   a. Skip if both isPlayer (R3).
   b. dx = b.ref.x - a.ref.x,  dy = b.ref.y - a.ref.y
   c. dist = sqrt(dx² + dy²)
   d. minDist = a.radius + b.radius
   e. If dist >= minDist: continue  (no overlap)
   f. Compute overlap = minDist - dist
   g. If dist < 0.001 (coincident): push along +x axis (nx=1, ny=0) to break symmetry
      else: nx = dx/dist,  ny = dy/dist  (unit vector from a to b)
   h. push = overlap / 2  (split evenly)
   i. Save prev positions for clamp reference:
        ax_prev = a.ref.x,  ay_prev = a.ref.y
        bx_prev = b.ref.x,  by_prev = b.ref.y
   j. Tentative new positions:
        a.ref.x -= nx * push,  a.ref.y -= ny * push
        b.ref.x += nx * push,  b.ref.y += ny * push
   k. Clamp each to walkable (R4, P3):
        {a.ref.x, a.ref.y} = clampToWalkable(ax_prev, ay_prev, a.ref.x, a.ref.y, dungeon)
        {b.ref.x, b.ref.y} = clampToWalkable(bx_prev, by_prev, b.ref.x, b.ref.y, dungeon)
```

**Helper:**
```typescript
function enemyRadius(typeId: EnemyTypeId): number {
  return typeId === 'spitter' ? ENEMY_RADIUS_SPITTER : ENEMY_RADIUS_SHAMBLER;
}
```

**Single-pass rationale:** one pass resolves most in-game scenarios (1–6 enemies per room,
moving independently). In extreme pile-ups, the next tick completes separation. Multiple
passes per tick add CPU cost O(n² × passes); unnecessary for this entity density.

**Determinism (P1):** iteration order is Map insertion order (stable in V8). Same map
contents → same iteration order → same result.

---

## Integration Point

Call `separateBodies` at the **end** of `tickEnemies`, after movement and attack resolution:

```typescript
// tick.ts — end of tickEnemies
separateBodies(players, enemies, dungeon);
```

---

## Client-Side: Dynamic Zoom + Shared Radii

In `src/client/src/game/GameScene.ts`:

```typescript
// Remove local const PLAYER_RADIUS = 12 — import from shared instead.
import { PLAYER_RADIUS, ENEMY_RADIUS_SHAMBLER, ENEMY_RADIUS_SPITTER,
         DESIGN_VIEW_HEIGHT, CORRIDOR_HALF_WIDTH, PROJECTILE_SPEED } from '@veins/shared';

// In create():
this.cameras.main.setZoom(this.scale.height / DESIGN_VIEW_HEIGHT);
this.scale.on('resize', (_gameSize: Phaser.Structs.Size) => {
  this.cameras.main.setZoom(this.scale.height / DESIGN_VIEW_HEIGHT);
});
```

Enemy rendering uses the shared radii as half the visual rectangle size:
```typescript
const size  = typeId === 'spitter' ? ENEMY_RADIUS_SPITTER * 2  : ENEMY_RADIUS_SHAMBLER * 2;
```
This keeps the render footprint equal to the server-side collision footprint — what you see
is what the server checks.

---

## Socket Events

No new events. Body separation is a server-side position adjustment; the next
`PLAYER_MOVED` / `ENEMY_MOVED` event already carries the corrected position.
