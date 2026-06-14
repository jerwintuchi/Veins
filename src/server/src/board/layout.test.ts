import { describe, it, expect } from 'vitest';
import type { PlayerId } from '@veins/shared';
import { hexCoordKey, hexNeighbors } from '@veins/shared';
import { buildHexCoords, assignHomeQuadrants, buildInitialBoard } from './layout.js';

describe('buildHexCoords', () => {
  it('returns exactly 19 unique coords for radius 2', () => {
    const coords = buildHexCoords(2);
    expect(coords).toHaveLength(19);
    const keys = new Set(coords.map(hexCoordKey));
    expect(keys.size).toBe(19);
  });

  it('includes only coords within hex-distance of the radius', () => {
    const coords = buildHexCoords(2);
    for (const c of coords) {
      const dist = (Math.abs(c.q) + Math.abs(c.r) + Math.abs(c.q + c.r)) / 2;
      expect(dist).toBeLessThanOrEqual(2);
    }
  });

  it('includes the origin', () => {
    expect(buildHexCoords(2).some(c => c.q === 0 && c.r === 0)).toBe(true);
  });
});

describe('assignHomeQuadrants', () => {
  const coords = buildHexCoords(2);

  it('assigns every coord to exactly one player', () => {
    const players: PlayerId[] = ['p1', 'p2', 'p3'];
    const owners = assignHomeQuadrants(coords, players);
    expect(owners.size).toBe(coords.length);
    for (const coord of coords) {
      const owner = owners.get(hexCoordKey(coord));
      expect(players).toContain(owner);
    }
  });

  it('distributes slots across all players (no player left empty)', () => {
    for (const players of [['p1', 'p2'], ['p1', 'p2', 'p3'], ['p1', 'p2', 'p3', 'p4']] as PlayerId[][]) {
      const owners = assignHomeQuadrants(coords, players);
      const used = new Set(owners.values());
      for (const p of players) expect(used.has(p)).toBe(true);
    }
  });

  it('guarantees at least one cross-player adjacency (synergy is possible)', () => {
    const players: PlayerId[] = ['p1', 'p2'];
    const owners = assignHomeQuadrants(coords, players);
    const present = new Set(coords.map(hexCoordKey));

    let crossPairs = 0;
    for (const coord of coords) {
      const owner = owners.get(hexCoordKey(coord));
      for (const nb of hexNeighbors(coord)) {
        const nbKey = hexCoordKey(nb);
        if (!present.has(nbKey)) continue;
        if (owners.get(nbKey) !== owner) crossPairs++;
      }
    }
    expect(crossPairs).toBeGreaterThan(0);
  });

  it('is deterministic for the same players list', () => {
    const players: PlayerId[] = ['p1', 'p2', 'p3'];
    const a = assignHomeQuadrants(coords, players);
    const b = assignHomeQuadrants(coords, players);
    expect([...a.entries()].sort()).toEqual([...b.entries()].sort());
  });

  it('throws on an empty players list', () => {
    expect(() => assignHomeQuadrants(coords, [])).toThrow();
  });
});

describe('buildInitialBoard', () => {
  it('produces a 19-slot board with all slots owned and empty', () => {
    const board = buildInitialBoard(['p1', 'p2'], 2);
    const slots = Object.values(board.slots);
    expect(slots).toHaveLength(19);
    for (const slot of slots) {
      expect(slot.relicId).toBe(null);
      expect(['p1', 'p2']).toContain(slot.ownerId);
    }
  });
});
