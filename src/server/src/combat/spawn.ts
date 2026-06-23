import type { DungeonLayout } from '@veins/shared';
import { ENEMY_TYPES } from '@veins/shared';
import { hashSeed, createRng, type Rng } from '../rng/seeded.js';
import type { EnemyId, EnemyState } from './types.js';

const SPAWN_PADDING = 8;

// R1: enemy count range scales with floor depth (capped at extra=2).
function countRange(floor: number): { min: number; max: number } {
  const extra = Math.min(Math.floor((floor - 1) / 2), 2);
  return { min: 1 + extra, max: 2 + extra };
}

// R2: spitter probability increases with floor, capped at 70%.
function pickEnemyType(floor: number, rng: Rng): 'shambler' | 'spitter' {
  const spitterProb = Math.min(0.7, 0.15 + 0.1 * (floor - 1));
  return rng.float() < spitterProb ? 'spitter' : 'shambler';
}

// HP and damage scale up with floor depth so deeper runs feel meaningfully harder.
// Floor 1 = ×1.0, Floor 3 = ×1.4, Floor 5 = ×1.8.
function floorHpMultiplier(floor: number): number  { return 1 + 0.2 * (floor - 1); }
function floorDmgMultiplier(floor: number): number { return 1 + 0.15 * (floor - 1); }

// R3: elite multipliers applied on top of floor multipliers.
const ELITE_HP_MULT  = 2.0;
const ELITE_DMG_MULT = 1.5;

// Pure, server-only (I1, I3). Same (runId, floor, dungeon) always yields the
// same enemy map. Seed is distinct from the dungeon layout seed (runId#floor),
// so spawns and geometry are independently reproducible without collision.
export function spawnEnemies(
  runId: string,
  floor: number,
  dungeon: DungeonLayout,
  rng: Rng = createRng(hashSeed(`${runId}#${floor}#spawn`))
): Map<EnemyId, EnemyState> {
  const result = new Map<EnemyId, EnemyState>();

  // Skip room-0 (entry room). R4: room-0 never spawns enemies.
  const spawnRooms = dungeon.rooms.slice(1);
  if (spawnRooms.length === 0) return result;

  // R3: last room in BSP traversal order is the elite room.
  const eliteRoom = dungeon.rooms[dungeon.rooms.length - 1]!;

  const { min, max } = countRange(floor);
  const hpMult  = floorHpMultiplier(floor);
  const dmgMult = floorDmgMultiplier(floor);

  for (const room of spawnRooms) {
    const isElite = room === eliteRoom;
    const count = rng.int(min, isElite ? max + 1 : max);

    for (let i = 0; i < count; i++) {
      const typeId = pickEnemyType(floor, rng);
      const def = ENEMY_TYPES[typeId];
      const id: EnemyId = `${runId}-${floor}-${room.id}-${i}`;

      const xMin = room.rect.x + SPAWN_PADDING;
      const xMax = room.rect.x + room.rect.width - SPAWN_PADDING;
      const yMin = room.rect.y + SPAWN_PADDING;
      const yMax = room.rect.y + room.rect.height - SPAWN_PADDING;

      const x = rng.int(xMin, xMax);
      const y = rng.int(yMin, yMax);

      const totalHpMult  = hpMult  * (isElite ? ELITE_HP_MULT  : 1.0);
      const totalDmgMult = dmgMult * (isElite ? ELITE_DMG_MULT : 1.0);
      const scaledHp  = Math.round(def.baseHp * totalHpMult);
      const scaledDmg = Math.round(def.damage  * totalDmgMult);

      result.set(id, {
        id,
        typeId,
        x,
        y,
        hp:     scaledHp,
        maxHp:  scaledHp,
        damage: scaledDmg,
        alive: true,
        attackCooldownRemaining: 0,
      });
    }
  }

  return result;
}
