import { describe, it, expect } from 'vitest';
import {
  evaluateRelicHit,
  evaluateIncomingDamage,
  WOUND_BURST_BONUS,
  BURST_SPLASH_RATIO,
  SHELL_REDUCTION,
  FILAMENT_CHAIN_RATIO,
  CORD_CHAIN_RATIO,
  SPINE_CHAIN_RATIO,
  HOLLOW_LENS_BONUS,
  HOLLOW_LENS_SPLASH_RATIO,
  VIGIL_BONUS,
  LATTICE_REDUCTION,
  LATTICE_SYNERGY_BONUS,
  VOTIVE_REDUCTION,
  VOTIVE_SYNERGY_REDUCTION,
} from './effects.js';
import { createRng } from '../rng/seeded.js';
import type { RelicBoard, SynergyMap } from '@testament/shared';
import type { EnemyState } from '../combat/types.js';

const PROJ_DMG = 10;
const P1 = 'player-1';
const P2 = 'player-2';

function makeBoard(relicId: string | null, playerId = P1): RelicBoard {
  return {
    slots: {
      '0,0': { coord: { q: 0, r: 0 }, ownerId: playerId, relicId },
    },
  };
}

function makeEnemy(id: string, hp: number, x = 0, y = 0): EnemyState {
  return { id, typeId: 'shambler', x, y, hp, maxHp: 20, damage: 15, alive: true, attackCooldownRemaining: 0 };
}

function noopRng(value: number) {
  return createRng(0);
}

// Deterministic RNG that always returns the given float on first call.
function fixedRng(value: number) {
  let calls = 0;
  return {
    float: () => { calls++; return value; },
    int: (min: number, max: number) => min,
    pick: <T>(items: readonly T[]) => items[0] as T,
  };
}

const EMPTY_ENEMIES = new Map<string, EnemyState>();
const NO_SYNERGY: SynergyMap = {};
const rng = createRng(42);

describe('evaluateRelicHit (T1, R1-R5)', () => {
  describe('blooming-wound base (R2)', () => {
    it('no blooming-wound: primaryDamage === baseDamage', () => {
      const result = evaluateRelicHit({
        board: makeBoard(null),
        synergyMap: NO_SYNERGY,
        attackerId: P1,
        baseDamage: PROJ_DMG,
        primaryEnemy: { id: 'e1', x: 0, y: 0, hp: 50 },
        allEnemies: EMPTY_ENEMIES,
        combatRng: rng,
      });
      expect(result.primaryDamage).toBe(PROJ_DMG);
    });

    it('blooming-wound placed: primaryDamage === baseDamage + WOUND_BURST_BONUS', () => {
      const result = evaluateRelicHit({
        board: makeBoard('blooming-wound'),
        synergyMap: NO_SYNERGY,
        attackerId: P1,
        baseDamage: PROJ_DMG,
        primaryEnemy: { id: 'e1', x: 0, y: 0, hp: 50 },
        allEnemies: EMPTY_ENEMIES,
        combatRng: rng,
      });
      expect(result.primaryDamage).toBe(PROJ_DMG + WOUND_BURST_BONUS);
    });

    it('blooming-wound owned by OTHER player: no bonus', () => {
      const board: RelicBoard = {
        slots: {
          '0,0': { coord: { q: 0, r: 0 }, ownerId: P2, relicId: 'blooming-wound' },
          '1,0': { coord: { q: 1, r: 0 }, ownerId: P1, relicId: null },
        },
      };
      const result = evaluateRelicHit({
        board,
        synergyMap: NO_SYNERGY,
        attackerId: P1,
        baseDamage: PROJ_DMG,
        primaryEnemy: { id: 'e1', x: 0, y: 0, hp: 50 },
        allEnemies: EMPTY_ENEMIES,
        combatRng: rng,
      });
      expect(result.primaryDamage).toBe(PROJ_DMG);
    });
  });

  describe('blooming-wound synergy (R3)', () => {
    it('synergy active: enemy within range gets splash', () => {
      const nearbyEnemy = makeEnemy('e2', 30, 20, 0); // 20 units away
      const allEnemies = new Map([['e2', nearbyEnemy]]);
      const result = evaluateRelicHit({
        board: makeBoard('blooming-wound'),
        synergyMap: { 'blooming-wound': true },
        attackerId: P1,
        baseDamage: PROJ_DMG,
        primaryEnemy: { id: 'e1', x: 0, y: 0, hp: 50 },
        allEnemies,
        combatRng: rng,
      });
      expect(result.splashHits).toHaveLength(1);
      const splash = result.splashHits[0]!;
      expect(splash.enemyId).toBe('e2');
      const expectedDmg = Math.floor((PROJ_DMG + WOUND_BURST_BONUS) * BURST_SPLASH_RATIO);
      expect(splash.newHp).toBe(Math.max(0, 30 - expectedDmg));
    });

    it('synergy active: enemy outside range not hit', () => {
      const farEnemy = makeEnemy('e2', 30, 100, 0); // 100 units away
      const result = evaluateRelicHit({
        board: makeBoard('blooming-wound'),
        synergyMap: { 'blooming-wound': true },
        attackerId: P1,
        baseDamage: PROJ_DMG,
        primaryEnemy: { id: 'e1', x: 0, y: 0, hp: 50 },
        allEnemies: new Map([['e2', farEnemy]]),
        combatRng: rng,
      });
      expect(result.splashHits).toHaveLength(0);
    });

    it('primary target not included in splashHits', () => {
      const primary = makeEnemy('e1', 50, 0, 0);
      const result = evaluateRelicHit({
        board: makeBoard('blooming-wound'),
        synergyMap: { 'blooming-wound': true },
        attackerId: P1,
        baseDamage: PROJ_DMG,
        primaryEnemy: { id: 'e1', x: 0, y: 0, hp: 50 },
        allEnemies: new Map([['e1', primary]]),
        combatRng: rng,
      });
      expect(result.splashHits.find(h => h.enemyId === 'e1')).toBeUndefined();
    });

    it('no synergy: splashHits is empty even with blooming-wound placed', () => {
      const nearby = makeEnemy('e2', 30, 10, 0);
      const result = evaluateRelicHit({
        board: makeBoard('blooming-wound'),
        synergyMap: {},   // not synergized
        attackerId: P1,
        baseDamage: PROJ_DMG,
        primaryEnemy: { id: 'e1', x: 0, y: 0, hp: 50 },
        allEnemies: new Map([['e2', nearby]]),
        combatRng: rng,
      });
      expect(result.splashHits).toHaveLength(0);
    });
  });

  describe('systemic-rot base (R4)', () => {
    it('systemic-rot placed: fireApplied === true', () => {
      const result = evaluateRelicHit({
        board: makeBoard('systemic-rot'),
        synergyMap: NO_SYNERGY,
        attackerId: P1,
        baseDamage: PROJ_DMG,
        primaryEnemy: { id: 'e1', x: 0, y: 0, hp: 50 },
        allEnemies: EMPTY_ENEMIES,
        combatRng: rng,
      });
      expect(result.fireApplied).toBe(true);
    });

    it('no systemic-rot: fireApplied === false', () => {
      const result = evaluateRelicHit({
        board: makeBoard(null),
        synergyMap: NO_SYNERGY,
        attackerId: P1,
        baseDamage: PROJ_DMG,
        primaryEnemy: { id: 'e1', x: 0, y: 0, hp: 50 },
        allEnemies: EMPTY_ENEMIES,
        combatRng: rng,
      });
      expect(result.fireApplied).toBe(false);
    });
  });

  describe('synaptic-filament base (R5)', () => {
    it('synaptic-filament placed + rng < 0.2: chainHit populated', () => {
      const nearby = makeEnemy('e2', 30, 50, 0);
      const result = evaluateRelicHit({
        board: makeBoard('synaptic-filament'),
        synergyMap: NO_SYNERGY,
        attackerId: P1,
        baseDamage: PROJ_DMG,
        primaryEnemy: { id: 'e1', x: 0, y: 0, hp: 50 },
        allEnemies: new Map([['e2', nearby]]),
        combatRng: fixedRng(0.1), // below threshold
      });
      expect(result.chainHit).not.toBeNull();
      expect(result.chainHit!.enemyId).toBe('e2');
      const expectedDmg = Math.floor(PROJ_DMG * FILAMENT_CHAIN_RATIO);
      expect(result.chainHit!.newHp).toBe(Math.max(0, 30 - expectedDmg));
    });

    it('synaptic-filament placed + rng >= 0.2: chainHit is null', () => {
      const nearby = makeEnemy('e2', 30, 50, 0);
      const result = evaluateRelicHit({
        board: makeBoard('synaptic-filament'),
        synergyMap: NO_SYNERGY,
        attackerId: P1,
        baseDamage: PROJ_DMG,
        primaryEnemy: { id: 'e1', x: 0, y: 0, hp: 50 },
        allEnemies: new Map([['e2', nearby]]),
        combatRng: fixedRng(0.5), // above threshold
      });
      expect(result.chainHit).toBeNull();
    });

    it('synaptic-filament chain: enemy outside range not targeted', () => {
      const farEnemy = makeEnemy('e2', 30, 200, 0);
      const result = evaluateRelicHit({
        board: makeBoard('synaptic-filament'),
        synergyMap: NO_SYNERGY,
        attackerId: P1,
        baseDamage: PROJ_DMG,
        primaryEnemy: { id: 'e1', x: 0, y: 0, hp: 50 },
        allEnemies: new Map([['e2', farEnemy]]),
        combatRng: fixedRng(0.0),
      });
      expect(result.chainHit).toBeNull();
    });

    it('no synaptic-filament: chainHit is always null', () => {
      const nearby = makeEnemy('e2', 30, 10, 0);
      const result = evaluateRelicHit({
        board: makeBoard(null),
        synergyMap: NO_SYNERGY,
        attackerId: P1,
        baseDamage: PROJ_DMG,
        primaryEnemy: { id: 'e1', x: 0, y: 0, hp: 50 },
        allEnemies: new Map([['e2', nearby]]),
        combatRng: fixedRng(0.0),
      });
      expect(result.chainHit).toBeNull();
    });
  });
});

describe('evaluateIncomingDamage (T1, R6)', () => {
  const noSynergy = {};

  it('calcified-shell placed: damage reduced by SHELL_REDUCTION', () => {
    const result = evaluateIncomingDamage({
      board: makeBoard('calcified-shell'),
      synergyMap: noSynergy,
      targetPlayerId: P1,
      rawDamage: 10,
    });
    expect(result).toBe(Math.max(1, 10 - SHELL_REDUCTION));
  });

  it('calcified-shell: minimum 1 even for low-damage attacks', () => {
    const result = evaluateIncomingDamage({
      board: makeBoard('calcified-shell'),
      synergyMap: noSynergy,
      targetPlayerId: P1,
      rawDamage: 3,
    });
    expect(result).toBe(1);
  });

  it('no calcified-shell: damage unchanged', () => {
    const result = evaluateIncomingDamage({
      board: makeBoard(null),
      synergyMap: noSynergy,
      targetPlayerId: P1,
      rawDamage: 10,
    });
    expect(result).toBe(10);
  });

  it('calcified-shell owned by OTHER player: no reduction for target', () => {
    const board: RelicBoard = {
      slots: {
        '0,0': { coord: { q: 0, r: 0 }, ownerId: P2, relicId: 'calcified-shell' },
        '1,0': { coord: { q: 1, r: 0 }, ownerId: P1, relicId: null },
      },
    };
    const result = evaluateIncomingDamage({
      board,
      synergyMap: noSynergy,
      targetPlayerId: P1,
      rawDamage: 10,
    });
    expect(result).toBe(10);
  });

  it('latticed-node: reduces by LATTICE_REDUCTION', () => {
    const result = evaluateIncomingDamage({
      board: makeBoard('latticed-node'),
      synergyMap: noSynergy,
      targetPlayerId: P1,
      rawDamage: 10,
    });
    expect(result).toBe(Math.max(1, 10 - LATTICE_REDUCTION));
  });

  it('latticed-node synergy: bonus reduction applied', () => {
    const result = evaluateIncomingDamage({
      board: makeBoard('latticed-node'),
      synergyMap: { 'latticed-node': true },
      targetPlayerId: P1,
      rawDamage: 15,
    });
    expect(result).toBe(Math.max(1, 15 - LATTICE_REDUCTION - LATTICE_SYNERGY_BONUS));
  });

  it('calcified-shell + latticed-node: reductions stack', () => {
    const board: RelicBoard = {
      slots: {
        '0,0': { coord: { q: 0, r: 0 }, ownerId: P1, relicId: 'calcified-shell' },
        '1,0': { coord: { q: 1, r: 0 }, ownerId: P1, relicId: 'latticed-node' },
      },
    };
    const result = evaluateIncomingDamage({
      board,
      synergyMap: noSynergy,
      targetPlayerId: P1,
      rawDamage: 20,
    });
    expect(result).toBe(Math.max(1, 20 - SHELL_REDUCTION - LATTICE_REDUCTION));
  });

  it('votive-tissue on adjacent P2 slot reduces damage for P1', () => {
    const board: RelicBoard = {
      slots: {
        '0,0': { coord: { q: 0, r: 0 }, ownerId: P1, relicId: null },
        '1,0': { coord: { q: 1, r: 0 }, ownerId: P2, relicId: 'votive-tissue' },
      },
    };
    const result = evaluateIncomingDamage({
      board,
      synergyMap: noSynergy,
      targetPlayerId: P1,
      rawDamage: 10,
    });
    expect(result).toBe(Math.max(1, 10 - VOTIVE_REDUCTION));
  });

  it('votive-tissue synergy: higher reduction for adjacent player', () => {
    const board: RelicBoard = {
      slots: {
        '0,0': { coord: { q: 0, r: 0 }, ownerId: P1, relicId: null },
        '1,0': { coord: { q: 1, r: 0 }, ownerId: P2, relicId: 'votive-tissue' },
      },
    };
    const result = evaluateIncomingDamage({
      board,
      synergyMap: { 'votive-tissue': true },
      targetPlayerId: P1,
      rawDamage: 10,
    });
    expect(result).toBe(Math.max(1, 10 - VOTIVE_SYNERGY_REDUCTION));
  });

  it('votive-tissue on non-adjacent slot: no effect', () => {
    const board: RelicBoard = {
      slots: {
        '0,0': { coord: { q: 0, r: 0 }, ownerId: P1, relicId: null },
        '5,5': { coord: { q: 5, r: 5 }, ownerId: P2, relicId: 'votive-tissue' },
      },
    };
    const result = evaluateIncomingDamage({
      board,
      synergyMap: noSynergy,
      targetPlayerId: P1,
      rawDamage: 10,
    });
    expect(result).toBe(10);
  });
});

// --- New relic tests ---

function hitParams(relicId: string, synergy: SynergyMap = NO_SYNERGY, extras?: { fireDurations?: Map<string, number> }) {
  return {
    board: makeBoard(relicId),
    synergyMap: synergy,
    attackerId: P1,
    baseDamage: PROJ_DMG,
    primaryEnemy: { id: 'e1', x: 0, y: 0, hp: 50 },
    // e2 is chain target (10 units from e1); e3 is outside hollow-lens splash (40 from e1)
    // but within chain-splash range of e2 (30 units, within both resonant-cord and chorus-spine splash)
    allEnemies: new Map([
      ['e1', makeEnemy('e1', 50, 0, 0)],
      ['e2', makeEnemy('e2', 30, 10, 0)],
      ['e3', makeEnemy('e3', 20, 40, 0)],
    ]),
    combatRng: fixedRng(0), // 0 < any chain chance → always triggers
    ...extras,
  };
}

describe('hollow-lens', () => {
  it('base: adds HOLLOW_LENS_BONUS flat damage', () => {
    const r = evaluateRelicHit(hitParams('hollow-lens'));
    expect(r.primaryDamage).toBe(PROJ_DMG + HOLLOW_LENS_BONUS);
  });

  it('base: no splash without synergy', () => {
    const r = evaluateRelicHit(hitParams('hollow-lens', NO_SYNERGY));
    expect(r.splashHits).toHaveLength(0);
  });

  it('synergy: nearby enemy receives splash damage', () => {
    const r = evaluateRelicHit(hitParams('hollow-lens', { 'hollow-lens': true }));
    const splashDmg = Math.floor((PROJ_DMG + HOLLOW_LENS_BONUS) * HOLLOW_LENS_SPLASH_RATIO);
    expect(r.splashHits).toHaveLength(1);
    expect(r.splashHits[0]!.newHp).toBe(Math.max(0, 30 - splashDmg));
  });
});

describe('resonant-cord', () => {
  it('base: chains to nearest enemy (rng=0 → always triggers)', () => {
    const r = evaluateRelicHit(hitParams('resonant-cord'));
    expect(r.chainHit).not.toBeNull();
    expect(r.chainHit!.enemyId).toBe('e2');
    expect(r.chainHit!.newHp).toBe(Math.max(0, 30 - Math.floor(PROJ_DMG * CORD_CHAIN_RATIO)));
  });

  it('base: no chain when rng exceeds CORD_CHAIN_CHANCE', () => {
    const params = { ...hitParams('resonant-cord'), combatRng: fixedRng(1) };
    const r = evaluateRelicHit(params);
    expect(r.chainHit).toBeNull();
  });

  it('synergy: chain also produces splash hits', () => {
    const r = evaluateRelicHit(hitParams('resonant-cord', { 'resonant-cord': true }));
    expect(r.chainHit).not.toBeNull();
    // splash is around the chain target (e2 at 10,0), and there's only the primary (e1 at 0,0)
    // distance 10 which is within CORD_SPLASH_RANGE=35
    expect(r.splashHits.length).toBeGreaterThan(0);
  });
});

describe('chorus-spine', () => {
  it('base: chains to nearest enemy (rng=0 → always triggers)', () => {
    const r = evaluateRelicHit(hitParams('chorus-spine'));
    expect(r.chainHit).not.toBeNull();
    expect(r.chainHit!.newHp).toBe(Math.max(0, 30 - Math.floor(PROJ_DMG * SPINE_CHAIN_RATIO)));
  });

  it('synergy: chain produces splash', () => {
    const r = evaluateRelicHit(hitParams('chorus-spine', { 'chorus-spine': true }));
    expect(r.chainHit).not.toBeNull();
    expect(r.splashHits.length).toBeGreaterThan(0);
  });
});

describe('still-vigil', () => {
  it('base: no bonus when target is not bleeding', () => {
    const r = evaluateRelicHit(hitParams('still-vigil'));
    expect(r.primaryDamage).toBe(PROJ_DMG);
  });

  it('base: +VIGIL_BONUS when target is bleeding', () => {
    const fd = new Map([['e1', 2.0]]);
    const r = evaluateRelicHit(hitParams('still-vigil', NO_SYNERGY, { fireDurations: fd }));
    expect(r.primaryDamage).toBe(PROJ_DMG + VIGIL_BONUS);
  });

  it('synergy: extends bleed duration when target is bleeding', () => {
    const fd = new Map([['e1', 1.5]]);
    evaluateRelicHit(hitParams('still-vigil', { 'still-vigil': true }, { fireDurations: fd }));
    expect(fd.get('e1')).toBeGreaterThan(1.5);
  });
});
