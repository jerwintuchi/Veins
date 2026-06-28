# Tasks — Relic Effects in Combat

---

- [x] T1 [R1, R2, R3, R5, R6] — Implement `evaluateRelicHit` and
  `evaluateIncomingDamage` pure functions in
  `src/server/src/relic/effects.ts`.
  Test: `src/server/src/relic/effects.test.ts` (new)
  - no ember-core: primaryDamage === PROJECTILE_DAMAGE
  - ember-core placed: primaryDamage === PROJECTILE_DAMAGE + EMBER_BONUS
  - ember-core synergy: splashHits populated for nearby enemies
  - torch-brand placed: fireApplied === true
  - arc-bolt placed + rng < 0.2: chainHit populated for nearest target
  - arc-bolt placed + rng ≥ 0.2: chainHit is null
  - iron-skin: incoming damage reduced by IRON_SKIN_REDUCTION (min 1)
  - no iron-skin: incoming damage unchanged

- [x] T2 [R4, R7] — Add `fireDurations` and `combatRng` to Room state;
  initialise in `createRoom`, `startRun`, and reset `fireDurations` in
  `descendRoom`.
  Test: `src/server/src/room/manager.test.ts` (extended)
  - `createRoom` has `fireDurations: new Map()`
  - `startRun` sets `combatRng` (not null/undefined)
  - `descendRoom` resets `fireDurations` to empty Map

- [x] T3 [R2, R3, R4, R5] — Wire `evaluateRelicHit` into `stepProjectiles`;
  extend `HitResult` type; apply splash/chain/fire mutations.
  Test: `src/server/src/combat/weapon.test.ts` (extended)
  - with ember-core placed: hit carries primaryDamage = base + EMBER_BONUS
  - with ember-core synergy: splashHits is non-empty when enemy in range
  - with torch-brand: fireApplied === true; fireDurations updated on room
  - with arc-bolt + forced chain: chainHit is populated; enemy hp reduced

- [x] T4 [R4, R6] — Wire fire DoT tick and incoming damage reduction into
  `stepCombat`; extend `CombatStepResult`.
  Test: `src/server/src/combat/roomCombat.test.ts` (extended)
  - burning enemy takes fire damage each tick; fireDamagedEnemies populated
  - fire-killed enemy appears in newlyDeadEnemyIds
  - fire duration decrements to 0 and entry deleted
  - iron-skin reduces player incoming damage (min 1)

- [x] T5 [R3, R4, R5] — Emit ENEMY_DAMAGED for splash, chain, and fire DoT
  hits in `runCombatTick` (`src/server/src/index.ts`).
  Test: `src/server/src/index.test.ts` (extended)
  - ENEMY_DAMAGED emitted for splash targets
  - ENEMY_DAMAGED emitted for chain hit
  - ENEMY_DAMAGED emitted for fire DoT tick
  - ENEMY_DIED emitted for fire-killed enemy
