import type { RunEndedEvent } from '@testament/shared';
import { tickEnemies, applyEnemyAttacks, allEnemiesDead } from './tick.js';
import { separateBodies } from './separation.js';
import type { CombatEvent } from './types.js';
import type { Room } from '../room/state.js';
import { bleedStageOf, AGGRESSION_COOLDOWN_MULT } from '../room/state.js';
import { evaluateIncomingDamage, DOT_DAMAGE_PER_SECOND } from '../relic/effects.js';
import { evaluateSynergies } from '../board/synergy.js';

export type CombatStepResult =
  | { ok: false }
  | {
      ok: true;
      wiped: boolean;
      events: CombatEvent[];
      phaseChanged: boolean;
      newlyDeadEnemyIds: string[];
      fireDamagedEnemies: Array<{ enemyId: string; newHp: number }>;
      ended: RunEndedEvent | null;
    };

export function stepCombat(room: Room, dt: number): CombatStepResult {
  if (room.status !== 'in-progress' || room.phase !== 'combat') {
    return { ok: false };
  }

  const dungeon = room.dungeon ?? { rooms: [], corridors: [], width: 80, height: 80, runId: room.runId };

  const stage = bleedStageOf(room.bleedClock.current, room.bleedClock.max);
  let aggressionMult = stage >= 1 ? AGGRESSION_COOLDOWN_MULT : 1;
  if (room.tumorAggressionActive) aggressionMult *= 0.85; // Tumor doctrine tier-1: enemies 15% faster

  const { enemies: nextEnemies, events } = tickEnemies(room.enemies, room.playerStates, dungeon, dt, aggressionMult);

  // Track enemies that went alive -> dead from projectile damage this tick.
  const newlyDeadEnemyIds: string[] = [];
  for (const [id, after] of nextEnemies) {
    const before = room.enemies.get(id);
    if (before?.alive && !after.alive) newlyDeadEnemyIds.push(id);
  }

  const synergyMap = evaluateSynergies(room.board, room.registry);

  // Apply shield relic damage reduction before deducting player HP.
  const reducedEvents = events.map(ev => ({
    ...ev,
    damage: evaluateIncomingDamage({
      board: room.board,
      synergyMap,
      targetPlayerId: ev.targetId,
      rawDamage: ev.damage,
      chorusVotiveBonus: room.chorusVotiveBonus,
    }),
  }));

  const { players, wiped } = applyEnemyAttacks(room.playerStates, reducedEvents);

  room.enemies = nextEnemies;
  room.playerStates = players;

  // Body separation: push overlapping entity pairs apart after all movement.
  separateBodies(room.playerStates, room.enemies, dungeon);

  // Tick fire DoT on burning enemies.
  const fireDamagedEnemies: Array<{ enemyId: string; newHp: number }> = [];
  for (const [enemyId, remaining] of [...room.fireDurations]) {
    const enemy = room.enemies.get(enemyId);
    if (!enemy?.alive) { room.fireDurations.delete(enemyId); continue; }
    const newRemaining = remaining - dt;
    if (newRemaining <= 0) room.fireDurations.delete(enemyId);
    else room.fireDurations.set(enemyId, newRemaining);
    const newHp = Math.max(0, enemy.hp - DOT_DAMAGE_PER_SECOND * dt);
    enemy.hp = newHp;
    if (newHp <= 0) {
      enemy.alive = false;
      if (!newlyDeadEnemyIds.includes(enemyId)) newlyDeadEnemyIds.push(enemyId);
    }
    fireDamagedEnemies.push({ enemyId, newHp });
  }

  room.enemiesKilled += newlyDeadEnemyIds.length;

  if (wiped && room.status === 'in-progress') {
    room.status = 'ended';
    room.outcome = 'wiped';
    return {
      ok: true,
      wiped: true,
      events: reducedEvents,
      phaseChanged: false,
      newlyDeadEnemyIds,
      fireDamagedEnemies,
      ended: { outcome: 'wiped', finalFloor: room.floor, enemiesKilled: room.enemiesKilled },
    };
  }

  let phaseChanged = false;
  if (allEnemiesDead(room.enemies)) {
    room.phase = 'loot';
    phaseChanged = true;
  }

  return { ok: true, wiped: false, events: reducedEvents, phaseChanged, newlyDeadEnemyIds, fireDamagedEnemies, ended: null };
}
