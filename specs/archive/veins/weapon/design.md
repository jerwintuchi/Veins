# Design — Weapon / Attack System

## Data Models

### Shared additions (`src/shared/src/combat.ts`)

```typescript
export const WEAPON_COOLDOWN_MS   = 500;  // ms between shots per player
export const PROJECTILE_SPEED     = 400;  // world units / second
export const PROJECTILE_DAMAGE    = 20;
export const PROJECTILE_HIT_RADIUS = 20;  // units; circle around projectile centre
export const PROJECTILE_MAX_RANGE = 600;  // units before projectile expires

export type ProjectileState = {
  id:                 string;
  ownerId:            string; // PlayerId
  x:                  number;
  y:                  number;
  dx:                 number; // unit vector
  dy:                 number;
  distanceTravelled:  number;
};
```

### Shared events (`src/shared/src/events.ts`) — new

```typescript
export type ProjectileFiredEvent = {
  projectileId: string; playerId: string;
  x: number; y: number; dx: number; dy: number;
};

export type ProjectileRemovedEvent = {
  projectileId: string;
  reason: 'hit' | 'range';
};

export type EnemyMovedEvent = {
  enemyId: string; x: number; y: number;
};
```

### Room additions (`src/server/src/room/state.ts`)

```typescript
// Added to Room:
projectiles:      Map<string, ProjectileState>;  // active in-flight projectiles
weaponCooldowns:  Map<PlayerId, number>;          // ms remaining per player
playerMoveInputs: Map<PlayerId, { dx: number; dy: number }>; // latest joystick input
nextProjectileId: number;                         // monotonic counter for unique ids
```

All four initialised in `RoomManager.startRun`:
```typescript
room.projectiles      = new Map();
room.weaponCooldowns  = new Map(players.map(id => [id, 0]));  // fire immediately
room.playerMoveInputs = new Map(players.map(id => [id, { dx: 0, dy: 0 }]));
room.nextProjectileId = 0;
```

---

## Algorithms

### tryAutoFire (`src/server/src/combat/weapon.ts`)

```
function tryAutoFire(
  room: Room, playerId: PlayerId, dt: number
): ProjectileState | null

  ps = room.playerStates.get(playerId)
  if !ps or ps.downed: return null

  cooldown = (room.weaponCooldowns.get(playerId) ?? 0) - dt * 1000
  room.weaponCooldowns.set(playerId, cooldown)
  if cooldown > 0: return null

  // resolve aim direction
  aim = room.aimStates.get(playerId)
  dx, dy =
    if aim.mode === 'auto' and aim.targetId != null:
      enemy = room.enemies.get(aim.targetId)
      if !enemy or !enemy.alive: return null
      normalize(enemy.x - ps.x, enemy.y - ps.y)
    elif aim.mode === 'manual':
      (aim.dx, aim.dy)
    else:
      return null  // auto with no target

  id  = `proj-${room.nextProjectileId++}`
  proj = { id, ownerId: playerId, x: ps.x, y: ps.y, dx, dy, distanceTravelled: 0 }
  room.projectiles.set(id, proj)
  room.weaponCooldowns.set(playerId, WEAPON_COOLDOWN_MS)
  return proj
```

No I/O. Caller emits `PROJECTILE_FIRED`.

### stepProjectiles (`src/server/src/combat/weapon.ts`)

```
type HitResult = { projectileId: string; hit: true;  enemyId: string; newHp: number }
               | { projectileId: string; hit: false }

function stepProjectiles(room: Room, dt: number): HitResult[]

  results: HitResult[] = []
  for each (id, proj) in room.projectiles:
    step = PROJECTILE_SPEED * dt
    proj.x += proj.dx * step
    proj.y += proj.dy * step
    proj.distanceTravelled += step

    // range check
    if proj.distanceTravelled > PROJECTILE_MAX_RANGE:
      room.projectiles.delete(id)
      results.push({ projectileId: id, hit: false })
      continue

    // collision check — first alive enemy within HIT_RADIUS
    for each (eid, enemy) in room.enemies:
      if not enemy.alive: continue
      dist = euclidean(proj, enemy)
      if dist <= PROJECTILE_HIT_RADIUS:
        newHp = max(0, enemy.hp - PROJECTILE_DAMAGE)
        enemy.hp = newHp
        room.projectiles.delete(id)
        results.push({ projectileId: id, hit: true, enemyId: eid, newHp })
        break  // one hit per projectile

  return results
```

### runCombatTick additions (`src/server/src/index.ts`)

Insert into the existing `runCombatTick` body **in this order** (replacing the
current direct `movePlayer` call in the `move-player` handler):

```
1. Move players (using stored inputs):
   for each playerId in room.players:
     ps     = room.playerStates.get(playerId)
     inputs = room.playerMoveInputs.get(playerId) ?? { dx: 0, dy: 0 }
     if ps and room.dungeon:
       next = movePlayer(ps, inputs.dx, inputs.dy, dt, room.dungeon)
       room.playerStates.set(playerId, next)
       io.to(room.code).emit('PLAYER_MOVED', { playerId, x: next.x, y: next.y })

2. Auto-fire:
   for each playerId in room.players:
     proj = tryAutoFire(room, playerId, dt)
     if proj:
       io.to(room.code).emit('PROJECTILE_FIRED', { projectileId: proj.id, playerId, x: proj.x, y: proj.y, dx: proj.dx, dy: proj.dy })

3. Step projectiles:
   hits = stepProjectiles(room, dt)
   for each result in hits:
     io.to(room.code).emit('PROJECTILE_REMOVED', { projectileId: result.projectileId, reason: result.hit ? 'hit' : 'range' })
     if result.hit:
       io.to(room.code).emit('ENEMY_DAMAGED', { enemyId: result.enemyId, hp: result.newHp })

4. stepCombat (existing enemy AI + attack resolution):
   { events, nextEnemies } = stepCombat(room, dt)
   room.enemies = nextEnemies
   // ... existing ENEMY_DIED, PHASE_CHANGED, PLAYER_ATTACKED handling ...

5. ENEMY_MOVED (new — after stepCombat):
   for each (eid, enemy) in room.enemies:
     if enemy.alive:
       io.to(room.code).emit('ENEMY_MOVED', { enemyId: eid, x: enemy.x, y: enemy.y })

6. Auto-aim refresh (existing):
   for each (playerId, aimState) in room.aimStates where mode === 'auto': ...
```

### move-player handler change

Replace the current handler body with:

```
socket.on('move-player', (payload)):
  room = currentRoom(); if !room → error
  { dx, dy } = validate payload
  room.playerMoveInputs.set(playerId, { dx, dy })
  // No immediate movement; tick handles it.
```

Remove the `movePlayer` call and the `PLAYER_MOVED` emit from this handler.

### Client: GameScene additions

```typescript
// New map field:
private projectiles = new Map<string, Phaser.GameObjects.Arc>();

spawnProjectile(id: string, x: number, y: number): void {
  const dot = this.add.circle(x, y, 4, 0xffffff).setDepth(6);
  this.projectiles.set(id, dot);
}

removeProjectile(id: string): void {
  this.projectiles.get(id)?.destroy();
  this.projectiles.delete(id);
}

moveEnemy(id: string, x: number, y: number): void {
  const container = this.enemies.get(id);
  if (!container) return;
  const { rect, hpBg, hpFill } = container;
  rect.setPosition(x, y);
  hpBg.setPosition(x, y - HP_BAR_OFFSET);
  hpFill.setX(x - HP_BAR_W / 2);
}
```

Socket wiring (in `bindSocketEvents`):
```typescript
socket.on('PROJECTILE_FIRED',   ({ projectileId, x, y }) => this.spawnProjectile(projectileId, x, y));
socket.on('PROJECTILE_REMOVED', ({ projectileId })        => this.removeProjectile(projectileId));
socket.on('ENEMY_MOVED',        ({ enemyId, x, y })       => this.moveEnemy(enemyId, x, y));
```

---

## Correctness Properties

**P1 (No client fire input)**: Clients cannot trigger a projectile. There is no
`fire-weapon` socket event. The server fires automatically based on its own
cooldown counter. Clients only supply direction (via `aim-player`).

**P2 (Fixed player movement rate)**: Moving `move-player` input to a stored
direction means a client flooding the socket cannot move faster than
`PLAYER_SPEED × COMBAT_TICK_MS/1000` units per tick. Resolves the documented exploit.

**P3 (One hit per projectile)**: `stepProjectiles` breaks after the first hit; a
single projectile cannot damage multiple enemies.

**P4 (No negative HP)**: `newHp = max(0, enemy.hp - PROJECTILE_DAMAGE)`. Enemy
death is handled by `stepCombat` checking `hp <= 0`.

**P5 (Delta only)**: `PROJECTILE_FIRED` / `PROJECTILE_REMOVED` / `ENEMY_MOVED`
are all delta events. No full-state resync.

---

## Socket Events Summary

| Event | Direction | Payload |
|---|---|---|
| `PROJECTILE_FIRED` | server → room | `{ projectileId, playerId, x, y, dx, dy }` |
| `PROJECTILE_REMOVED` | server → room | `{ projectileId, reason }` |
| `ENEMY_MOVED` | server → room | `{ enemyId, x, y }` |

---

## Satisfies Requirements

R1, R2, R3, R4, R5, R6, R7, R8, R9
