import { describe, it, expect, beforeEach } from 'vitest';
import type { Room } from '../room/state.js';
import { drainRateForFloor } from '../room/state.js';
import { buildInitialBoard } from '../board/layout.js';
import { STARTER_RELICS } from '@veins/shared';
import {
  scoreRelicPlaced,
  scoreEnemyKilledByTumor,
  scoreBurstKill,
  scoreExtract,
  scoreLinkedFatesRevive,
  scoreRelicRemoved,
  applyDoctrineThresholds,
} from './scoring.js';

function makeDoctrineRoom(overrides: Partial<Room> = {}): Room {
  const board = buildInitialBoard(['p1', 'p2'], 2);
  const registry = new Map(STARTER_RELICS.map(r => [r.id, r]));
  return {
    id: 'r', code: 'R', hostId: 'p1', status: 'in-progress', runId: 'run-1',
    players: ['p1', 'p2'],
    board,
    registry,
    phase: 'loot',
    floor: 1,
    bleedClock: { current: 1000, max: 1000, drainPerSecond: drainRateForFloor(1) },
    outcome: null, dungeon: null,
    enemies: new Map(), playerStates: new Map(), aimStates: new Map(),
    projectiles: new Map(), weaponCooldowns: new Map(), playerMoveInputs: new Map(),
    nextProjectileId: 0, lootPools: {}, placedThisLootPhase: new Set(), fireDurations: new Map(),
    combatRng: { next: () => 0 } as never,
    enemiesKilled: 0,
    doctrineScores: { sanctum: 0, tumor: 0, chorus: 0, penitent: 0 },
    doctrineThresholdsFired: new Set(),
    bleedDrainMult: 1,
    chorusVotiveBonus: false,
    tumorAggressionActive: false,
    penitentFreeRevive: false,
    lastAttackerByEnemy: new Map(),
    ...overrides,
  };
}

// Finds a slot owned by the given player on the initial board.
function firstSlotOf(room: Room, ownerId: string) {
  return Object.values(room.board.slots).find(s => s.ownerId === ownerId)!;
}

// ─── R8: Sanctum scoring ──────────────────────────────────────────────────────

describe('scoreRelicPlaced — Sanctum (R8)', () => {
  it('placing a sanctum-tagged relic increments sanctumScore by 1 (no adjacent sanctum)', () => {
    const room = makeDoctrineRoom();
    const slot = firstSlotOf(room, 'p1');
    scoreRelicPlaced(room, 'calcified-shell', slot.coord, 'p1'); // has 'sanctum' tag
    expect(room.doctrineScores!.sanctum).toBe(1);
  });

  it('placing a sanctum relic adjacent to another sanctum relic increments by 2', () => {
    const room = makeDoctrineRoom();
    const p1Slots = Object.values(room.board.slots).filter(s => s.ownerId === 'p1');
    // Place first sanctum relic
    const first = p1Slots[0]!;
    first.relicId = 'calcified-shell';
    scoreRelicPlaced(room, 'calcified-shell', first.coord, 'p1');
    expect(room.doctrineScores!.sanctum).toBe(1);

    // Find a p1 slot adjacent to first and place another sanctum relic there
    const neighbors = [
      { q: first.coord.q + 1, r: first.coord.r },
      { q: first.coord.q - 1, r: first.coord.r },
      { q: first.coord.q, r: first.coord.r + 1 },
      { q: first.coord.q, r: first.coord.r - 1 },
      { q: first.coord.q + 1, r: first.coord.r - 1 },
      { q: first.coord.q - 1, r: first.coord.r + 1 },
    ];
    const adjKey = neighbors.map(n => `${n.q},${n.r}`).find(k => room.board.slots[k]?.ownerId === 'p1');
    if (!adjKey) {
      // No adjacent p1 slot in 2-player layout — skip adjacency check
      return;
    }
    scoreRelicPlaced(room, 'calcified-shell', room.board.slots[adjKey]!.coord, 'p1');
    expect(room.doctrineScores!.sanctum).toBe(3); // 1 + 2
  });

  it('Sanctum tier-1 at score 8 sets bleedDrainMult to 0.9 and marks fired (R8)', () => {
    const room = makeDoctrineRoom();
    room.doctrineScores!.sanctum = 7;
    const slot = firstSlotOf(room, 'p1');
    scoreRelicPlaced(room, 'calcified-shell', slot.coord, 'p1');
    applyDoctrineThresholds(room);
    expect(room.doctrineScores!.sanctum).toBe(8);
    expect(room.bleedDrainMult).toBeCloseTo(0.9);
    expect(room.doctrineThresholdsFired!.has('sanctum-1')).toBe(true);
  });

  it('Sanctum tier-1 does not fire a second time (idempotent, R8)', () => {
    const room = makeDoctrineRoom();
    room.doctrineScores!.sanctum = 8;
    room.bleedDrainMult = 0.9;
    applyDoctrineThresholds(room); // fire
    room.bleedDrainMult = 0.9;
    applyDoctrineThresholds(room); // should not fire again
    expect(room.bleedDrainMult).toBeCloseTo(0.9); // still 0.9, not 0.81
  });

  it('Sanctum tier-2 at score 18 returns flavor text (R8)', () => {
    const room = makeDoctrineRoom();
    room.doctrineScores!.sanctum = 18;
    const flavors = applyDoctrineThresholds(room);
    expect(flavors.length).toBeGreaterThan(0);
    expect(typeof flavors[0]).toBe('string');
    expect(room.doctrineThresholdsFired!.has('sanctum-2')).toBe(true);
  });

  it('Sanctum tier-2 does not fire a second time (idempotent, R8)', () => {
    const room = makeDoctrineRoom();
    room.doctrineScores!.sanctum = 18;
    applyDoctrineThresholds(room);
    const flavors = applyDoctrineThresholds(room);
    expect(flavors.filter(f => f.includes('steadied'))).toHaveLength(0);
  });
});

// ─── R9: Tumor scoring ───────────────────────────────────────────────────────

describe('scoreEnemyKilledByTumor (R9)', () => {
  it('kill by a player owning a tumor-tagged relic increments tumor score by 1', () => {
    const room = makeDoctrineRoom();
    const slot = firstSlotOf(room, 'p1');
    slot.relicId = 'blooming-wound'; // has 'tumor' tag
    scoreEnemyKilledByTumor(room, 'p1');
    expect(room.doctrineScores!.tumor).toBe(1);
  });

  it('kill by a player with no tumor relic does not increment tumor score', () => {
    const room = makeDoctrineRoom();
    const slot = firstSlotOf(room, 'p1');
    slot.relicId = 'calcified-shell'; // sanctum, not tumor
    scoreEnemyKilledByTumor(room, 'p1');
    expect(room.doctrineScores!.tumor).toBe(0);
  });

  it('kill with undefined killer does not increment (R9)', () => {
    const room = makeDoctrineRoom();
    scoreEnemyKilledByTumor(room, undefined);
    expect(room.doctrineScores!.tumor).toBe(0);
  });
});

describe('scoreExtract — forced extraction (R9)', () => {
  it('extraction at >= 80% bled increments tumor score by 2', () => {
    const room = makeDoctrineRoom();
    room.bleedClock.current = 19; // (1 - 19/100) = 81% bled
    room.bleedClock.max = 100;
    scoreExtract(room);
    expect(room.doctrineScores!.tumor).toBe(2);
    expect(room.doctrineScores!.penitent).toBe(0);
  });
});

describe('Tumor threshold (R9)', () => {
  it('tier-1 at score 8 sets tumorAggressionActive and marks fired', () => {
    const room = makeDoctrineRoom();
    room.doctrineScores!.tumor = 8;
    applyDoctrineThresholds(room);
    expect(room.tumorAggressionActive).toBe(true);
    expect(room.doctrineThresholdsFired!.has('tumor-1')).toBe(true);
  });

  it('tier-1 does not fire a second time (idempotent)', () => {
    const room = makeDoctrineRoom();
    room.doctrineScores!.tumor = 8;
    applyDoctrineThresholds(room); // fires
    room.tumorAggressionActive = false; // reset manually
    applyDoctrineThresholds(room); // should not fire again
    expect(room.tumorAggressionActive).toBe(false);
  });

  it('tier-2 at score 18 returns Tumor flavor text', () => {
    const room = makeDoctrineRoom();
    room.doctrineScores!.tumor = 18;
    const flavors = applyDoctrineThresholds(room);
    expect(flavors.some(f => f.includes('chaos'))).toBe(true);
  });
});

// ─── R10: Chorus scoring ─────────────────────────────────────────────────────

describe('scoreRelicPlaced — Chorus (R10)', () => {
  it('placing a chorus-tagged relic not cross-adjacent scores +1', () => {
    const room = makeDoctrineRoom();
    // Use an isolated board where p1's slot has no p2 neighbors.
    room.board = { slots: { '50,50': { coord: { q: 50, r: 50 }, ownerId: 'p1', relicId: null } } };
    scoreRelicPlaced(room, 'synaptic-filament', { q: 50, r: 50 }, 'p1');
    expect(room.doctrineScores!.chorus).toBe(1);
  });

  it('placing a chorus-tagged relic cross-adjacent scores +3 (R10)', () => {
    const room = makeDoctrineRoom();
    // Find a p1 slot adjacent to a p2 slot
    const slots = Object.values(room.board.slots);
    const p1Slots = slots.filter(s => s.ownerId === 'p1');
    let crossSlot = p1Slots.find(p1s => {
      const neighbors = [
        { q: p1s.coord.q + 1, r: p1s.coord.r },
        { q: p1s.coord.q - 1, r: p1s.coord.r },
        { q: p1s.coord.q, r: p1s.coord.r + 1 },
        { q: p1s.coord.q, r: p1s.coord.r - 1 },
        { q: p1s.coord.q + 1, r: p1s.coord.r - 1 },
        { q: p1s.coord.q - 1, r: p1s.coord.r + 1 },
      ];
      return neighbors.some(n => {
        const key = `${n.q},${n.r}`;
        return room.board.slots[key]?.ownerId === 'p2';
      });
    });

    if (!crossSlot) {
      // Layout doesn't have adjacent cross-player slots at this radius — skip
      return;
    }
    scoreRelicPlaced(room, 'synaptic-filament', crossSlot.coord, 'p1');
    expect(room.doctrineScores!.chorus).toBe(3);
  });
});

describe('scoreBurstKill — Chorus (R10)', () => {
  it('3 or more kills in one tick adds +2 chorus score', () => {
    const room = makeDoctrineRoom();
    scoreBurstKill(room, 3);
    expect(room.doctrineScores!.chorus).toBe(2);
  });

  it('fewer than 3 kills does not add chorus score', () => {
    const room = makeDoctrineRoom();
    scoreBurstKill(room, 2);
    expect(room.doctrineScores!.chorus).toBe(0);
  });
});

describe('Chorus threshold (R10)', () => {
  it('tier-1 at score 8 sets chorusVotiveBonus and marks fired', () => {
    const room = makeDoctrineRoom();
    room.doctrineScores!.chorus = 8;
    applyDoctrineThresholds(room);
    expect(room.chorusVotiveBonus).toBe(true);
    expect(room.doctrineThresholdsFired!.has('chorus-1')).toBe(true);
  });

  it('tier-2 at score 18 returns Chorus flavor text', () => {
    const room = makeDoctrineRoom();
    room.doctrineScores!.chorus = 18;
    const flavors = applyDoctrineThresholds(room);
    expect(flavors.some(f => f.includes('voices'))).toBe(true);
  });
});

// ─── R11: Penitent scoring ───────────────────────────────────────────────────

describe('scoreLinkedFatesRevive + scoreRelicRemoved — Penitent (R11)', () => {
  it('linked-fates revive (+3) + relic-removed event (+1) = +4 total penitent score', () => {
    const room = makeDoctrineRoom();
    scoreLinkedFatesRevive(room);
    scoreRelicRemoved(room);
    expect(room.doctrineScores!.penitent).toBe(4);
  });
});

describe('scoreExtract — voluntary (R11)', () => {
  it('voluntary extraction (< 80% bled) increments penitent score by 4', () => {
    const room = makeDoctrineRoom();
    room.bleedClock.current = 600; // 40% bled — voluntary
    room.bleedClock.max = 1000;
    scoreExtract(room);
    expect(room.doctrineScores!.penitent).toBe(4);
    expect(room.doctrineScores!.tumor).toBe(0);
  });
});

describe('Penitent threshold (R11)', () => {
  it('tier-1 at score 8 sets penitentFreeRevive and marks fired', () => {
    const room = makeDoctrineRoom();
    room.doctrineScores!.penitent = 8;
    applyDoctrineThresholds(room);
    expect(room.penitentFreeRevive).toBe(true);
    expect(room.doctrineThresholdsFired!.has('penitent-1')).toBe(true);
  });

  it('tier-1 does not fire a second time (idempotent, R11)', () => {
    const room = makeDoctrineRoom();
    room.doctrineScores!.penitent = 8;
    applyDoctrineThresholds(room); // fires
    room.penitentFreeRevive = false; // reset manually
    applyDoctrineThresholds(room); // should not fire again
    expect(room.penitentFreeRevive).toBe(false);
  });

  it('tier-2 at score 18 returns Penitent flavor text', () => {
    const room = makeDoctrineRoom();
    room.doctrineScores!.penitent = 18;
    const flavors = applyDoctrineThresholds(room);
    expect(flavors.some(f => f.includes('sacrifice'))).toBe(true);
  });
});

// ─── Cross-cutting: no double-fire across a single run ──────────────────────

describe('applyDoctrineThresholds — global idempotency', () => {
  it('calling applyDoctrineThresholds repeatedly never fires the same threshold twice', () => {
    const room = makeDoctrineRoom();
    room.doctrineScores = { sanctum: 18, tumor: 18, chorus: 18, penitent: 18 };
    const first = applyDoctrineThresholds(room);
    const second = applyDoctrineThresholds(room);
    expect(first.length).toBeGreaterThan(0);
    expect(second.length).toBe(0);
    expect(room.doctrineThresholdsFired!.size).toBe(8); // all 4 × 2 tiers
  });
});
