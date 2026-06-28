import { describe, it, expect } from 'vitest';
import { selectAutoAimTarget, AUTO_AIM_RANGE } from './autoAim.js';
import { SHAMBLER_DEF } from '@testament/shared';
import type { EnemyState } from './types.js';

function makeEnemy(id: string, x: number, y: number, alive = true): EnemyState {
  return {
    id, typeId: 'shambler', x, y,
    hp: SHAMBLER_DEF.baseHp, maxHp: SHAMBLER_DEF.baseHp,
    damage: SHAMBLER_DEF.damage,
    alive, attackCooldownRemaining: 0,
  };
}

const ORIGIN = { x: 0, y: 0 };

describe('selectAutoAimTarget (T4, R5)', () => {
  it('returns null for an empty enemy map', () => {
    expect(selectAutoAimTarget(ORIGIN, new Map())).toBeNull();
  });

  it('returns null when all enemies are dead', () => {
    const enemies = new Map([
      ['e1', makeEnemy('e1', 50, 0, false)],
      ['e2', makeEnemy('e2', 80, 0, false)],
    ]);
    expect(selectAutoAimTarget(ORIGIN, enemies)).toBeNull();
  });

  it('returns null when no alive enemy is within AUTO_AIM_RANGE', () => {
    const enemies = new Map([['e1', makeEnemy('e1', AUTO_AIM_RANGE + 1, 0)]]);
    expect(selectAutoAimTarget(ORIGIN, enemies)).toBeNull();
  });

  it('returns the id of the nearest alive enemy within range', () => {
    const enemies = new Map([
      ['near', makeEnemy('near', 50, 0)],
      ['far',  makeEnemy('far', 200, 0)],
    ]);
    expect(selectAutoAimTarget(ORIGIN, enemies)).toBe('near');
  });

  it('ignores dead enemies even when they are closer', () => {
    const enemies = new Map([
      ['dead',  makeEnemy('dead', 10, 0, false)],
      ['alive', makeEnemy('alive', 100, 0, true)],
    ]);
    expect(selectAutoAimTarget(ORIGIN, enemies)).toBe('alive');
  });

  it('returns a result exactly at AUTO_AIM_RANGE (boundary inclusive)', () => {
    const enemies = new Map([['e1', makeEnemy('e1', AUTO_AIM_RANGE, 0)]]);
    expect(selectAutoAimTarget(ORIGIN, enemies)).toBe('e1');
  });

  it('is deterministic — same inputs produce the same output (P2)', () => {
    const enemies = new Map([
      ['e1', makeEnemy('e1', 50, 0)],
      ['e2', makeEnemy('e2', 100, 0)],
    ]);
    const a = selectAutoAimTarget(ORIGIN, enemies);
    const b = selectAutoAimTarget(ORIGIN, enemies);
    expect(a).toBe(b);
  });

  it('does not mutate the input enemy map', () => {
    const e = makeEnemy('e1', 50, 0);
    const before = JSON.stringify(e);
    const enemies = new Map([['e1', e]]);
    selectAutoAimTarget(ORIGIN, enemies);
    expect(JSON.stringify(enemies.get('e1'))).toBe(before);
  });
});
