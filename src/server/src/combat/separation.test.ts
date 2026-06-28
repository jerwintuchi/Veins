import { describe, it, expect } from 'vitest';
import type { DungeonLayout } from '@veins/shared';
import {
  PLAYER_RADIUS,
  ENEMY_RADIUS_SHAMBLER,
  ENEMY_RADIUS_SPITTER,
  type PlayerState,
} from '@veins/shared';
import type { EnemyState } from './types.js';
import { separateBodies } from './separation.js';

// Flat 512×512 dungeon — everything is walkable, walls never interfere.
const FLAT: DungeonLayout = {
  runId: 'flat', width: 512, height: 512,
  rooms: [{ id: 'room-0', rect: { x: 0, y: 0, width: 512, height: 512 } }],
  corridors: [],
};

// Two-room dungeon with a wall gap — for testing wall-clamp behaviour.
const WALLED: DungeonLayout = {
  runId: 'walled', width: 300, height: 300,
  rooms: [
    { id: 'room-0', rect: { x: 0,   y: 0, width: 100, height: 300 } },
    { id: 'room-1', rect: { x: 200, y: 0, width: 100, height: 300 } },
  ],
  corridors: [{
    fromRoomId: 'room-0', toRoomId: 'room-1',
    from: { x: 50,  y: 150 },
    to:   { x: 250, y: 150 },
  }],
};

function makePlayer(id: string, x: number, y: number): PlayerState {
  return { hp: 100, maxHp: 100, downed: false, x, y };
}
function makeEnemy(id: string, typeId: 'shambler' | 'spitter', x: number, y: number): EnemyState {
  return { id, typeId, x, y, hp: 60, maxHp: 60, alive: true, attackCooldownRemaining: 0, damage: 15 };
}
function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// ─── player + enemy ────────────────────────────────────────────────────────

describe('separateBodies — player+enemy (T2, R2)', () => {
  it('separates overlapping player and shambler', () => {
    const p = makePlayer('p1', 100, 100);
    const e = makeEnemy('e1', 'shambler', 100 + 10, 100); // overlap: combined=24, dist=10
    const players = new Map([['p1', p]]);
    const enemies  = new Map([['e1', e]]);

    separateBodies(players, enemies, FLAT);

    expect(dist(p, e)).toBeGreaterThanOrEqual(PLAYER_RADIUS + ENEMY_RADIUS_SHAMBLER - 0.01);
  });

  it('separates overlapping player and spitter', () => {
    const p = makePlayer('p1', 200, 200);
    const e = makeEnemy('e1', 'spitter', 200 + 8, 200); // overlap: combined=20, dist=8
    const players = new Map([['p1', p]]);
    const enemies  = new Map([['e1', e]]);

    separateBodies(players, enemies, FLAT);

    expect(dist(p, e)).toBeGreaterThanOrEqual(PLAYER_RADIUS + ENEMY_RADIUS_SPITTER - 0.01);
  });

  it('does not move non-overlapping player+enemy', () => {
    const p = makePlayer('p1', 100, 100);
    const e = makeEnemy('e1', 'shambler', 200, 100); // dist=100, no overlap
    const players = new Map([['p1', p]]);
    const enemies  = new Map([['e1', e]]);

    separateBodies(players, enemies, FLAT);

    expect(p.x).toBe(100); expect(p.y).toBe(100);
    expect(e.x).toBe(200); expect(e.y).toBe(100);
  });
});

// ─── enemy + enemy ─────────────────────────────────────────────────────────

describe('separateBodies — enemy+enemy (T2, R2)', () => {
  it('separates two overlapping shamblers', () => {
    const e1 = makeEnemy('e1', 'shambler', 100, 100);
    const e2 = makeEnemy('e2', 'shambler', 100 + 10, 100); // dist=10 < combined=24
    const players = new Map<string, PlayerState>();
    const enemies  = new Map([['e1', e1], ['e2', e2]]);

    separateBodies(players, enemies, FLAT);

    expect(dist(e1, e2)).toBeGreaterThanOrEqual(ENEMY_RADIUS_SHAMBLER * 2 - 0.01);
  });

  it('separates overlapping shambler and spitter', () => {
    const e1 = makeEnemy('e1', 'shambler', 100, 100);
    const e2 = makeEnemy('e2', 'spitter',  100 + 12, 100); // dist=12 < combined=20
    const players = new Map<string, PlayerState>();
    const enemies  = new Map([['e1', e1], ['e2', e2]]);

    separateBodies(players, enemies, FLAT);

    expect(dist(e1, e2)).toBeGreaterThanOrEqual(ENEMY_RADIUS_SHAMBLER + ENEMY_RADIUS_SPITTER - 0.01);
  });
});

// ─── dead enemies excluded ─────────────────────────────────────────────────

describe('separateBodies — dead enemies excluded (R2)', () => {
  // Regression: a corpse (alive:false) lingers in room.enemies until the floor
  // ends, but the client removed its sprite on ENEMY_DIED. It must NOT separate
  // the player, or the player gets shoved sideways by an invisible body.
  it('does not push a player away from a dead enemy', () => {
    const p = makePlayer('p1', 100, 100);
    const e = makeEnemy('e1', 'shambler', 100 + 10, 100); // would overlap if alive
    e.alive = false;
    const players = new Map([['p1', p]]);
    const enemies  = new Map([['e1', e]]);

    separateBodies(players, enemies, FLAT);

    expect(p.x).toBe(100); expect(p.y).toBe(100);
    expect(e.x).toBe(110); expect(e.y).toBe(100);
  });

  it('still separates a live enemy when a dead one overlaps too', () => {
    const p = makePlayer('p1', 100, 100);
    const dead = makeEnemy('dead', 'shambler', 100, 100); // coincident corpse — ignored
    dead.alive = false;
    const live = makeEnemy('live', 'shambler', 100 + 10, 100); // overlapping, alive
    const players = new Map([['p1', p]]);
    const enemies  = new Map([['dead', dead], ['live', live]]);

    separateBodies(players, enemies, FLAT);

    expect(dist(p, live)).toBeGreaterThanOrEqual(PLAYER_RADIUS + ENEMY_RADIUS_SHAMBLER - 0.01);
  });
});

// ─── player + player exempt ────────────────────────────────────────────────

describe('separateBodies — player+player exempt (T2, R3)', () => {
  it('does not separate two overlapping players', () => {
    const p1 = makePlayer('p1', 100, 100);
    const p2 = makePlayer('p2', 104, 100); // dist=4, well inside combined radius 24
    const players = new Map([['p1', p1], ['p2', p2]]);
    const enemies  = new Map<string, EnemyState>();

    separateBodies(players, enemies, FLAT);

    expect(p1.x).toBe(100); expect(p1.y).toBe(100);
    expect(p2.x).toBe(104); expect(p2.y).toBe(100);
  });
});

// ─── wall clamping ─────────────────────────────────────────────────────────

describe('separateBodies — wall clamping (T2, R4, P3)', () => {
  it('pushed position stays walkable when near a wall', () => {
    // Place player at the left room edge, enemy pushing it toward the wall.
    // WALLED: room-0 is x=0..100. Player at x=5 (near left wall, inside room).
    // Enemy at x=5+10=15, same y — overlap = 24-10=14, push would move player to ~x=-2.
    const p = makePlayer('p1', 5, 150);
    const e = makeEnemy('e1', 'shambler', 15, 150);
    const players = new Map([['p1', p]]);
    const enemies  = new Map([['e1', e]]);

    separateBodies(players, enemies, WALLED);

    // Player must not be in the wall (x < 0 is outside room-0).
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeGreaterThanOrEqual(0);
  });
});

// ─── coincident entities ───────────────────────────────────────────────────

describe('separateBodies — coincident entities (T2, P1)', () => {
  it('handles dist=0 without throwing and moves entities apart', () => {
    const p = makePlayer('p1', 100, 100);
    const e = makeEnemy('e1', 'shambler', 100, 100); // exactly coincident
    const players = new Map([['p1', p]]);
    const enemies  = new Map([['e1', e]]);

    expect(() => separateBodies(players, enemies, FLAT)).not.toThrow();
    expect(dist(p, e)).toBeGreaterThan(0);
  });
});

// ─── determinism ───────────────────────────────────────────────────────────

describe('separateBodies — determinism (T2, P1)', () => {
  it('two identical calls produce the same result', () => {
    const run = () => {
      const p = makePlayer('p1', 100, 100);
      const e = makeEnemy('e1', 'shambler', 108, 100);
      separateBodies(new Map([['p1', p]]), new Map([['e1', e]]), FLAT);
      return { px: p.x, py: p.y, ex: e.x, ey: e.y };
    };
    expect(run()).toEqual(run());
  });
});
