import { describe, it, expect } from 'vitest';
import { tickEnemies, applyEnemyAttacks, allEnemiesDead } from './tick.js';
import { SHAMBLER_DEF, SPITTER_DEF, ENEMY_TYPES, PLAYER_MAX_HP } from '@veins/shared';
import type { EnemyState } from './types.js';
import type { PlayerState, DungeonLayout } from '@veins/shared';

// Large flat room — all positions within [0,512]×[0,512] are walkable so that
// AI-behaviour tests (movement direction, attack timing) work at synthetic
// coordinates without being blocked by wall collision.
const DUNGEON: DungeonLayout = {
  runId: 'flat', width: 512, height: 512,
  rooms: [{ id: 'room-0', rect: { x: 0, y: 0, width: 512, height: 512 } }],
  corridors: [],
};

// Room-0 (top-left) and room-1 (bottom-right) connected by an L-shaped corridor.
// Rooms are 85+ units apart (> shambler attackRange=40) so the enemy must move.
// The direct diagonal path passes through the wall, forcing A* to route through the L.
const TWO_ROOM_DUNGEON: DungeonLayout = {
  runId: 'two-room', width: 100, height: 100,
  rooms: [
    { id: 'room-0', rect: { x: 0, y: 0, width: 10, height: 10 } },
    { id: 'room-1', rect: { x: 80, y: 80, width: 10, height: 10 } },
  ],
  corridors: [{
    fromRoomId: 'room-0', toRoomId: 'room-1',
    from: { x: 5, y: 5 }, to: { x: 85, y: 85 },
    // L-shape: horizontal at y=4..6 x=5..85, vertical at x=84..86 y=5..85.
  }],
};

function makeEnemy(overrides: Partial<EnemyState> = {}): EnemyState {
  const typeId = overrides.typeId ?? 'shambler';
  const def = ENEMY_TYPES[typeId];
  return {
    id: 'e1',
    typeId,
    x: 100,
    y: 100,
    hp: def.baseHp,
    maxHp: def.baseHp,
    damage: def.damage,
    alive: true,
    attackCooldownRemaining: 0,
    ...overrides,
  };
}

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return { hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP, downed: false, x: 0, y: 0, ...overrides };
}

// --- T6: tickEnemies ---

describe('tickEnemies — idle behavior (R4)', () => {
  it('an enemy with no players nearby does not move', () => {
    const enemy = makeEnemy({ x: 400, y: 400 });
    const players = new Map([['p1', makePlayer({ x: 0, y: 0 })]]);
    const { enemies } = tickEnemies(new Map([['e1', enemy]]), players, DUNGEON, 0.1);
    const e = enemies.get('e1')!;
    expect(e.x).toBe(400);
    expect(e.y).toBe(400);
  });

  it('an enemy out of detection range does not move', () => {
    const enemy = makeEnemy({ x: 0, y: 0, typeId: 'shambler' });
    // Place player far beyond detectionRange (200 units for shambler).
    const players = new Map([['p1', makePlayer({ x: 500, y: 0 })]]);
    const { enemies } = tickEnemies(new Map([['e1', enemy]]), players, DUNGEON, 0.1);
    expect(enemies.get('e1')!.x).toBe(0);
  });

  it('a dead enemy does not move or attack', () => {
    const enemy = makeEnemy({ alive: false, x: 50, y: 50 });
    const players = new Map([['p1', makePlayer({ x: 55, y: 55 })]]);
    const { enemies, events } = tickEnemies(new Map([['e1', enemy]]), players, DUNGEON, 0.1);
    expect(enemies.get('e1')!.x).toBe(50);
    expect(events).toHaveLength(0);
  });
});

describe('tickEnemies — movement (R4)', () => {
  it('moves toward the nearest active player within detection range', () => {
    // Player within shambler detection range (200) but outside attack range (40).
    const enemy = makeEnemy({ x: 0, y: 0 });
    const players = new Map([['p1', makePlayer({ x: 100, y: 0 })]]);
    const { enemies } = tickEnemies(new Map([['e1', enemy]]), players, DUNGEON, 0.1);
    const e = enemies.get('e1')!;
    // Enemy should have moved in the +x direction.
    expect(e.x).toBeGreaterThan(0);
    expect(e.y).toBeCloseTo(0, 5);
  });

  it('movement is at most speed * dt units', () => {
    const enemy = makeEnemy({ x: 0, y: 0 });
    const players = new Map([['p1', makePlayer({ x: 100, y: 0 })]]);
    const dt = 0.1;
    const { enemies } = tickEnemies(new Map([['e1', enemy]]), players, DUNGEON, dt);
    const moved = enemies.get('e1')!.x - 0;
    expect(moved).toBeLessThanOrEqual(SHAMBLER_DEF.speed * dt + 0.001);
  });

  it('downed players are excluded from targeting', () => {
    const enemy = makeEnemy({ x: 0, y: 0 });
    const downedPlayer = makePlayer({ x: 60, y: 0, downed: true });
    const alivePlayer = makePlayer({ x: 0, y: 100 }); // in detection range too
    const players = new Map([['p1', downedPlayer], ['p2', alivePlayer]]);
    const { enemies } = tickEnemies(new Map([['e1', enemy]]), players, DUNGEON, 0.1);
    const e = enemies.get('e1')!;
    // Should move toward alivePlayer (y direction), not downed p1 (x direction).
    expect(e.y).toBeGreaterThan(0);
  });
});

describe('tickEnemies — attack (R4)', () => {
  it('generates a CombatEvent when enemy is in range with cooldown at 0', () => {
    // Place enemy within shambler attackRange (40 units).
    const enemy = makeEnemy({ x: 0, y: 0, attackCooldownRemaining: 0 });
    const players = new Map([['p1', makePlayer({ x: 20, y: 0 })]]);
    const { events } = tickEnemies(new Map([['e1', enemy]]), players, DUNGEON, 0.1);
    expect(events).toHaveLength(1);
    expect(events[0]!.kind).toBe('attack');
    expect(events[0]!.targetId).toBe('p1');
    expect(events[0]!.damage).toBe(SHAMBLER_DEF.damage);
  });

  it('resets attackCooldownRemaining to full cooldown after attacking', () => {
    // Drain runs first (0 - 0.1 -> clamped 0), then attack fires and resets to
    // the full attackCooldown (1.2). The remaining value is the full cooldown, not
    // attackCooldown - dt, because the reset happens after the drain step.
    const enemy = makeEnemy({ x: 0, y: 0, attackCooldownRemaining: 0 });
    const players = new Map([['p1', makePlayer({ x: 20, y: 0 })]]);
    const { enemies } = tickEnemies(new Map([['e1', enemy]]), players, DUNGEON, 0.1);
    expect(enemies.get('e1')!.attackCooldownRemaining).toBeCloseTo(SHAMBLER_DEF.attackCooldown, 4);
  });

  it('does NOT attack when cooldown > 0', () => {
    const enemy = makeEnemy({ x: 0, y: 0, attackCooldownRemaining: 0.5 });
    const players = new Map([['p1', makePlayer({ x: 20, y: 0 })]]);
    const { events } = tickEnemies(new Map([['e1', enemy]]), players, DUNGEON, 0.1);
    expect(events).toHaveLength(0);
  });

  it('cooldown ticks down by dt even when not attacking', () => {
    const enemy = makeEnemy({ x: 0, y: 0, attackCooldownRemaining: 0.5 });
    const players = new Map([['p1', makePlayer({ x: 20, y: 0 })]]);
    const { enemies } = tickEnemies(new Map([['e1', enemy]]), players, DUNGEON, 0.1);
    expect(enemies.get('e1')!.attackCooldownRemaining).toBeCloseTo(0.4, 5);
  });

  it('attacks again after cooldown drains through float subtraction (regression: === 0 float bug)', () => {
    // Shambler attackCooldown = 1.2; drain 12 ticks of dt=0.1. IEEE-754 accumulated
    // subtraction leaves a tiny positive residual rather than exactly 0.0. The fix
    // uses pre-clamp drainedCooldown <= 0 instead of post-clamp === 0.
    const players = new Map([['p1', makePlayer({ x: 20, y: 0 })]]);
    let em = new Map([['e1', makeEnemy({ x: 0, y: 0, attackCooldownRemaining: 0 })]]);
    let totalAttacks = 0;
    for (let tick = 0; tick < 25; tick++) {
      const res = tickEnemies(em, players, DUNGEON, 0.1);
      totalAttacks += res.events.length;
      em = res.enemies;
    }
    // Over 25 ticks at dt=0.1 (2.5 seconds), with cooldown 1.2s the enemy should
    // attack twice (at tick 0 and again around tick 12-13). Bug would give only 1.
    expect(totalAttacks).toBeGreaterThanOrEqual(2);
  });
});

describe('tickEnemies — purity (P2)', () => {
  it('same inputs produce deeply-equal outputs', () => {
    const enemy = makeEnemy({ x: 0, y: 0 });
    const players = new Map([['p1', makePlayer({ x: 60, y: 0 })]]);
    const em = new Map([['e1', enemy]]);
    const a = tickEnemies(em, players, DUNGEON, 0.1);
    const b = tickEnemies(em, players, DUNGEON, 0.1);
    expect(JSON.stringify([...a.enemies])).toBe(JSON.stringify([...b.enemies]));
    expect(a.events).toEqual(b.events);
  });

  it('does not mutate the input enemy map', () => {
    const enemy = makeEnemy({ x: 0, y: 0 });
    const before = { ...enemy };
    const em = new Map([['e1', enemy]]);
    tickEnemies(em, new Map([['p1', makePlayer({ x: 60, y: 0 })]]), DUNGEON, 0.1);
    expect(em.get('e1')).toEqual(before);
  });

  it('does not mutate the input player map', () => {
    const player = makePlayer({ x: 20, y: 0 });
    const before = { ...player };
    const pm = new Map([['p1', player]]);
    const enemy = makeEnemy({ x: 0, y: 0, attackCooldownRemaining: 0 });
    tickEnemies(new Map([['e1', enemy]]), pm, DUNGEON, 0.1);
    expect(pm.get('p1')).toEqual(before);
  });
});

// --- T7: applyEnemyAttacks ---

describe('applyEnemyAttacks (R5)', () => {
  it('reduces player HP by damage, clamped to 0', () => {
    const players = new Map([['p1', makePlayer({ hp: 100 })]]);
    const { players: next } = applyEnemyAttacks(players, [
      { kind: 'attack', enemyId: 'e1', targetId: 'p1', damage: 30 },
    ]);
    expect(next.get('p1')!.hp).toBe(70);
  });

  it('clamps HP to 0 when damage exceeds remaining HP', () => {
    const players = new Map([['p1', makePlayer({ hp: 10 })]]);
    const { players: next } = applyEnemyAttacks(players, [
      { kind: 'attack', enemyId: 'e1', targetId: 'p1', damage: 50 },
    ]);
    expect(next.get('p1')!.hp).toBe(0);
  });

  it('sets downed=true when player HP reaches 0', () => {
    const players = new Map([['p1', makePlayer({ hp: 15 })]]);
    const { players: next } = applyEnemyAttacks(players, [
      { kind: 'attack', enemyId: 'e1', targetId: 'p1', damage: 15 },
    ]);
    expect(next.get('p1')!.downed).toBe(true);
  });

  it('skips a player who is already downed', () => {
    const players = new Map([['p1', makePlayer({ hp: 0, downed: true })]]);
    const { players: next } = applyEnemyAttacks(players, [
      { kind: 'attack', enemyId: 'e1', targetId: 'p1', damage: 15 },
    ]);
    expect(next.get('p1')!.hp).toBe(0);
  });

  it('returns wiped=true when all players are downed', () => {
    const players = new Map([
      ['p1', makePlayer({ hp: 0, downed: true })],
      ['p2', makePlayer({ hp: 5 })],
    ]);
    const { wiped, players: next } = applyEnemyAttacks(players, [
      { kind: 'attack', enemyId: 'e1', targetId: 'p2', damage: 5 },
    ]);
    expect(next.get('p2')!.downed).toBe(true);
    expect(wiped).toBe(true);
  });

  it('returns wiped=false when at least one player is still up', () => {
    const players = new Map([
      ['p1', makePlayer({ hp: 0, downed: true })],
      ['p2', makePlayer({ hp: 100 })],
    ]);
    const { wiped } = applyEnemyAttacks(players, []);
    expect(wiped).toBe(false);
  });

  it('does not mutate the input player map', () => {
    const p = makePlayer({ hp: 50 });
    const players = new Map([['p1', p]]);
    applyEnemyAttacks(players, [{ kind: 'attack', enemyId: 'e1', targetId: 'p1', damage: 10 }]);
    expect(players.get('p1')!.hp).toBe(50);
  });
});

// --- T8: allEnemiesDead ---

describe('allEnemiesDead (R7, T8)', () => {
  it('returns true when every entry has alive=false', () => {
    const enemies = new Map([
      ['e1', makeEnemy({ alive: false })],
      ['e2', makeEnemy({ id: 'e2', alive: false })],
    ]);
    expect(allEnemiesDead(enemies)).toBe(true);
  });

  it('returns false when at least one entry has alive=true', () => {
    const enemies = new Map([
      ['e1', makeEnemy({ alive: false })],
      ['e2', makeEnemy({ id: 'e2', alive: true })],
    ]);
    expect(allEnemiesDead(enemies)).toBe(false);
  });

  it('returns true for an empty map (vacuously all dead = floor cleared)', () => {
    expect(allEnemiesDead(new Map())).toBe(true);
  });
});

// --- spitter detection range covers melee range distinction (R1) ---

describe('Spitter vs Shambler range distinction', () => {
  it('Spitter detects and attacks from further away than Shambler melee range', () => {
    // Place enemy 100 units away — outside shambler attackRange (40) but inside spitter attackRange (150).
    const spitter = makeEnemy({ typeId: 'spitter', x: 0, y: 0, attackCooldownRemaining: 0 });
    const players = new Map([['p1', makePlayer({ x: 100, y: 0 })]]);
    const { events } = tickEnemies(new Map([['e1', spitter]]), players, DUNGEON, 0.1);
    expect(events).toHaveLength(1);
    expect(events[0]!.damage).toBe(SPITTER_DEF.damage);
  });
});

// --- T6: pathfinding integration (R3) ---

describe('tickEnemies — A* pathfinding (T6, R3)', () => {
  it('enemy in room-0 routes through L-shaped corridor rather than through wall to room-1', () => {
    // TWO_ROOM_DUNGEON: room-0 [0,10]×[0,10], room-1 [80,90]×[80,90] (~113 units apart > attackRange=40).
    // Direct diagonal path from (5,5) to (85,85) passes through wall at ≈(45,45).
    // A* routes horizontally along y≈5 then vertically along x≈85.
    const enemy = makeEnemy({ x: 5.5, y: 5.5 }); // room-0 centre
    const players = new Map([['p1', makePlayer({ x: 85.5, y: 85.5 })]]);  // room-1 centre
    const { enemies } = tickEnemies(new Map([['e1', enemy]]), players, TWO_ROOM_DUNGEON, 0.1);
    const e = enemies.get('e1')!;
    // Enemy should have moved right (toward horizontal corridor leg, y stays near 5).
    expect(e.x).toBeGreaterThan(5.5);
    // y should remain near corridor level (y=4..6), not drift diagonally toward 85.5.
    expect(e.y).toBeLessThan(8);
  });
});
