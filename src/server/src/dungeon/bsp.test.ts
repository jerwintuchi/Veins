import { describe, it, expect } from 'vitest';
import type { DungeonLayout, Rect } from '@veins/shared';
import { generateDungeon, STANDARD_DUNGEON_CONFIG } from './bsp.js';

// --- helpers ---

function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

function withinBounds(rect: Rect, width: number, height: number): boolean {
  return rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= width && rect.y + rect.height <= height;
}

// BFS over the room/corridor graph; returns the set of room ids reachable from start.
function reachableRooms(layout: DungeonLayout, start: string): Set<string> {
  const adj = new Map<string, string[]>();
  for (const room of layout.rooms) adj.set(room.id, []);
  for (const c of layout.corridors) {
    adj.get(c.fromRoomId)?.push(c.toRoomId);
    adj.get(c.toRoomId)?.push(c.fromRoomId);
  }
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    for (const next of adj.get(cur) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

// --- T3: rooms (bounds, non-overlap, count) ---

describe('generateDungeon — rooms (T3)', () => {
  it('produces at least 2 rooms for the standard config', () => {
    const layout = generateDungeon('run-rooms', STANDARD_DUNGEON_CONFIG);
    expect(layout.rooms.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps every room within map bounds (P2)', () => {
    const layout = generateDungeon('run-bounds', STANDARD_DUNGEON_CONFIG);
    for (const room of layout.rooms) {
      expect(withinBounds(room.rect, layout.width, layout.height)).toBe(true);
    }
  });

  it('produces no overlapping rooms (P3)', () => {
    const layout = generateDungeon('run-overlap', STANDARD_DUNGEON_CONFIG);
    const rooms = layout.rooms;
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const a = rooms[i]!.rect;
        const b = rooms[j]!.rect;
        expect(rectsOverlap(a, b)).toBe(false);
      }
    }
  });

  it('produces a stable room count for a fixed seed', () => {
    const a = generateDungeon('stable-seed', STANDARD_DUNGEON_CONFIG);
    const b = generateDungeon('stable-seed', STANDARD_DUNGEON_CONFIG);
    expect(a.rooms.length).toBe(b.rooms.length);
  });

  it('holds non-overlap and bounds across many distinct seeds', () => {
    for (let s = 0; s < 50; s++) {
      const layout = generateDungeon(`seed-${s}`, STANDARD_DUNGEON_CONFIG);
      for (const room of layout.rooms) {
        expect(withinBounds(room.rect, layout.width, layout.height)).toBe(true);
      }
      const rooms = layout.rooms;
      for (let i = 0; i < rooms.length; i++) {
        for (let j = i + 1; j < rooms.length; j++) {
          expect(rectsOverlap(rooms[i]!.rect, rooms[j]!.rect)).toBe(false);
        }
      }
    }
  });
});

// --- T4: corridors / connectivity ---

describe('generateDungeon — corridors & connectivity (T4)', () => {
  it('emits at least (room count - 1) corridors', () => {
    const layout = generateDungeon('run-corridors', STANDARD_DUNGEON_CONFIG);
    expect(layout.corridors.length).toBeGreaterThanOrEqual(layout.rooms.length - 1);
  });

  it('forms a fully connected room graph (P4)', () => {
    const layout = generateDungeon('run-connected', STANDARD_DUNGEON_CONFIG);
    const reached = reachableRooms(layout, layout.rooms[0]!.id);
    expect(reached.size).toBe(layout.rooms.length);
  });

  it('stays connected across many distinct seeds', () => {
    for (let s = 0; s < 50; s++) {
      const layout = generateDungeon(`conn-${s}`, STANDARD_DUNGEON_CONFIG);
      const reached = reachableRooms(layout, layout.rooms[0]!.id);
      expect(reached.size).toBe(layout.rooms.length);
    }
  });

  it('each corridor references two distinct, existing room ids', () => {
    const layout = generateDungeon('run-edges', STANDARD_DUNGEON_CONFIG);
    const ids = new Set(layout.rooms.map(r => r.id));
    for (const c of layout.corridors) {
      expect(c.fromRoomId).not.toBe(c.toRoomId);
      expect(ids.has(c.fromRoomId)).toBe(true);
      expect(ids.has(c.toRoomId)).toBe(true);
    }
  });
});

// --- T5: top-level assembly (determinism, perf) ---

describe('generateDungeon — assembly (T5)', () => {
  it('is deterministic: same runId + config -> deeply-equal layout (P1)', () => {
    const a = generateDungeon('determinism-check', STANDARD_DUNGEON_CONFIG);
    const b = generateDungeon('determinism-check', STANDARD_DUNGEON_CONFIG);
    expect(a).toEqual(b);
  });

  it('produces different layouts for different runIds', () => {
    const a = generateDungeon('run-A', STANDARD_DUNGEON_CONFIG);
    const b = generateDungeon('run-B', STANDARD_DUNGEON_CONFIG);
    expect(a.rooms).not.toEqual(b.rooms);
  });

  it('carries the runId and map dimensions into the layout', () => {
    const layout = generateDungeon('run-meta', STANDARD_DUNGEON_CONFIG);
    expect(layout.runId).toBe('run-meta');
    expect(layout.width).toBe(STANDARD_DUNGEON_CONFIG.width);
    expect(layout.height).toBe(STANDARD_DUNGEON_CONFIG.height);
  });

  it('is deterministic per (runId, floor) and varies by floor', () => {
    const f2a = generateDungeon('run-floors', STANDARD_DUNGEON_CONFIG, 2);
    const f2b = generateDungeon('run-floors', STANDARD_DUNGEON_CONFIG, 2);
    const f3 = generateDungeon('run-floors', STANDARD_DUNGEON_CONFIG, 3);
    expect(f2a).toEqual(f2b); // same (runId, floor) -> identical
    expect(f2a.rooms).not.toEqual(f3.rooms); // different floor -> different layout
  });

  it('treats an omitted floor as floor 1 and keeps the bare runId in the layout', () => {
    const implicit = generateDungeon('run-implicit', STANDARD_DUNGEON_CONFIG);
    const explicit = generateDungeon('run-implicit', STANDARD_DUNGEON_CONFIG, 1);
    expect(implicit).toEqual(explicit);
    expect(generateDungeon('run-implicit', STANDARD_DUNGEON_CONFIG, 5).runId).toBe('run-implicit');
  });

  it('generates well under the time budget (R6)', () => {
    // Target is < 5ms; assert a generous ceiling to stay non-flaky on slow CI.
    const start = performance.now();
    for (let i = 0; i < 20; i++) generateDungeon(`perf-${i}`, STANDARD_DUNGEON_CONFIG);
    const avgMs = (performance.now() - start) / 20;
    expect(avgMs).toBeLessThan(5);
  });
});
