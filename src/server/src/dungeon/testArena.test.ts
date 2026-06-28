import { describe, it, expect, afterEach } from 'vitest';
import {
  isTestArenaEnabled,
  generateTestArenaDungeon,
  spawnTestArenaEnemies,
} from './testArena.js';
import { ENEMY_TYPES } from '@veins/shared';

const ENV_KEY = 'VEINS_TEST_ARENA';

afterEach(() => {
  delete process.env[ENV_KEY];
});

describe('test arena flag', () => {
  it('is disabled by default (production is the real game)', () => {
    delete process.env[ENV_KEY];
    expect(isTestArenaEnabled()).toBe(false);
  });

  it('enables on "1" or "true" only', () => {
    process.env[ENV_KEY] = '1';
    expect(isTestArenaEnabled()).toBe(true);
    process.env[ENV_KEY] = 'true';
    expect(isTestArenaEnabled()).toBe(true);
    process.env[ENV_KEY] = '0';
    expect(isTestArenaEnabled()).toBe(false);
    process.env[ENV_KEY] = 'yes';
    expect(isTestArenaEnabled()).toBe(false);
  });
});

describe('generateTestArenaDungeon', () => {
  it('is a single room with no corridors (instant traversal)', () => {
    const d = generateTestArenaDungeon('run-x');
    expect(d.rooms).toHaveLength(1);
    expect(d.corridors).toHaveLength(0);
    expect(d.rooms[0]!.id).toBe('room-0');
    expect(d.rooms[0]!.rect.width).toBeGreaterThan(0);
    expect(d.runId).toBe('run-x');
  });
});

describe('spawnTestArenaEnemies', () => {
  it('spawns exactly one enemy of each type', () => {
    const dungeon = generateTestArenaDungeon('run-x');
    const enemies = spawnTestArenaEnemies(1, dungeon);
    const types = [...enemies.values()].map(e => e.typeId).sort();
    expect(types).toEqual((Object.keys(ENEMY_TYPES) as string[]).sort());
    expect(enemies.size).toBe(Object.keys(ENEMY_TYPES).length);
  });

  it('all spawned enemies are alive, full-hp, and inside the room', () => {
    const dungeon = generateTestArenaDungeon('run-x');
    const room = dungeon.rooms[0]!.rect;
    for (const e of spawnTestArenaEnemies(1, dungeon).values()) {
      expect(e.alive).toBe(true);
      expect(e.hp).toBe(e.maxHp);
      expect(e.hp).toBe(ENEMY_TYPES[e.typeId].baseHp);
      expect(e.x).toBeGreaterThanOrEqual(room.x);
      expect(e.x).toBeLessThanOrEqual(room.x + room.width);
      expect(e.y).toBeGreaterThanOrEqual(room.y);
      expect(e.y).toBeLessThanOrEqual(room.y + room.height);
    }
  });
});
