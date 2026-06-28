# Design — Enemy System + Combat

## Data Models

### Shared types (`src/shared/src/combat.ts`)

```typescript
// Enemy type definitions — constants only; no logic (I4).
type EnemyTypeId = 'shambler' | 'spitter';

type EnemyTypeDef = {
  typeId:           EnemyTypeId;
  baseHp:           number;   // hit points at spawn
  damage:           number;   // HP removed per attack
  speed:            number;   // world units per second
  detectionRange:   number;   // radius within which enemy notices a player
  attackRange:      number;   // radius within which enemy can attack
  attackCooldown:   number;   // seconds between attacks
};

// Shambler: slow melee bruiser.
// Spitter: faster, attacks from range.
// Concrete stat values are constants in the same file so tests import them directly.
const SHAMBLER_DEF: EnemyTypeDef = {
  typeId: 'shambler', baseHp: 60, damage: 15,
  speed: 60, detectionRange: 200, attackRange: 40, attackCooldown: 1.2,
};
const SPITTER_DEF: EnemyTypeDef = {
  typeId: 'spitter', baseHp: 30, damage: 10,
  speed: 90, detectionRange: 300, attackRange: 150, attackCooldown: 0.9,
};
const ENEMY_TYPES: Record<EnemyTypeId, EnemyTypeDef> = {
  shambler: SHAMBLER_DEF,
  spitter: SPITTER_DEF,
};

// Player combat state — types only.
type PlayerState = {
  hp:     number;
  maxHp:  number;
  downed: boolean;
  // World-space position (separate from rendering; server tracks for collision).
  x: number;
  y: number;
};

const PLAYER_MAX_HP = 100;  // baseline; balance tuning belongs to a future pass
```

### Shared events (`src/shared/src/events.ts`) — new additions

```typescript
type EnemySpawnedEvent  = { enemyId: EnemyId; typeId: EnemyTypeId; x: number; y: number; hp: number };
type EnemyDamagedEvent  = { enemyId: EnemyId; hp: number };
type EnemyDiedEvent     = { enemyId: EnemyId };
type PlayerDamagedEvent = { playerId: PlayerId; hp: number };
type PlayerDownedEvent  = { playerId: PlayerId };
type PlayerRevivedEvent = { playerId: PlayerId; hp: number };
type PlayerMovedEvent   = { playerId: PlayerId; x: number; y: number };
type PhaseChangedEvent  = { phase: GamePhase };
```

`EnemyId` is `string` (UUID assigned at spawn, server-side). `GamePhase` is the
existing `'loot' | 'combat' | 'transition'` union already in shared.

### Server-only enemy state (`src/server/src/combat/types.ts`)

```typescript
type EnemyId = string;

type EnemyState = {
  id:                     EnemyId;
  typeId:                 EnemyTypeId;
  x:                      number;
  y:                      number;
  hp:                     number;
  maxHp:                  number;
  alive:                  boolean;
  attackCooldownRemaining: number;  // seconds until next attack is allowed; 0 = ready
};

// A resolved attack from enemy AI tick — drives HP deduction downstream.
type CombatEvent = {
  kind:      'attack';
  enemyId:   EnemyId;
  targetId:  PlayerId;
  damage:    number;
};
```

### Room additions (`src/server/src/room/state.ts`)

```typescript
// Added to Room:
enemies:      Map<EnemyId, EnemyState>;
playerStates: Map<PlayerId, PlayerState>;
```

`Room.players` (`PlayerId[]`) continues to hold the ordered player list; `playerStates`
maps each PlayerId to their live combat stats (HP, position, downed flag).

---

## Algorithms

### Enemy spawning (`src/server/src/combat/spawn.ts`)

```
spawnEnemies(runId, floor, dungeon, rng?): Map<EnemyId, EnemyState>
  rng = rng ?? createRng(hashSeed(`${runId}#${floor}#spawn`))
  result = new Map()
  for each room in dungeon.rooms (excluding the first, which is the entry room):
    count = rngIntInRange(rng, 1, 3)          // 1–2 enemies per room
    for i in [0, count):
      typeId = rngPick(rng, ['shambler','spitter'])
      def    = ENEMY_TYPES[typeId]
      id     = `${runId}-${floor}-${room.id}-${i}`  // deterministic, no UUID needed
      x      = rngIntInRange(rng, room.x + 8, room.x + room.width  - 8)
      y      = rngIntInRange(rng, room.y + 8, room.y + room.height - 8)
      result.set(id, {
        id, typeId, x, y, hp: def.baseHp, maxHp: def.baseHp,
        alive: true, attackCooldownRemaining: 0,
      })
  return result
```

The RNG seed `${runId}#${floor}#spawn` is distinct from the dungeon layout seed
(`${runId}#${floor}`) so spawns and geometry are independently reproducible but never
collide. No `Math.random()` is used (I3).

### AI tick (`src/server/src/combat/tick.ts`)

Pure function; does not mutate inputs.

```
tickEnemies(
  enemies:  Map<EnemyId, EnemyState>,
  players:  Map<PlayerId, PlayerState>,
  dungeon:  DungeonLayout,
  dt:       number,    // seconds elapsed since last tick
): { enemies: Map<EnemyId, EnemyState>; events: CombatEvent[] }

  nextEnemies = deep-clone enemies
  events      = []
  activePlayers = filter players where downed === false

  for each enemy in nextEnemies.values() where enemy.alive:
    def = ENEMY_TYPES[enemy.typeId]

    // Cooldown drain (always, even when idle).
    enemy.attackCooldownRemaining = max(0, enemy.attackCooldownRemaining - dt)

    nearest = findNearest(enemy, activePlayers)   // null if no active players
    if nearest is null: continue                   // idle

    dist = euclidean(enemy, nearest.position)

    if dist > def.detectionRange: continue         // out of detection range, idle

    if dist <= def.attackRange:
      // In attack range: do NOT move; attempt attack.
      if enemy.attackCooldownRemaining === 0:
        events.push({ kind: 'attack', enemyId: enemy.id,
                      targetId: nearest.id, damage: def.damage })
        enemy.attackCooldownRemaining = def.attackCooldown
    else:
      // In detection range but not in attack range: move toward nearest.
      direction = normalize(nearest.position - enemy.position)
      step      = min(def.speed * dt, dist - def.attackRange)   // stop at attack range
      enemy.x  += direction.x * step
      enemy.y  += direction.y * step
      // No wall/corridor collision in this spec; collision is a follow-up.

  return { enemies: nextEnemies, events }
```

`findNearest` is a pure helper: linear scan of `activePlayers`, Euclidean distance.
Returns `null` if the map is empty.

### Attack application (`src/server/src/combat/tick.ts`)

```
applyEnemyAttacks(
  players:      Map<PlayerId, PlayerState>,
  combatEvents: CombatEvent[],
): { players: Map<PlayerId, PlayerState>; wiped: boolean }

  next = deep-clone players
  for each event in combatEvents:
    player = next.get(event.targetId)
    if player is undefined or player.downed: continue  // already downed, skip
    player.hp = max(0, player.hp - event.damage)
    if player.hp === 0:
      player.downed = true

  wiped = every player in next.values() has downed === true
  return { players: next, wiped }
```

### Combat->loot transition check (`src/server/src/combat/tick.ts`)

```
allEnemiesDead(enemies: Map<EnemyId, EnemyState>): boolean
  return every enemy in enemies.values() has alive === false
```

Called after the room's enemy map is updated. If true, the server sets
`room.phase = 'loot'` and broadcasts `PHASE_CHANGED`.

### Player movement (`src/server/src/combat/movement.ts`)

```
movePlayer(
  playerState: PlayerState,
  dx: number, dy: number,
  dt: number,
  dungeon: DungeonLayout,
  speed: number = PLAYER_SPEED,
): PlayerState

  mag = sqrt(dx*dx + dy*dy)
  if mag === 0: return playerState   // no-op

  nx = playerState.x + (dx / mag) * speed * dt
  ny = playerState.y + (dy / mag) * speed * dt
  nx = clamp(nx, 0, dungeon.width)
  ny = clamp(ny, 0, dungeon.height)
  return { ...playerState, x: nx, y: ny }
```

`PLAYER_SPEED` is a shared constant (units/sec). Directional vector is normalized
before scaling so diagonal movement is not faster. Bounds clamp uses dungeon
width/height; per-room wall collision is a follow-up (flagged in open threads).

### Wipe check integration in room tick (`src/server/src/combat/roomCombat.ts`)

```
stepCombat(room, dt): CombatStepResult
  if room.status !== 'in-progress' or room.phase !== 'combat':
    return { ok: false }

  { enemies, events } = tickEnemies(room.enemies, room.playerStates, room.dungeon, dt)
  { players, wiped }  = applyEnemyAttacks(room.playerStates, events)

  room.enemies      = enemies
  room.playerStates = players

  if wiped:
    room.status  = 'ended'
    room.outcome = 'wiped'
    return { ok: true, wiped: true, events, players }

  phaseChanged = false
  if allEnemiesDead(room.enemies):
    room.phase   = 'loot'
    phaseChanged = true

  return { ok: true, wiped: false, events, players, phaseChanged }
```

`stepCombat` is the single mutation point in the combat loop. The Socket.io tick
driver calls it and then fans out delta events.

---

## Correctness Properties

**P1 (Deterministic spawn)**: `spawnEnemies(runId, floor, dungeon)` is a pure function.
Same inputs always produce a deeply-equal enemy map.

**P2 (Deterministic tick)**: `tickEnemies` is a pure function. Same inputs always
produce the same output. No randomness in AI movement or attack resolution.

**P3 (Server authority)**: Enemy positions, HP, and attack resolution exist only in
`src/server/`. No client message can inject or modify enemy state (I1, I2).

**P4 (Delta only)**: After initial sync, each enemy state change is communicated via
exactly one targeted delta event. No full room state is rebroadcast per tick (I6).

**P5 (Wipe terminal)**: Once `room.outcome === 'wiped'`, `stepCombat` returns
`{ ok: false }` and mutates nothing. Mirrors the "terminal once" property from
Bleed Clock.

**P6 (Phase gate)**: The `revive` (Linked Fates) handler returns an error and
mutates nothing if `room.phase !== 'combat'`.

**P7 (Combat-only ticking)**: The AI tick interval runs only while `room.phase === 'combat'`
and `room.status === 'in-progress'`. Loot/transition phases do not accumulate AI cost.

---

## Socket.io Events

**ENEMY_SPAWNED** (server to client): `{ enemyId: string; typeId: EnemyTypeId; x: number; y: number; hp: number }`
Emitted once per enemy when enemies are spawned on floor entry. All players in the
room receive it.

**ENEMY_DAMAGED** (server to client): `{ enemyId: string; hp: number }`
Emitted when an enemy takes damage (HP decreases). Sent to the room.

**ENEMY_DIED** (server to client): `{ enemyId: string }`
Emitted when an enemy's HP reaches 0. `alive` is `false` on the server at this point.
Sent to the room.

**PLAYER_DAMAGED** (server to client): `{ playerId: string; hp: number }`
Emitted when a player takes damage. Carries new HP. Sent to the room.

**PLAYER_DOWNED** (server to client): `{ playerId: string }`
Emitted when a player's HP reaches 0. Sent to the room.

**PLAYER_REVIVED** (server to client): `{ playerId: string; hp: number }`
Emitted after a successful Linked Fates revive. Carries restored HP. Sent to the room.

**PLAYER_MOVED** (server to client): `{ playerId: string; x: number; y: number }`
Emitted after a valid `move-player` intention is processed. Sent to the room (all
players see all movement, enabling the shared-viewport use case).

**PHASE_CHANGED** (server to client): `{ phase: GamePhase }`
Emitted when phase transitions (combat to loot on last-enemy-kill). Sent to the room.
Delta only; no full room state.

**move-player** (client to server): `{ dx: number; dy: number }`
Client intention: direction vector (un-normalized; server normalizes). No `dt` from
client (server uses its own tick timestamp). Validated before use.

---

## Open Threads (not in this spec)

- Per-room wall collision for enemy and player movement (current bounds-clamp is
  correct but simplistic; enemies walk through walls until collision is specced).
- Relic synergy damage effects (requires this combat system; note for the synergy-
  effects spec).
- Loot drops on enemy death (for the loot spec).
- Player attack input (for the weapon/attack spec; auto-aim targeting also goes
  there; this spec only tracks enemy positions the client uses to render auto-aim).
- Enemy HP deduction from player attacks flows naturally here once the attack spec
  is written (hook point: `ENEMY_DAMAGED` / `ENEMY_DIED` events already defined).

---

## Satisfies Requirements

R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, R12
