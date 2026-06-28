# Design — Relic Effects in Combat

## Constants (`src/server/src/relic/effects.ts`)

```typescript
export const EMBER_BONUS          = 5;
export const EMBER_SPLASH_RANGE   = 40;
export const EMBER_SPLASH_RATIO   = 0.5;
export const FIRE_DURATION_S      = 3;
export const FIRE_DAMAGE_PER_SECOND = 3;
export const ARC_CHAIN_CHANCE     = 0.2;
export const ARC_CHAIN_RANGE      = 80;
export const ARC_CHAIN_RATIO      = 0.6;
export const IRON_SKIN_REDUCTION  = 5;
```

## `evaluateRelicHit`

```typescript
export type RelicHitResult = {
  primaryDamage: number;
  splashHits: Array<{ enemyId: string; newHp: number }>;
  fireApplied: boolean;
  chainHit: { enemyId: string; newHp: number } | null;
};

export function evaluateRelicHit(params: {
  board: RelicBoard;
  synergyMap: SynergyMap;
  registry: Map<RelicId, Relic>;
  attackerId: PlayerId;
  baseDamage: number;
  primaryEnemy: { id: string; x: number; y: number; hp: number };
  allEnemies: Map<string, EnemyState>;
  combatRng: Rng;
}): RelicHitResult
```

Algorithm:
1. Collect `attackerRelicIds` — all relicIds in slots owned by `attackerId` where `relicId !== null`.
2. `primaryDamage = baseDamage`.
   - If `attackerRelicIds` includes `'ember-core'`: `primaryDamage += EMBER_BONUS`.
3. Compute `primaryEnemyNewHp = max(0, primaryEnemy.hp - primaryDamage)`.
4. **Splash** (ember-core synergy):
   - If `synergyMap['ember-core'] === true` and `'ember-core'` in attackerRelicIds:
     - For each other alive enemy within `EMBER_SPLASH_RANGE` of primaryEnemy:
       - `splashDamage = floor(primaryDamage × EMBER_SPLASH_RATIO)`
       - Push `{ enemyId, newHp: max(0, enemy.hp - splashDamage) }` to splashHits.
5. **Fire** (torch-brand base):
   - If `'torch-brand'` in attackerRelicIds: `fireApplied = true`.
6. **Chain** (arc-bolt base):
   - If `'arc-bolt'` in attackerRelicIds and `combatRng.float() < ARC_CHAIN_CHANCE`:
     - Find nearest alive enemy (not primary, within `ARC_CHAIN_RANGE`).
     - If found: `chainDamage = floor(primaryDamage × ARC_CHAIN_RATIO)`;
       `chainHit = { enemyId, newHp: max(0, enemy.hp - chainDamage) }`.
7. Return `{ primaryDamage, splashHits, fireApplied, chainHit }`.

## `evaluateIncomingDamage`

```typescript
export function evaluateIncomingDamage(params: {
  board: RelicBoard;
  registry: Map<RelicId, Relic>;
  targetPlayerId: PlayerId;
  rawDamage: number;
}): number
```

Algorithm:
1. Collect `targetRelicIds` — relicIds in slots owned by `targetPlayerId`.
2. `reduced = rawDamage`.
   - If `'iron-skin'` in targetRelicIds: `reduced = max(1, rawDamage - IRON_SKIN_REDUCTION)`.
3. Return `reduced`.

Note: `synergyMap` is intentionally not a parameter for the base effect.
Iron-skin's synergy effect (floor-absorb shield) is deferred.

## Room state additions (`src/server/src/room/state.ts`)

```typescript
// Fire DoT durations, in seconds. Cleared on floor descend. (R4, R7)
fireDurations: Map<EnemyId, number>;
// Per-run seeded RNG for combat randomness (arc-bolt chain, etc.). (R5, R7)
combatRng: Rng;
```

`createRoom`: `fireDurations: new Map(), combatRng: createRng(0)` (placeholder; overwritten by startRun).
`startRun`: `room.combatRng = createRng(hashSeed(\`\${runId}#combat\`))`.
`descendRoom` (manager.ts): `room.fireDurations = new Map()`.

## Mutation in `stepProjectiles` (`src/server/src/combat/weapon.ts`)

Extend `HitResult` to carry relic effects:

```typescript
export type HitResult =
  | { projectileId: string; hit: false }
  | {
      projectileId: string; hit: true;
      enemyId: string; newHp: number;
      splashHits: Array<{ enemyId: string; newHp: number }>;
      fireApplied: boolean;
      chainHit: { enemyId: string; newHp: number } | null;
    };
```

When a hit is detected:
1. Call `evaluateRelicHit(...)`.
2. Set `enemy.hp = max(0, primaryEnemy.hp - primaryDamage)`.
3. Apply splash: for each splash target, `room.enemies.get(id)!.hp = splashHit.newHp`.
4. Apply chain: if `chainHit`, `room.enemies.get(id)!.hp = chainHit.newHp`.
5. Apply fire: if `fireApplied`, `room.fireDurations.set(enemyId, FIRE_DURATION_S)`.
6. Push extended HitResult.

## Fire DoT tick in `stepCombat` (`src/server/src/combat/roomCombat.ts`)

After `room.enemies = nextEnemies`:

```typescript
const fireDamagedEnemies: Array<{ enemyId: string; newHp: number }> = [];
for (const [enemyId, remaining] of [...room.fireDurations]) {
  const enemy = room.enemies.get(enemyId);
  if (!enemy?.alive) { room.fireDurations.delete(enemyId); continue; }
  const newRemaining = remaining - dt;
  if (newRemaining <= 0) room.fireDurations.delete(enemyId);
  else room.fireDurations.set(enemyId, newRemaining);
  const dmg = FIRE_DAMAGE_PER_SECOND * dt;
  const newHp = Math.max(0, enemy.hp - dmg);
  enemy.hp = newHp;
  if (newHp <= 0) { enemy.alive = false; newlyDeadEnemyIds.push(enemyId); }
  fireDamagedEnemies.push({ enemyId, newHp });
}
```

Extend `CombatStepResult` to include `fireDamagedEnemies`.

## Incoming damage reduction in `stepCombat`

Before `applyEnemyAttacks`, transform each event's damage:

```typescript
const reducedEvents = events.map(ev => ({
  ...ev,
  damage: evaluateIncomingDamage({
    board: room.board,
    registry: room.registry,
    targetPlayerId: ev.targetId,
    rawDamage: ev.damage,
  }),
}));
const { players, wiped } = applyEnemyAttacks(room.playerStates, reducedEvents);
```

## `runCombatTick` additions (`src/server/src/index.ts`)

After emitting `ENEMY_DAMAGED` for direct hits, also emit for:
- Each `result.splashHits` entry
- `result.chainHit` (if non-null)
- Each `res.fireDamagedEnemies` entry

ENEMY_DIED already fires from `res.newlyDeadEnemyIds` (which now includes fire kills).

---

## Satisfies Requirements

R1, R2, R3, R4, R5, R6, R7
