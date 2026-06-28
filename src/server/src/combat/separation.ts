import type { DungeonLayout, PlayerId } from '@testament/shared';
import type { PlayerState } from '@testament/shared';
import {
  PLAYER_RADIUS,
  ENEMY_RADIUS_SHAMBLER,
  ENEMY_RADIUS_SPITTER,
  type EnemyTypeId,
} from '@testament/shared';
import type { EnemyId, EnemyState } from './types.js';
import { clampToWalkable } from '../dungeon/collision.js';

function enemyRadius(typeId: EnemyTypeId): number {
  return typeId === 'spitter' ? ENEMY_RADIUS_SPITTER : ENEMY_RADIUS_SHAMBLER;
}

type Body = {
  ref: { x: number; y: number };
  radius: number;
  isPlayer: boolean;
};

// Single-pass body separation. Mutates .x and .y on PlayerState / EnemyState.
// Called at the end of tickEnemies, after movement and attack resolution.
export function separateBodies(
  players: Map<PlayerId, PlayerState>,
  enemies: Map<EnemyId, EnemyState>,
  dungeon: DungeonLayout,
): void {
  const bodies: Body[] = [];

  for (const p of players.values()) {
    bodies.push({ ref: p, radius: PLAYER_RADIUS, isPlayer: true });
  }
  for (const e of enemies.values()) {
    // Skip corpses. Dead enemies linger in room.enemies (alive: false) until the
    // floor ends, but the client deletes their sprite on ENEMY_DIED. Separating
    // against them would shove players around an invisible body — every other
    // consumer (tickEnemies, stepProjectiles, ENEMY_MOVED) already guards on alive.
    if (!e.alive) continue;
    bodies.push({ ref: e, radius: enemyRadius(e.typeId), isPlayer: false });
  }

  const n = bodies.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = bodies[i]!;
      const b = bodies[j]!;

      if (a.isPlayer && b.isPlayer) continue; // R3: teammates pass through

      const dx = b.ref.x - a.ref.x;
      const dy = b.ref.y - a.ref.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = a.radius + b.radius;

      if (dist >= minDist) continue; // no overlap

      const overlap = minDist - dist;

      // Unit vector from a toward b. Fall back to +x axis for coincident entities.
      const nx = dist < 0.001 ? 1 : dx / dist;
      const ny = dist < 0.001 ? 0 : dy / dist;
      const push = overlap / 2;

      const ax0 = a.ref.x;
      const ay0 = a.ref.y;
      const bx0 = b.ref.x;
      const by0 = b.ref.y;

      a.ref.x -= nx * push;
      a.ref.y -= ny * push;
      b.ref.x += nx * push;
      b.ref.y += ny * push;

      // Clamp each entity back to walkable space (R4, P3).
      const ac = clampToWalkable(ax0, ay0, a.ref.x, a.ref.y, dungeon);
      a.ref.x = ac.x;
      a.ref.y = ac.y;

      const bc = clampToWalkable(bx0, by0, b.ref.x, b.ref.y, dungeon);
      b.ref.x = bc.x;
      b.ref.y = bc.y;
    }
  }
}
