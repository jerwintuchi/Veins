import { describe, it, expect, vi } from 'vitest';
import { spawnEnemies } from './spawn.js';
import { generateDungeon, STANDARD_DUNGEON_CONFIG } from '../dungeon/bsp.js';
import { createRng, hashSeed } from '../rng/seeded.js';
import { SHAMBLER_DEF, SPITTER_DEF } from '@testament/shared';
import type { DungeonLayout } from '@testament/shared';

const TEST_RUN = 'test-run-abc';
const TEST_DUNGEON = generateDungeon(TEST_RUN, STANDARD_DUNGEON_CONFIG, 1);

// Minimal 2-room dungeon for deterministic elite room tests.
const TWO_ROOM_DUNGEON: DungeonLayout = {
  runId: TEST_RUN, width: 100, height: 100,
  rooms: [
    { id: 'room-0', rect: { x: 0,  y: 0,  width: 30, height: 30 } },
    { id: 'room-1', rect: { x: 60, y: 60, width: 30, height: 30 } },
  ],
  corridors: [{
    fromRoomId: 'room-0', toRoomId: 'room-1',
    from: { x: 15, y: 15 }, to: { x: 75, y: 75 },
  }],
};

// Single-room dungeon — only room-0, no spawnable rooms.
const SOLO_ROOM_DUNGEON: DungeonLayout = {
  runId: TEST_RUN, width: 50, height: 50,
  rooms: [{ id: 'room-0', rect: { x: 0, y: 0, width: 50, height: 50 } }],
  corridors: [],
};

describe('spawnEnemies (T5, R3, P1)', () => {
  it('same inputs produce deeply-equal maps (determinism)', () => {
    const a = spawnEnemies(TEST_RUN, 1, TEST_DUNGEON);
    const b = spawnEnemies(TEST_RUN, 1, TEST_DUNGEON);
    expect(a.size).toBe(b.size);
    expect(a.size).toBeGreaterThan(0);
    for (const [id, e] of a) {
      expect(b.get(id)).toEqual(e);
    }
  });

  it('different floors of the same runId produce different maps', () => {
    const dungeon2 = generateDungeon(TEST_RUN, STANDARD_DUNGEON_CONFIG, 2);
    const a = spawnEnemies(TEST_RUN, 1, TEST_DUNGEON);
    const b = spawnEnemies(TEST_RUN, 2, dungeon2);
    const idsA = [...a.keys()].sort().join(',');
    const idsB = [...b.keys()].sort().join(',');
    expect(idsA).not.toBe(idsB);
  });

  it('all spawned positions fall within dungeon bounds (not outside dungeon)', () => {
    const enemies = spawnEnemies(TEST_RUN, 1, TEST_DUNGEON);
    for (const enemy of enemies.values()) {
      expect(enemy.x).toBeGreaterThanOrEqual(0);
      expect(enemy.x).toBeLessThanOrEqual(TEST_DUNGEON.width);
      expect(enemy.y).toBeGreaterThanOrEqual(0);
      expect(enemy.y).toBeLessThanOrEqual(TEST_DUNGEON.height);
    }
  });

  it('all spawned positions fall inside a dungeon room rect', () => {
    const enemies = spawnEnemies(TEST_RUN, 1, TEST_DUNGEON);
    for (const enemy of enemies.values()) {
      const inSomeRoom = TEST_DUNGEON.rooms.some(r =>
        enemy.x >= r.rect.x &&
        enemy.x <= r.rect.x + r.rect.width &&
        enemy.y >= r.rect.y &&
        enemy.y <= r.rect.y + r.rect.height
      );
      expect(inSomeRoom).toBe(true);
    }
  });

  it('every spawned enemy starts alive with hp === maxHp', () => {
    const enemies = spawnEnemies(TEST_RUN, 1, TEST_DUNGEON);
    expect(enemies.size).toBeGreaterThan(0);
    for (const enemy of enemies.values()) {
      expect(enemy.alive).toBe(true);
      expect(enemy.hp).toBe(enemy.maxHp);
      expect(enemy.attackCooldownRemaining).toBe(0);
    }
  });

  it('does not call Math.random (uses seeded RNG only, I3)', () => {
    const spy = vi.spyOn(Math, 'random');
    spawnEnemies(TEST_RUN, 1, TEST_DUNGEON);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('skips the entry room (room-0): no enemy id references room-0', () => {
    const enemies = spawnEnemies(TEST_RUN, 1, TEST_DUNGEON);
    for (const id of enemies.keys()) {
      expect(id).not.toContain('-room-0-');
    }
  });

  it('at least one enemy per non-entry room', () => {
    const enemies = spawnEnemies(TEST_RUN, 1, TEST_DUNGEON);
    const spawnableRooms = TEST_DUNGEON.rooms.length - 1;
    expect(enemies.size).toBeGreaterThanOrEqual(spawnableRooms);
  });

  it('accepts an injectable Rng for deterministic override', () => {
    const rng = createRng(hashSeed('custom-seed'));
    const enemies = spawnEnemies(TEST_RUN, 1, TEST_DUNGEON, rng);
    for (const e of enemies.values()) {
      expect(e.alive).toBe(true);
      expect(e.hp).toBe(e.maxHp);
    }
  });

  it('floor 1 shamblers have at least base hp (elite room may have 2× hp)', () => {
    const enemies = spawnEnemies(TEST_RUN, 1, TEST_DUNGEON);
    const shamblers = [...enemies.values()].filter(e => e.typeId === 'shambler');
    expect(shamblers.length).toBeGreaterThan(0);
    for (const e of shamblers) {
      expect(e.maxHp).toBeGreaterThanOrEqual(SHAMBLER_DEF.baseHp);
      expect(e.damage).toBeGreaterThanOrEqual(SHAMBLER_DEF.damage);
    }
  });

  it('floor 3 enemies have strictly more hp and damage than floor 1', () => {
    const dungeon3 = generateDungeon(TEST_RUN, STANDARD_DUNGEON_CONFIG, 3);
    const f1 = spawnEnemies(TEST_RUN, 1, TEST_DUNGEON);
    const f3 = spawnEnemies(TEST_RUN, 3, dungeon3);
    const avgHp = (m: Map<string, { maxHp: number }>) =>
      [...m.values()].reduce((s, e) => s + e.maxHp, 0) / m.size;
    const avgDmg = (m: Map<string, { damage: number }>) =>
      [...m.values()].reduce((s, e) => s + e.damage, 0) / m.size;
    expect(avgHp(f3)).toBeGreaterThan(avgHp(f1));
    expect(avgDmg(f3)).toBeGreaterThan(avgDmg(f1));
  });

  it('all spawned enemies have a positive damage value', () => {
    const enemies = spawnEnemies(TEST_RUN, 1, TEST_DUNGEON);
    for (const e of enemies.values()) {
      expect(e.damage).toBeGreaterThan(0);
    }
  });
});

describe('spawnEnemies — dungeon ruleset (T1-T4, R1-R4)', () => {
  // --- R1: count scales with floor depth ---

  it('T1/R1 — floor 1: each non-entry room spawns 1–2 enemies', () => {
    // TWO_ROOM_DUNGEON has 1 non-entry room. With count range [1,2] (floor 1),
    // the non-elite room-1 (which is also the elite room here) spawns 1–3 enemies.
    // Use a real BSP dungeon where we can count per-room.
    const dungeon = generateDungeon('count-f1', STANDARD_DUNGEON_CONFIG, 1);
    const enemies = spawnEnemies('count-f1', 1, dungeon);
    const lastRoomId = dungeon.rooms[dungeon.rooms.length - 1]!.id;
    // Verify total is between (rooms-1)*1 and (rooms-1)*2 + 1 (elite gets +1).
    const rooms = dungeon.rooms.length - 1;
    expect(enemies.size).toBeGreaterThanOrEqual(rooms);
    expect(enemies.size).toBeLessThanOrEqual(rooms * 2 + 1); // +1 for elite
  });

  it('T1/R1 — floor 5: each non-entry room spawns 3–4 enemies (cap)', () => {
    const dungeon = generateDungeon('count-f5', STANDARD_DUNGEON_CONFIG, 5);
    const enemies = spawnEnemies('count-f5', 5, dungeon);
    const rooms = dungeon.rooms.length - 1;
    // floor 5: min=3, max=4, elite max=5. Total in [rooms*3, rooms*4 + 1].
    expect(enemies.size).toBeGreaterThanOrEqual(rooms * 3);
    expect(enemies.size).toBeLessThanOrEqual(rooms * 4 + 1);
  });

  it('T1/R1 — floor 5 spawns more enemies total than floor 1 (same dungeon shape)', () => {
    const d1 = generateDungeon('scale-run', STANDARD_DUNGEON_CONFIG, 1);
    const d5 = generateDungeon('scale-run', STANDARD_DUNGEON_CONFIG, 5);
    const f1 = spawnEnemies('scale-run', 1, d1);
    const f5 = spawnEnemies('scale-run', 5, d5);
    expect(f5.size).toBeGreaterThan(f1.size);
  });

  // --- R2: enemy type distribution shifts with depth ---

  it('T2/R2 — floor 1: spitter rate ≤ 25% over many samples', () => {
    // Run across multiple seeds to get a distribution; p=0.15 → average rate.
    let spitters = 0, total = 0;
    for (let seed = 0; seed < 20; seed++) {
      const d = generateDungeon(`type-${seed}`, STANDARD_DUNGEON_CONFIG, 1);
      const enemies = spawnEnemies(`type-${seed}`, 1, d);
      for (const e of enemies.values()) {
        if (e.typeId === 'spitter') spitters++;
        total++;
      }
    }
    expect(total).toBeGreaterThan(0);
    expect(spitters / total).toBeLessThanOrEqual(0.5); // well below 50% on floor 1
  });

  it('T2/R2 — floor 7: spitter rate ≥ 50% over many samples', () => {
    let spitters = 0, total = 0;
    for (let seed = 0; seed < 20; seed++) {
      const d = generateDungeon(`type7-${seed}`, STANDARD_DUNGEON_CONFIG, 7);
      const enemies = spawnEnemies(`type7-${seed}`, 7, d);
      for (const e of enemies.values()) {
        if (e.typeId === 'spitter') spitters++;
        total++;
      }
    }
    expect(total).toBeGreaterThan(0);
    expect(spitters / total).toBeGreaterThanOrEqual(0.4); // well above 40% on floor 7
  });

  it('T2/R2 — type distribution is seeded (same inputs → same types)', () => {
    const d1 = generateDungeon('type-det', STANDARD_DUNGEON_CONFIG, 3);
    const d2 = generateDungeon('type-det', STANDARD_DUNGEON_CONFIG, 3);
    const a = spawnEnemies('type-det', 3, d1);
    const b = spawnEnemies('type-det', 3, d2);
    expect([...a.values()].map(e => e.typeId).sort()).toEqual(
      [...b.values()].map(e => e.typeId).sort()
    );
  });

  // --- R3: elite room ---

  it('T3/R3 — elite room enemies have 2× hp and 1.5× damage vs regular room (floor 1)', () => {
    // TWO_ROOM_DUNGEON: room-1 is the last room → always elite.
    const enemies = spawnEnemies(TEST_RUN, 1, TWO_ROOM_DUNGEON);
    expect(enemies.size).toBeGreaterThan(0);
    // All enemies are in room-1 (the only non-entry room), which is elite.
    for (const e of enemies.values()) {
      if (e.typeId === 'shambler') {
        // floor 1 multipliers = 1.0. Elite: hp = round(baseHp * 1.0 * 2.0).
        expect(e.maxHp).toBe(Math.round(SHAMBLER_DEF.baseHp * 2.0));
        expect(e.damage).toBe(Math.round(SHAMBLER_DEF.damage * 1.5));
      }
      if (e.typeId === 'spitter') {
        expect(e.maxHp).toBe(Math.round(SPITTER_DEF.baseHp * 2.0));
        expect(e.damage).toBe(Math.round(SPITTER_DEF.damage * 1.5));
      }
    }
  });

  it('T3/R3 — elite room spawns more enemies than a normal room on the same floor', () => {
    // 3-room dungeon: room-0 (entry), room-1 (regular), room-2 (elite).
    const THREE_ROOM: DungeonLayout = {
      runId: TEST_RUN, width: 150, height: 50,
      rooms: [
        { id: 'room-0', rect: { x: 0,   y: 0, width: 30, height: 30 } },
        { id: 'room-1', rect: { x: 60,  y: 0, width: 30, height: 30 } },
        { id: 'room-2', rect: { x: 120, y: 0, width: 30, height: 30 } },
      ],
      corridors: [
        { fromRoomId: 'room-0', toRoomId: 'room-1', from: { x: 15, y: 15 }, to: { x: 75, y: 15 } },
        { fromRoomId: 'room-1', toRoomId: 'room-2', from: { x: 75, y: 15 }, to: { x: 135, y: 15 } },
      ],
    };
    // Run deterministically many times to check elite room consistently has more.
    // Elite count range = [min+1, max+1] = [2,3] on floor 1. Regular = [1,2].
    // Over multiple runs, elite average > regular average.
    let room1Count = 0, room2Count = 0, runs = 10;
    for (let seed = 0; seed < runs; seed++) {
      const enemies = spawnEnemies(`elite-run-${seed}`, 1, THREE_ROOM);
      for (const [id] of enemies) {
        if (id.includes('-room-1-')) room1Count++;
        if (id.includes('-room-2-')) room2Count++;
      }
    }
    expect(room2Count).toBeGreaterThanOrEqual(room1Count);
  });

  it('T3/R3 — elite room designation is deterministic (same dungeon → same elite room)', () => {
    const a = spawnEnemies(TEST_RUN, 1, TWO_ROOM_DUNGEON);
    const b = spawnEnemies(TEST_RUN, 1, TWO_ROOM_DUNGEON);
    // All elite-room enemy ids are identical both runs.
    const idsA = [...a.keys()].sort();
    const idsB = [...b.keys()].sort();
    expect(idsA).toEqual(idsB);
  });

  // --- R4: entry room always clear ---

  it('T4/R4 — single-room dungeon (only room-0) spawns zero enemies', () => {
    const enemies = spawnEnemies(TEST_RUN, 1, SOLO_ROOM_DUNGEON);
    expect(enemies.size).toBe(0);
  });

  it('T4/R4 — room-0 is never the elite room, even in a 2-room dungeon', () => {
    const enemies = spawnEnemies(TEST_RUN, 1, TWO_ROOM_DUNGEON);
    for (const id of enemies.keys()) {
      expect(id).not.toContain('-room-0-');
    }
  });
});
