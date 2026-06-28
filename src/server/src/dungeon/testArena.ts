// Test-only arena. OFF by default; enabled with the env var VEINS_TEST_ARENA=1.
// Purpose: skip dungeon navigation while iterating on combat/loot. The run becomes
// a single open room seeded with exactly one enemy of each type, so clearing the
// floor (and reaching the loot phase) takes seconds. Production/the real game is
// untouched unless the flag is explicitly set — the manager only calls into here
// when isTestArenaEnabled() is true (see room/manager.ts).
import type { DungeonLayout } from '@veins/shared';
import { ENEMY_TYPES, type EnemyTypeId } from '@veins/shared';
import type { EnemyId, EnemyState } from '../combat/types.js';

// A single, generously-sized room — big enough to move and kite, no corridors.
const ARENA_WIDTH = 720;
const ARENA_HEIGHT = 500;

// One enemy of each type sits this far from the central player spawn so the fight
// doesn't start on top of the player (beyond the spitter's 150-unit attack range).
const ENEMY_SPAWN_DISTANCE = 200;

export function isTestArenaEnabled(): boolean {
  const v = process.env['VEINS_TEST_ARENA'];
  return v === '1' || v === 'true';
}

// Single-room layout. Shares the DungeonLayout shape, so every downstream system
// (collision, rendering, camera bounds) treats it exactly like a normal dungeon.
export function generateTestArenaDungeon(runId: string): DungeonLayout {
  return {
    runId,
    width: ARENA_WIDTH,
    height: ARENA_HEIGHT,
    rooms: [{ id: 'room-0', rect: { x: 0, y: 0, width: ARENA_WIDTH, height: ARENA_HEIGHT } }],
    corridors: [],
  };
}

// Exactly one enemy per type, fanned out in front of the central player spawn.
// Uses base (floor-1) stats — the point is fast iteration, not difficulty scaling.
export function spawnTestArenaEnemies(floor: number, dungeon: DungeonLayout): Map<EnemyId, EnemyState> {
  const result = new Map<EnemyId, EnemyState>();
  const room = dungeon.rooms[0];
  if (!room) return result;

  const cx = room.rect.x + room.rect.width / 2;
  const cy = room.rect.y + room.rect.height / 2;
  const types = Object.keys(ENEMY_TYPES) as EnemyTypeId[];

  types.forEach((typeId, i) => {
    const def = ENEMY_TYPES[typeId];
    // Spread the enemies across an arc above the player (avoids overlapping spawn).
    const angle = (Math.PI * (i + 1)) / (types.length + 1);
    const x = Math.round(cx + Math.cos(angle) * ENEMY_SPAWN_DISTANCE);
    const y = Math.round(cy - Math.sin(angle) * ENEMY_SPAWN_DISTANCE);
    const id: EnemyId = `arena-${floor}-${typeId}`;
    result.set(id, {
      id,
      typeId,
      x,
      y,
      hp: def.baseHp,
      maxHp: def.baseHp,
      damage: def.damage,
      alive: true,
      attackCooldownRemaining: 0,
    });
  });

  return result;
}
