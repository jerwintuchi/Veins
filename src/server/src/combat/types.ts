// Server-only enemy combat types. Never sent to clients directly (I1).
// Clients receive delta events (ENEMY_SPAWNED, ENEMY_DAMAGED, etc.) instead.
import type { EnemyTypeId } from '@testament/shared';
import type { PlayerId } from '@testament/shared';

export type EnemyId = string;

export type EnemyState = {
  id: EnemyId;
  typeId: EnemyTypeId;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  attackCooldownRemaining: number; // seconds until next attack is allowed; 0 = ready
  damage: number; // per-instance, scaled by floor depth in spawnEnemies
};

// A resolved attack from enemy AI tick: drives HP deduction and event emission.
export type CombatEvent = {
  kind: 'attack';
  enemyId: EnemyId;
  targetId: PlayerId;
  damage: number;
};
