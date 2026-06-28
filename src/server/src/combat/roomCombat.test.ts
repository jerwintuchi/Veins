import { describe, it, expect } from 'vitest';
import { stepCombat } from './roomCombat.js';
import { SHAMBLER_DEF, PLAYER_MAX_HP, STARTER_RELICS, PLAYER_RADIUS, ENEMY_RADIUS_SHAMBLER } from '@veins/shared';
import type { PlayerState } from '@veins/shared';
import type { EnemyState } from './types.js';
import type { Room } from '../room/state.js';
import { buildInitialBoard } from '../board/layout.js';
import { drainRateForFloor } from '../room/state.js';
import { generateDungeon, STANDARD_DUNGEON_CONFIG } from '../dungeon/bsp.js';
import { createRng, hashSeed } from '../rng/seeded.js';
import { DOT_DURATION_S, DOT_DAMAGE_PER_SECOND, SHELL_REDUCTION } from '../relic/effects.js';

const DUNGEON = generateDungeon('r', STANDARD_DUNGEON_CONFIG, 1);

function makeEnemy(overrides: Partial<EnemyState> = {}): EnemyState {
  return {
    id: 'e1',
    typeId: 'shambler',
    x: 20,
    y: 0,
    hp: SHAMBLER_DEF.baseHp,
    maxHp: SHAMBLER_DEF.baseHp,
    damage: SHAMBLER_DEF.damage,
    alive: true,
    attackCooldownRemaining: 0,
    ...overrides,
  };
}

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return { hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP, downed: false, x: 0, y: 0, ...overrides };
}

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 'r',
    code: 'R',
    hostId: 'p1',
    status: 'in-progress',
    runId: 'run-1',
    players: ['p1', 'p2'],
    board: buildInitialBoard(['p1', 'p2'], 2),
    registry: new Map(),
    phase: 'combat',
    floor: 1,
    bleedClock: { current: 1000, max: 1000, drainPerSecond: drainRateForFloor(1) },
    outcome: null,
    dungeon: DUNGEON,
    enemies: new Map(),
    playerStates: new Map([['p1', makePlayer()], ['p2', makePlayer()]]),
    aimStates: new Map(),
    projectiles: new Map(),
    weaponCooldowns: new Map(),
    playerMoveInputs: new Map(),
    nextProjectileId: 0,
    lootPools: {},
    placedThisLootPhase: new Set(),
    fireDurations: new Map(),
    combatRng: createRng(hashSeed('run-1#combat')),
    ...overrides,
  };
}

describe('stepCombat — guard (T10, R6, P5)', () => {
  it('returns ok:false for a non-in-progress room and mutates nothing', () => {
    const room = makeRoom({ status: 'lobby' });
    const snap = JSON.stringify({ status: room.status, phase: room.phase });
    const res = stepCombat(room, 0.1);
    expect(res.ok).toBe(false);
    expect(JSON.stringify({ status: room.status, phase: room.phase })).toBe(snap);
  });

  it('returns ok:false for a room not in combat phase', () => {
    const room = makeRoom({ phase: 'loot' });
    expect(stepCombat(room, 0.1).ok).toBe(false);
  });

  it('returns ok:false for an already-ended room (P5: terminal once)', () => {
    const room = makeRoom({ status: 'ended', outcome: 'wiped' });
    expect(stepCombat(room, 0.1).ok).toBe(false);
  });
});

describe('stepCombat — movement (T10)', () => {
  it('enemy positions update per tickEnemies after one step', () => {
    // Enemy starts far enough to be in detection range but not attack range.
    const enemy = makeEnemy({ x: 0, y: 0, typeId: 'shambler' });
    const players = new Map([['p1', makePlayer({ x: 100, y: 0 })]]);
    const room = makeRoom({ enemies: new Map([['e1', enemy]]), playerStates: players });
    const before = room.enemies.get('e1')!.x;
    const res = stepCombat(room, 0.1);
    expect(res.ok).toBe(true);
    expect(room.enemies.get('e1')!.x).toBeGreaterThan(before);
  });
});

describe('stepCombat — attack resolution (T10, R5)', () => {
  it('player HP decreases when an attack event is generated', () => {
    // Enemy within attack range and ready to attack.
    const enemy = makeEnemy({ x: 20, y: 0, attackCooldownRemaining: 0 });
    const players = new Map([['p1', makePlayer({ x: 0, y: 0 })]]);
    const room = makeRoom({ enemies: new Map([['e1', enemy]]), playerStates: players });
    stepCombat(room, 0.1);
    expect(room.playerStates.get('p1')!.hp).toBeLessThan(PLAYER_MAX_HP);
  });
});

describe('stepCombat — wipe (T10, R6)', () => {
  it('sets room.status=ended + outcome=wiped when all players are downed', () => {
    // One enemy in range, both players have 1 HP left.
    const enemy = makeEnemy({ x: 20, y: 0, attackCooldownRemaining: 0 });
    const players = new Map([
      ['p1', makePlayer({ hp: 1, x: 0, y: 0 })],
      ['p2', makePlayer({ hp: 0, downed: true, x: 0, y: 0 })],
    ]);
    const room = makeRoom({ enemies: new Map([['e1', enemy]]), playerStates: players });
    const res = stepCombat(room, 0.1);
    if (!res.ok) throw new Error('expected ok:true');
    expect(res.wiped).toBe(true);
    expect(room.status).toBe('ended');
    expect(room.outcome).toBe('wiped');
    expect(res.ended?.outcome).toBe('wiped');
  });

  it('does not re-end an already-ended room (P5)', () => {
    const room = makeRoom({ status: 'ended', outcome: 'wiped', phase: 'combat' });
    const res = stepCombat(room, 0.1);
    expect(res.ok).toBe(false);
  });
});

describe('stepCombat — phase transition (T10, R7)', () => {
  it('sets room.phase=loot and returns phaseChanged=true when all enemies are dead', () => {
    const enemy = makeEnemy({ alive: false }); // pre-killed (simulating player attack from future spec)
    const room = makeRoom({ enemies: new Map([['e1', enemy]]) });
    const res = stepCombat(room, 0.1);
    if (!res.ok) throw new Error('expected ok:true');
    expect(res.phaseChanged).toBe(true);
    expect(room.phase).toBe('loot');
  });

  it('does not change phase if at least one enemy is alive', () => {
    const enemy = makeEnemy({ alive: true, x: 0, y: 0 });
    // Player far away so no attack this tick.
    const players = new Map([['p1', makePlayer({ x: 400, y: 0 })]]);
    const room = makeRoom({ enemies: new Map([['e1', enemy]]), playerStates: players });
    const res = stepCombat(room, 0.1);
    if (!res.ok) throw new Error('expected ok:true');
    expect(res.phaseChanged).toBe(false);
    expect(room.phase).toBe('combat');
  });

  it('returns phaseChanged=true for a room with an empty enemy map', () => {
    const room = makeRoom({ enemies: new Map() });
    const res = stepCombat(room, 0.1);
    if (!res.ok) throw new Error('expected ok:true');
    expect(res.phaseChanged).toBe(true);
  });
});

describe('stepCombat — fire DoT (T4, R4)', () => {
  it('burning enemy takes fire damage each tick and fireDamagedEnemies is populated', () => {
    const enemy = makeEnemy({ hp: 100, alive: true, x: 400, y: 0 });
    const room = makeRoom({
      enemies: new Map([['e1', enemy]]),
      fireDurations: new Map([['e1', DOT_DURATION_S]]),
    });
    const dt = 1.0;
    const res = stepCombat(room, dt);
    if (!res.ok) throw new Error('expected ok:true');
    expect(res.fireDamagedEnemies).toHaveLength(1);
    expect(res.fireDamagedEnemies[0]!.enemyId).toBe('e1');
    const expectedHp = Math.max(0, 100 - DOT_DAMAGE_PER_SECOND * dt);
    expect(res.fireDamagedEnemies[0]!.newHp).toBeCloseTo(expectedHp);
    expect(room.enemies.get('e1')!.hp).toBeCloseTo(expectedHp);
  });

  it('fire duration decrements; entry deleted when it reaches 0', () => {
    const enemy = makeEnemy({ hp: 100, alive: true, x: 400, y: 0 });
    const room = makeRoom({
      enemies: new Map([['e1', enemy]]),
      fireDurations: new Map([['e1', 0.05]]), // will expire in 0.1s tick
    });
    stepCombat(room, 0.1);
    expect(room.fireDurations.has('e1')).toBe(false);
  });

  it('enemy killed by fire appears in newlyDeadEnemyIds', () => {
    const enemy = makeEnemy({ hp: 1, alive: true, x: 400, y: 0 });
    const room = makeRoom({
      enemies: new Map([['e1', enemy]]),
      fireDurations: new Map([['e1', DOT_DURATION_S]]),
    });
    const res = stepCombat(room, 1.0);
    if (!res.ok) throw new Error('expected ok:true');
    expect(res.newlyDeadEnemyIds).toContain('e1');
    expect(room.enemies.get('e1')!.alive).toBe(false);
  });

  it('dead enemy fire entry is cleaned up, not applied', () => {
    const enemy = makeEnemy({ hp: 0, alive: false, x: 400, y: 0 });
    const room = makeRoom({
      enemies: new Map([['e1', enemy]]),
      fireDurations: new Map([['e1', DOT_DURATION_S]]),
    });
    stepCombat(room, 1.0);
    expect(room.fireDurations.has('e1')).toBe(false);
  });
});

describe('stepCombat — calcified-shell damage reduction (T4, R6)', () => {
  it('player with calcified-shell takes reduced damage (min 1)', () => {
    const board = buildInitialBoard(['p1', 'p2'], 2);
    const p1Slot = Object.values(board.slots).find(s => s.ownerId === 'p1')!;
    p1Slot.relicId = 'calcified-shell';
    const registry = new Map(STARTER_RELICS.map(r => [r.id, r]));

    const enemy = makeEnemy({ x: 0, y: 0, attackCooldownRemaining: 0 });
    const players = new Map([
      ['p1', makePlayer({ x: 0, y: 0, hp: PLAYER_MAX_HP })],
    ]);
    const room = makeRoom({ board, registry, enemies: new Map([['e1', enemy]]), playerStates: players });
    stepCombat(room, 0.1);
    const p1Hp = room.playerStates.get('p1')!.hp;
    // SHAMBLER damage is 8; calcified-shell reduces by 5 → takes 3 damage
    const expected = PLAYER_MAX_HP - Math.max(1, SHAMBLER_DEF.damage - SHELL_REDUCTION);
    expect(p1Hp).toBe(expected);
  });

  it('player without calcified-shell takes full damage', () => {
    const enemy = makeEnemy({ x: 0, y: 0, attackCooldownRemaining: 0 });
    const players = new Map([['p1', makePlayer({ x: 0, y: 0, hp: PLAYER_MAX_HP })]]);
    const room = makeRoom({ enemies: new Map([['e1', enemy]]), playerStates: players });
    stepCombat(room, 0.1);
    expect(room.playerStates.get('p1')!.hp).toBe(PLAYER_MAX_HP - SHAMBLER_DEF.damage);
  });
});

describe('stepCombat — body separation integration (T3, R2)', () => {
  it('after one step where enemy starts coincident with player, post-step distance >= combined radii', () => {
    // Place the enemy exactly coincident with the player — worst-case overlap.
    // The flat DUNGEON has a single large room so no wall clamping interferes.
    const flatDungeon = { runId: 'flat', width: 512, height: 512, rooms: [{ id: 'room-0', rect: { x: 0, y: 0, width: 512, height: 512 } }], corridors: [] };
    const enemy = makeEnemy({ x: 256, y: 256 });
    const player = makePlayer({ x: 256, y: 256 });
    const room = makeRoom({
      dungeon: flatDungeon,
      enemies: new Map([['e1', enemy]]),
      playerStates: new Map([['p1', player]]),
    });
    stepCombat(room, 0.05);
    const e = room.enemies.get('e1')!;
    const p = room.playerStates.get('p1')!;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d  = Math.sqrt(dx * dx + dy * dy);
    expect(d).toBeGreaterThanOrEqual(PLAYER_RADIUS + ENEMY_RADIUS_SHAMBLER - 0.01);
  });
});
