# Requirements — Relic Effects in Combat

Relics placed on the Circulatory Board must actively modify combat outcomes.
Base effects fire whenever the relic is placed; synergy effects fire only when
`synergyMap[relicId] === true`.

Out of scope (first pass): chain-link base (every 3rd free attack), ward-stone
base (adjacent-player proximity), all synergy effects except ember-core,
iron-skin synergy (floor-absorb), ward-stone synergy (party shield).

---

**R1**: All relic effect evaluation is server-side and pure (I1, I5).
- AC: A pure function `evaluateRelicHit` in `src/server/src/relic/effects.ts`
  takes board + synergyMap + registry + attack context and returns a
  `RelicHitResult` (primaryDamage, splashHits, fireApplied, chainHit).
- AC: A pure function `evaluateIncomingDamage` takes the same board state
  plus targetPlayerId + rawDamage and returns the reduced damage.
- AC: Neither function exists in `src/client/` or `src/shared/`.

**R2**: ember-core base — +`EMBER_BONUS` (5) flat damage per projectile hit.
- AC: When the attacker owns an ember-core slot with `relicId !== null`,
  `primaryDamage = PROJECTILE_DAMAGE + EMBER_BONUS`.
- AC: Without ember-core placed, damage equals `PROJECTILE_DAMAGE`.

**R3**: ember-core synergy — AoE splash when `synergyMap['ember-core'] === true`.
- AC: All other alive enemies within `EMBER_SPLASH_RANGE` (40 units) of the
  primary target receive `floor(primaryDamage × EMBER_SPLASH_RATIO)` (0.5) damage.
- AC: The primary target is not counted in the splash set.
- AC: Splash damage is applied and included in the returned `HitResult`
  so ENEMY_DAMAGED events are emitted for each splash target.

**R4**: torch-brand base — fire DoT on projectile hit.
- AC: When the attacker owns a torch-brand slot, a hit sets
  `room.fireDurations.set(enemyId, FIRE_DURATION_S)` (3 s).
  Existing duration is overwritten (no stack).
- AC: Each combat tick, each burning enemy takes
  `FIRE_DAMAGE_PER_SECOND × dt` damage; ENEMY_DAMAGED is emitted.
- AC: When `fireDurations[enemyId]` reaches 0, the entry is deleted;
  fire damage is no longer applied.
- AC: Enemies killed by fire appear in `newlyDeadEnemyIds` and trigger
  an ENEMY_DIED event.

**R5**: arc-bolt base — 20% chain on hit.
- AC: When the attacker owns an arc-bolt slot, each hit rolls
  `room.combatRng.float() < ARC_CHAIN_CHANCE` (0.2).
- AC: On success, the nearest OTHER alive enemy within `ARC_CHAIN_RANGE`
  (80 units) receives `floor(primaryDamage × ARC_CHAIN_RATIO)` (0.6) damage.
- AC: Chain damage is included in the returned `HitResult` as `chainHit`.
- AC: Chain hits do not trigger further chains or relic effects.

**R6**: iron-skin base — incoming damage reduced by `IRON_SKIN_REDUCTION` (5),
minimum 1.
- AC: When the attacked player owns an iron-skin slot, incoming enemy attack
  damage becomes `max(1, rawDamage - IRON_SKIN_REDUCTION)`.
- AC: Reduction is per-player; unaffected players receive full damage.

**R7**: `Room.fireDurations` and `Room.combatRng` lifecycle.
- AC: `createRoom` initialises `fireDurations: new Map()`.
- AC: `startRun` initialises `combatRng = createRng(hashSeed(\`\${runId}#combat\`))`.
- AC: `descendRoom` resets `fireDurations: new Map()` (fire does not persist
  across floors); `combatRng` is NOT reset (preserves sequence across floors).
