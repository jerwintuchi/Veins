import type { PlayerId, PlayerState, DungeonLayout } from '@testament/shared';
import { ENEMY_TYPES } from '@testament/shared';
import type { EnemyId, EnemyState, CombatEvent } from './types.js';
import { clampToWalkable } from '../dungeon/collision.js';
import { findNextWaypoint } from '../dungeon/pathfinding.js';

// --- Pure helpers ---

function euclidean(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

// Returns the nearest non-downed player, or null if none.
function findNearest(
  ex: number,
  ey: number,
  players: Map<PlayerId, PlayerState>
): { id: PlayerId; state: PlayerState } | null {
  let nearest: { id: PlayerId; state: PlayerState } | null = null;
  let minDist = Infinity;
  for (const [id, state] of players) {
    if (state.downed) continue;
    const d = euclidean(ex, ey, state.x, state.y);
    if (d < minDist) {
      minDist = d;
      nearest = { id, state };
    }
  }
  return nearest;
}

// Shallow-clone a Map<K, flat-object>. Safe for EnemyState/PlayerState whose
// fields are all primitives. If any field becomes a nested object, upgrade this.
function cloneMap<K, V extends object>(m: Map<K, V>): Map<K, V> {
  const out = new Map<K, V>();
  for (const [k, v] of m) out.set(k, { ...v });
  return out;
}

// --- T6: tickEnemies ---
// Pure AI tick. Does not mutate inputs. Same inputs -> same output (P2, R4).
// aggressionCooldownMult < 1 makes enemies attack faster (bleed stage 1+).
export function tickEnemies(
  enemies: Map<EnemyId, EnemyState>,
  players: Map<PlayerId, PlayerState>,
  dungeon: DungeonLayout,
  dt: number,
  aggressionCooldownMult = 1,
): { enemies: Map<EnemyId, EnemyState>; events: CombatEvent[] } {
  const nextEnemies = cloneMap(enemies);
  const events: CombatEvent[] = [];

  for (const enemy of nextEnemies.values()) {
    if (!enemy.alive) continue;

    const def = ENEMY_TYPES[enemy.typeId];

    // Cooldown drains every tick, even when idle. Compare the pre-clamp value to
    // decide attack readiness — floating-point subtraction may leave a tiny
    // positive residual (e.g. 2.7e-17) that Math.max(0, ...) preserves intact,
    // making a strict === 0 check permanently fail after the first attack.
    const drainedCooldown = enemy.attackCooldownRemaining - dt;
    enemy.attackCooldownRemaining = Math.max(0, drainedCooldown);

    const nearest = findNearest(enemy.x, enemy.y, players);
    if (nearest === null) continue; // no active players — idle

    const dist = euclidean(enemy.x, enemy.y, nearest.state.x, nearest.state.y);

    if (dist > def.detectionRange) continue; // outside detection range — idle

    if (dist <= def.attackRange) {
      // In attack range: don't move, attempt attack if cooldown expired.
      if (drainedCooldown <= 0) {
        events.push({ kind: 'attack', enemyId: enemy.id, targetId: nearest.id, damage: enemy.damage });
        enemy.attackCooldownRemaining = def.attackCooldown * aggressionCooldownMult;
      }
    } else {
      // In detection range but outside attack range: A* toward player, wall-clamped.
      const step = Math.min(def.speed * dt, dist - def.attackRange);
      const waypoint = findNextWaypoint(enemy.x, enemy.y, nearest.state.x, nearest.state.y, dungeon);
      // Fall back to direct chase if pathfinding returns null (unreachable, or same tile).
      const tx = (waypoint ?? nearest.state).x;
      const ty = (waypoint ?? nearest.state).y;
      const wdx = tx - enemy.x;
      const wdy = ty - enemy.y;
      const wdist = Math.sqrt(wdx * wdx + wdy * wdy);
      if (wdist > 0.001) {
        const nx = enemy.x + (wdx / wdist) * step;
        const ny = enemy.y + (wdy / wdist) * step;
        const clamped = clampToWalkable(enemy.x, enemy.y, nx, ny, dungeon);
        enemy.x = clamped.x;
        enemy.y = clamped.y;
      }
    }
  }

  // Mark enemies dead when hp has been reduced to 0 (by projectile hits applied
  // to room.enemies before tickEnemies clones them). Weapon spec R6, P4.
  for (const enemy of nextEnemies.values()) {
    if (enemy.alive && enemy.hp <= 0) enemy.alive = false;
  }

  return { enemies: nextEnemies, events };
}

// --- T7: applyEnemyAttacks ---
// Pure: applies CombatEvents to player HP. Returns new map + wipe flag.
export function applyEnemyAttacks(
  players: Map<PlayerId, PlayerState>,
  combatEvents: CombatEvent[]
): { players: Map<PlayerId, PlayerState>; wiped: boolean } {
  const next = cloneMap(players);

  for (const ev of combatEvents) {
    const player = next.get(ev.targetId);
    if (!player || player.downed) continue; // skip already-downed players
    player.hp = Math.max(0, player.hp - ev.damage);
    if (player.hp === 0) player.downed = true;
  }

  const wiped = next.size > 0 && [...next.values()].every(p => p.downed);
  return { players: next, wiped };
}

// --- T8: allEnemiesDead ---
// Vacuously true for an empty map (no enemies = floor clear).
export function allEnemiesDead(enemies: Map<EnemyId, EnemyState>): boolean {
  for (const enemy of enemies.values()) {
    if (enemy.alive) return false;
  }
  return true;
}
