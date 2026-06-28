import {
  WEAPON_COOLDOWN_MS,
  PROJECTILE_SPEED,
  PROJECTILE_DAMAGE,
  PROJECTILE_HIT_RADIUS,
  PROJECTILE_MAX_RANGE,
  type ProjectileState,
} from '@testament/shared';
import type { Room } from '../room/state.js';
import type { PlayerId } from '@testament/shared';
import { evaluateRelicHit, DOT_DURATION_S } from '../relic/effects.js';
import { evaluateSynergies } from '../board/synergy.js';
import { isWalkable } from '../dungeon/collision.js';

export type HitResult =
  | { projectileId: string; hit: false }
  | {
      projectileId: string;
      hit: true;
      enemyId: string;
      newHp: number;
      splashHits: Array<{ enemyId: string; newHp: number }>;
      fireApplied: boolean;
      chainHit: { enemyId: string; newHp: number } | null;
    };

// Attempts to fire a projectile for the given player this tick.
// Decrements the weapon cooldown; if ready and the player has a valid aim,
// creates a projectile and resets the cooldown.
// Returns the new ProjectileState, or null if nothing was fired.
// No I/O — callers emit events.
export function tryAutoFire(
  room: Room,
  playerId: PlayerId,
  dt: number,
): ProjectileState | null {
  const ps = room.playerStates.get(playerId);
  if (!ps || ps.downed) return null;

  const cooldown = (room.weaponCooldowns.get(playerId) ?? 0) - dt * 1000;
  room.weaponCooldowns.set(playerId, cooldown);
  if (cooldown > 0) return null;

  // Hold-to-fire: a player who has opted out (desktop, not holding the mouse) does
  // not fire even when off cooldown. Absent/true = auto-fire (mobile + default), so
  // existing tests and mobile are unaffected. Cooldown still drained above, so the
  // first shot after pressing fires immediately.
  if (room.playerFiring?.get(playerId) === false) return null;

  // Resolve aim direction.
  const aim = room.aimStates.get(playerId);
  if (!aim) return null;

  let dx: number;
  let dy: number;

  if (aim.mode === 'auto') {
    if (!aim.targetId) return null;
    const enemy = room.enemies.get(aim.targetId);
    if (!enemy || !enemy.alive) return null;
    const ex = enemy.x - ps.x;
    const ey = enemy.y - ps.y;
    const mag = Math.sqrt(ex * ex + ey * ey);
    if (mag < 1e-6) return null;
    dx = ex / mag;
    dy = ey / mag;
  } else {
    dx = aim.dx;
    dy = aim.dy;
  }

  const id = `proj-${room.nextProjectileId++}`;
  const proj: ProjectileState = { id, ownerId: playerId, x: ps.x, y: ps.y, dx, dy, distanceTravelled: 0 };
  room.projectiles.set(id, proj);
  room.weaponCooldowns.set(playerId, WEAPON_COOLDOWN_MS);
  return proj;
}

// Advances all projectiles by dt seconds, checks enemy collisions, applies
// relic effects on hit, and returns hit results for event emission.
// Mutates enemy hp and room.fireDurations in place; never kills enemies
// (hp floor is 0 — death is handled by stepCombat's alive-check).
export function stepProjectiles(room: Room, dt: number): HitResult[] {
  const results: HitResult[] = [];
  const step = PROJECTILE_SPEED * dt;
  const synergyMap = evaluateSynergies(room.board, room.registry);

  for (const [id, proj] of room.projectiles) {
    proj.x += proj.dx * step;
    proj.y += proj.dy * step;
    proj.distanceTravelled += step;

    if (proj.distanceTravelled > PROJECTILE_MAX_RANGE) {
      room.projectiles.delete(id);
      results.push({ projectileId: id, hit: false });
      continue;
    }

    // Terminate on wall contact before checking enemy collision.
    if (room.dungeon && !isWalkable(proj.x, proj.y, room.dungeon)) {
      room.projectiles.delete(id);
      results.push({ projectileId: id, hit: false });
      continue;
    }

    let hit = false;
    for (const [eid, enemy] of room.enemies) {
      if (!enemy.alive) continue;
      const ex = proj.x - enemy.x;
      const ey = proj.y - enemy.y;
      const dist = Math.sqrt(ex * ex + ey * ey);
      if (dist <= PROJECTILE_HIT_RADIUS) {
        const fx = evaluateRelicHit({
          board: room.board,
          synergyMap,
          attackerId: proj.ownerId,
          baseDamage: PROJECTILE_DAMAGE,
          primaryEnemy: { id: eid, x: enemy.x, y: enemy.y, hp: enemy.hp },
          allEnemies: room.enemies,
          combatRng: room.combatRng,
          fireDurations: room.fireDurations,
        });

        enemy.hp = Math.max(0, enemy.hp - fx.primaryDamage);

        // Track last attacker for Tumor doctrine kill attribution.
        room.lastAttackerByEnemy?.set(eid, proj.ownerId);

        for (const splash of fx.splashHits) {
          const se = room.enemies.get(splash.enemyId);
          if (se) se.hp = splash.newHp;
        }
        if (fx.chainHit) {
          const ce = room.enemies.get(fx.chainHit.enemyId);
          if (ce) ce.hp = fx.chainHit.newHp;
        }
        if (fx.fireApplied) {
          room.fireDurations.set(eid, DOT_DURATION_S);
        }

        room.projectiles.delete(id);
        results.push({
          projectileId: id,
          hit: true,
          enemyId: eid,
          newHp: enemy.hp,
          splashHits: fx.splashHits,
          fireApplied: fx.fireApplied,
          chainHit: fx.chainHit,
        });
        hit = true;
        break;
      }
    }
    if (hit) continue;
  }

  return results;
}
