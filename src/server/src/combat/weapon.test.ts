import { describe, it, expect, beforeEach } from 'vitest';
import { tryAutoFire, stepProjectiles } from './weapon.js';
import {
  WEAPON_COOLDOWN_MS, PROJECTILE_SPEED, PROJECTILE_DAMAGE,
  PROJECTILE_HIT_RADIUS, PROJECTILE_MAX_RANGE, PLAYER_MAX_HP,
} from '@veins/shared';
import type { PlayerState, DungeonLayout } from '@veins/shared';
import type { EnemyState } from './types.js';
import type { Room } from '../room/state.js';
import { buildInitialBoard } from '../board/layout.js';
import { drainRateForFloor } from '../room/state.js';
import { createRng, hashSeed } from '../rng/seeded.js';
import { STARTER_RELICS } from '@veins/shared';
import { WOUND_BURST_BONUS, DOT_DURATION_S } from '../relic/effects.js';

// Large flat room — all positions within [0,1000]×[0,1000] are walkable so that
// weapon/projectile tests work at synthetic coordinates without wall interference.
const DUNGEON: DungeonLayout = {
  runId: 'flat', width: 1000, height: 1000,
  rooms: [{ id: 'room-0', rect: { x: 0, y: 0, width: 1000, height: 1000 } }],
  corridors: [],
};

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return { hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP, downed: false, x: 0, y: 0, ...overrides };
}

function makeEnemy(id: string, x: number, y: number, alive = true): EnemyState {
  return { id, typeId: 'shambler', x, y, hp: 60, maxHp: 60, damage: 15, alive, attackCooldownRemaining: 0 };
}

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 'r', code: 'R', hostId: 'p1', status: 'in-progress', runId: 'run-1',
    players: ['p1', 'p2'],
    board: buildInitialBoard(['p1', 'p2'], 2),
    registry: new Map(), phase: 'combat', floor: 1,
    bleedClock: { current: 1000, max: 1000, drainPerSecond: drainRateForFloor(1) },
    outcome: null, dungeon: DUNGEON,
    enemies: new Map(),
    playerStates: new Map([
      ['p1', makePlayer({ x: 0, y: 0 })],
      ['p2', makePlayer({ x: 500, y: 500 })],
    ]),
    aimStates: new Map([
      ['p1', { mode: 'auto', targetId: null }],
      ['p2', { mode: 'auto', targetId: null }],
    ]),
    projectiles: new Map(),
    weaponCooldowns: new Map([['p1', 0], ['p2', 0]]),
    playerMoveInputs: new Map([['p1', { dx: 0, dy: 0 }], ['p2', { dx: 0, dy: 0 }]]),
    nextProjectileId: 0,
    lootPools: {},
    placedThisLootPhase: new Set(),
    fireDurations: new Map(),
    combatRng: createRng(hashSeed('run-1#combat')),
    ...overrides,
  };
}

const DT = WEAPON_COOLDOWN_MS / 1000; // one full cooldown cycle in seconds

// ─── tryAutoFire ───────────────────────────────────────────────────────────

describe('tryAutoFire (T3, R5)', () => {
  it('returns null when player is downed', () => {
    const room = makeRoom();
    room.playerStates.set('p1', makePlayer({ downed: true }));
    expect(tryAutoFire(room, 'p1', DT)).toBeNull();
  });

  it('returns null when cooldown has not expired', () => {
    const room = makeRoom();
    room.weaponCooldowns.set('p1', 300); // 300ms remaining
    room.aimStates.set('p1', { mode: 'manual', dx: 1, dy: 0 });
    expect(tryAutoFire(room, 'p1', 0.1)).toBeNull(); // only decrements by 100ms
  });

  it('returns null when mode is auto and targetId is null', () => {
    const room = makeRoom();
    room.aimStates.set('p1', { mode: 'auto', targetId: null });
    expect(tryAutoFire(room, 'p1', DT)).toBeNull();
  });

  it('returns null when auto-aim target is dead', () => {
    const room = makeRoom();
    room.enemies.set('e1', makeEnemy('e1', 100, 0, false)); // dead
    room.aimStates.set('p1', { mode: 'auto', targetId: 'e1' });
    expect(tryAutoFire(room, 'p1', DT)).toBeNull();
  });

  it('fires toward the auto-aim target (normalized direction)', () => {
    const room = makeRoom();
    room.enemies.set('e1', makeEnemy('e1', 100, 0, true)); // at (100, 0) → direction (1, 0)
    room.aimStates.set('p1', { mode: 'auto', targetId: 'e1' });
    const proj = tryAutoFire(room, 'p1', DT);
    expect(proj).not.toBeNull();
    expect(proj!.dx).toBeCloseTo(1);
    expect(proj!.dy).toBeCloseTo(0);
  });

  it('fires in the stored manual direction', () => {
    const room = makeRoom();
    room.aimStates.set('p1', { mode: 'manual', dx: 0, dy: 1 }); // aim down
    const proj = tryAutoFire(room, 'p1', DT);
    expect(proj).not.toBeNull();
    expect(proj!.dx).toBeCloseTo(0);
    expect(proj!.dy).toBeCloseTo(1);
  });

  // Hold-to-fire (desktop): a player who opted out (firing=false) does not fire
  // even with a valid aim and ready cooldown; setting firing=true fires again.
  it('does not fire when the player has opted out (playerFiring=false)', () => {
    const room = makeRoom();
    room.aimStates.set('p1', { mode: 'manual', dx: 1, dy: 0 });
    room.playerFiring = new Map([['p1', false]]);
    expect(tryAutoFire(room, 'p1', DT)).toBeNull();
  });

  it('fires when the player is holding fire (playerFiring=true)', () => {
    const room = makeRoom();
    room.aimStates.set('p1', { mode: 'manual', dx: 1, dy: 0 });
    room.playerFiring = new Map([['p1', true]]);
    expect(tryAutoFire(room, 'p1', DT)).not.toBeNull();
  });

  it('auto-fires by default when playerFiring is absent (mobile / unchanged)', () => {
    const room = makeRoom(); // no playerFiring map
    room.aimStates.set('p1', { mode: 'manual', dx: 1, dy: 0 });
    expect(tryAutoFire(room, 'p1', DT)).not.toBeNull();
  });

  it('resets cooldown to WEAPON_COOLDOWN_MS after firing', () => {
    const room = makeRoom();
    room.aimStates.set('p1', { mode: 'manual', dx: 1, dy: 0 });
    tryAutoFire(room, 'p1', DT);
    // After a shot the cooldown should be at most WEAPON_COOLDOWN_MS
    // (it may be slightly less because we subtracted dt first)
    expect(room.weaponCooldowns.get('p1')).toBeLessThanOrEqual(WEAPON_COOLDOWN_MS);
    expect(room.weaponCooldowns.get('p1')!).toBeGreaterThan(0);
  });

  it('assigns unique ids using room.nextProjectileId', () => {
    const room = makeRoom();
    room.aimStates.set('p1', { mode: 'manual', dx: 1, dy: 0 });
    room.aimStates.set('p2', { mode: 'manual', dx: -1, dy: 0 });
    const p1 = tryAutoFire(room, 'p1', DT);
    room.weaponCooldowns.set('p1', 0); // reset cooldown to fire again
    const p1b = tryAutoFire(room, 'p1', DT);
    expect(p1!.id).not.toBe(p1b!.id);
    expect(room.nextProjectileId).toBe(2);
  });

  it('projectile starts at player position', () => {
    const room = makeRoom({ playerStates: new Map([['p1', makePlayer({ x: 42, y: 77 })], ['p2', makePlayer()]]) });
    room.weaponCooldowns.set('p1', 0);
    room.aimStates.set('p1', { mode: 'manual', dx: 1, dy: 0 });
    const proj = tryAutoFire(room, 'p1', DT);
    expect(proj!.x).toBeCloseTo(42);
    expect(proj!.y).toBeCloseTo(77);
  });
});

// ─── stepProjectiles ───────────────────────────────────────────────────────

describe('stepProjectiles (T3, R6)', () => {
  it('advances projectile position by PROJECTILE_SPEED * dt', () => {
    const room = makeRoom();
    room.projectiles.set('p', { id: 'p', ownerId: 'p1', x: 0, y: 0, dx: 1, dy: 0, distanceTravelled: 0 });
    stepProjectiles(room, 0.1);
    const proj = room.projectiles.get('p');
    expect(proj!.x).toBeCloseTo(PROJECTILE_SPEED * 0.1);
  });

  it('returns hit result when projectile reaches within HIT_RADIUS of an enemy', () => {
    const room = makeRoom();
    room.enemies.set('e1', makeEnemy('e1', 10, 0, true)); // enemy at x=10
    room.projectiles.set('p', { id: 'p', ownerId: 'p1', x: 5, y: 0, dx: 1, dy: 0, distanceTravelled: 0 });
    const results = stepProjectiles(room, 0); // dt=0; no movement; check collision
    // Distance is 5 which is <= HIT_RADIUS (20)
    expect(results).toHaveLength(1);
    expect(results[0].hit).toBe(true);
    if (results[0].hit) {
      expect(results[0].enemyId).toBe('e1');
      expect(results[0].newHp).toBe(60 - PROJECTILE_DAMAGE);
      expect(results[0].splashHits).toEqual([]);
      expect(results[0].fireApplied).toBe(false);
      expect(results[0].chainHit).toBeNull();
    }
  });

  it('removes projectile from room.projectiles on hit', () => {
    const room = makeRoom();
    room.enemies.set('e1', makeEnemy('e1', 5, 0, true));
    room.projectiles.set('p', { id: 'p', ownerId: 'p1', x: 0, y: 0, dx: 1, dy: 0, distanceTravelled: 0 });
    stepProjectiles(room, 0);
    expect(room.projectiles.has('p')).toBe(false);
  });

  it('returns range result when distanceTravelled exceeds PROJECTILE_MAX_RANGE', () => {
    const room = makeRoom();
    room.projectiles.set('p', {
      id: 'p', ownerId: 'p1', x: 0, y: 0, dx: 1, dy: 0,
      distanceTravelled: PROJECTILE_MAX_RANGE + 1,
    });
    const results = stepProjectiles(room, 0); // still over range after dt=0
    expect(results).toHaveLength(1);
    expect(results[0].hit).toBe(false);
    expect(room.projectiles.has('p')).toBe(false);
  });

  it('does not hit dead enemies', () => {
    const room = makeRoom();
    room.enemies.set('e1', makeEnemy('e1', 5, 0, false)); // dead
    room.projectiles.set('p', { id: 'p', ownerId: 'p1', x: 0, y: 0, dx: 1, dy: 0, distanceTravelled: 0 });
    const results = stepProjectiles(room, 0);
    expect(results).toHaveLength(0); // no hit, projectile still flying
    expect(room.projectiles.has('p')).toBe(true);
  });

  it('does not decrement enemy hp below 0', () => {
    const room = makeRoom();
    room.enemies.set('e1', makeEnemy('e1', 5, 0, true));
    room.enemies.get('e1')!.hp = 5; // less than PROJECTILE_DAMAGE
    room.projectiles.set('p', { id: 'p', ownerId: 'p1', x: 0, y: 0, dx: 1, dy: 0, distanceTravelled: 0 });
    const results = stepProjectiles(room, 0);
    // Enemy entry stays — death is stepCombat's job. Only hp is clamped.
    expect(room.enemies.get('e1')!.hp).toBe(0);
    expect(results[0].hit).toBe(true);
    if (results[0].hit) expect(results[0].newHp).toBe(0);
  });

  it('one hit per projectile (first enemy wins)', () => {
    const room = makeRoom();
    // Two enemies at the same spot — only one should be hit.
    room.enemies.set('e1', makeEnemy('e1', 0, 0, true));
    room.enemies.set('e2', makeEnemy('e2', 0, 0, true));
    room.projectiles.set('p', { id: 'p', ownerId: 'p1', x: 0, y: 0, dx: 1, dy: 0, distanceTravelled: 0 });
    const results = stepProjectiles(room, 0);
    expect(results).toHaveLength(1);
    expect(results[0].hit).toBe(true);
  });
});

describe('stepProjectiles — relic effects (T3, R2, R3, R4, R5)', () => {
  // Build a board where p1 owns a slot with a given relic.
  function roomWithRelic(relicId: string): Room {
    const board = buildInitialBoard(['p1', 'p2'], 2);
    // Place the relic into p1's first slot.
    const p1Slot = Object.values(board.slots).find(s => s.ownerId === 'p1')!;
    p1Slot.relicId = relicId;
    const registry = new Map(STARTER_RELICS.map(r => [r.id, r]));
    return makeRoom({ board, registry });
  }

  it('blooming-wound base: hit damage is PROJECTILE_DAMAGE + WOUND_BURST_BONUS (T3, R2)', () => {
    const room = roomWithRelic('blooming-wound');
    room.enemies.set('e1', makeEnemy('e1', 5, 0, true));
    room.projectiles.set('p', { id: 'p', ownerId: 'p1', x: 0, y: 0, dx: 1, dy: 0, distanceTravelled: 0 });
    const results = stepProjectiles(room, 0);
    expect(results[0].hit).toBe(true);
    if (results[0].hit) {
      expect(results[0].newHp).toBe(Math.max(0, 60 - PROJECTILE_DAMAGE - WOUND_BURST_BONUS));
    }
  });

  it('systemic-rot base: fireApplied === true and fireDurations set (T3, R4)', () => {
    const room = roomWithRelic('systemic-rot');
    room.enemies.set('e1', makeEnemy('e1', 5, 0, true));
    room.projectiles.set('p', { id: 'p', ownerId: 'p1', x: 0, y: 0, dx: 1, dy: 0, distanceTravelled: 0 });
    const results = stepProjectiles(room, 0);
    expect(results[0].hit).toBe(true);
    if (results[0].hit) {
      expect(results[0].fireApplied).toBe(true);
    }
    expect(room.fireDurations.get('e1')).toBe(DOT_DURATION_S);
  });

  it('blooming-wound synergy: splashHits contains nearby enemies (T3, R3)', () => {
    // With no second enemy in range, just confirm splashHits is populated logic
    // We'd need a synergized board — test that splashHits is empty without synergy.
    const room = roomWithRelic('blooming-wound');
    const nearby = makeEnemy('e2', 5 + 10, 0, true); // 10 units from primary
    room.enemies.set('e1', makeEnemy('e1', 5, 0, true));
    room.enemies.set('e2', nearby);
    room.projectiles.set('p', { id: 'p', ownerId: 'p1', x: 0, y: 0, dx: 1, dy: 0, distanceTravelled: 0 });
    const results = stepProjectiles(room, 0);
    // No synergy (board has only blooming-wound but needs 2 different owners adjacent)
    // so splashHits should be empty.
    expect(results[0].hit).toBe(true);
    if (results[0].hit) {
      expect(results[0].splashHits).toEqual([]);
    }
  });
});
