import type { RelicBoard, SynergyMap, RelicId, PlayerId } from '@testament/shared';
import { hexCoordKey, hexNeighbors } from '@testament/shared';
import type { Rng } from '../rng/seeded.js';
import type { EnemyState } from '../combat/types.js';

// --- blooming-wound ---
export const WOUND_BURST_BONUS      = 5;
export const BURST_SPLASH_RANGE     = 40;
export const BURST_SPLASH_RATIO     = 0.5;
// --- systemic-rot (DoT) ---
export const DOT_DURATION_S         = 3;
export const DOT_DAMAGE_PER_SECOND  = 3;
// --- synaptic-filament ---
export const FILAMENT_CHAIN_CHANCE  = 0.2;
export const FILAMENT_CHAIN_RANGE   = 80;
export const FILAMENT_CHAIN_RATIO   = 0.6;
// --- calcified-shell ---
export const SHELL_REDUCTION        = 5;
// --- resonant-cord ---
export const CORD_CHAIN_CHANCE      = 0.3;
export const CORD_CHAIN_RANGE       = 80;
export const CORD_CHAIN_RATIO       = 0.6;
export const CORD_SPLASH_RANGE      = 35;
export const CORD_SPLASH_RATIO      = 0.35;
// --- votive-tissue ---
export const VOTIVE_REDUCTION             = 2;
export const VOTIVE_SYNERGY_REDUCTION     = 4;
// --- hollow-lens ---
export const HOLLOW_LENS_BONUS        = 4;
export const HOLLOW_LENS_SPLASH_RANGE = 30;
export const HOLLOW_LENS_SPLASH_RATIO = 0.4;
// --- chorus-spine ---
export const SPINE_CHAIN_CHANCE      = 0.15;
export const SPINE_CHAIN_RANGE       = 80;
export const SPINE_CHAIN_RATIO       = 0.6;
export const SPINE_SPLASH_RANGE      = 30;
export const SPINE_SPLASH_RATIO      = 0.3;
// --- latticed-node ---
export const LATTICE_REDUCTION       = 6;
export const LATTICE_SYNERGY_BONUS   = 3;
// --- still-vigil ---
export const VIGIL_BONUS             = 8;
export const VIGIL_DURATION_BONUS    = 1.5;

export type RelicHitResult = {
  primaryDamage: number;
  splashHits: Array<{ enemyId: string; newHp: number }>;
  fireApplied: boolean;
  chainHit: { enemyId: string; newHp: number } | null;
};

function relicsOwnedBy(board: RelicBoard, playerId: PlayerId): Set<RelicId> {
  const ids = new Set<RelicId>();
  for (const slot of Object.values(board.slots)) {
    if (slot.ownerId === playerId && slot.relicId !== null) ids.add(slot.relicId);
  }
  return ids;
}

function euclidean(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

// Returns true if targetPlayerId has any board slot adjacent to a slot
// owned by a different player that contains the given relicId.
function hasAdjacentRelicFromOtherPlayer(
  board: RelicBoard,
  targetPlayerId: PlayerId,
  relicId: RelicId,
): boolean {
  for (const slot of Object.values(board.slots)) {
    if (slot.ownerId !== targetPlayerId) continue;
    for (const neighborCoord of hexNeighbors(slot.coord)) {
      const key = hexCoordKey(neighborCoord);
      const neighbor = board.slots[key];
      if (neighbor && neighbor.ownerId !== targetPlayerId && neighbor.relicId === relicId) {
        return true;
      }
    }
  }
  return false;
}

// Finds the nearest alive enemy within range (excluding primaryEnemyId).
function nearestEnemy(
  primaryX: number, primaryY: number,
  primaryEnemyId: string,
  allEnemies: Map<string, EnemyState>,
  range: number,
): string | null {
  let nearestId: string | null = null;
  let nearestDist = Infinity;
  for (const [eid, enemy] of allEnemies) {
    if (!enemy.alive || eid === primaryEnemyId) continue;
    const d = euclidean(enemy.x, enemy.y, primaryX, primaryY);
    if (d <= range && d < nearestDist) {
      nearestDist = d;
      nearestId = eid;
    }
  }
  return nearestId;
}

// Pure, server-only (I1, I5). Computes all relic effects for a single
// projectile hit. Callers must apply returned hp values to room state.
export function evaluateRelicHit(params: {
  board: RelicBoard;
  synergyMap: SynergyMap;
  attackerId: PlayerId;
  baseDamage: number;
  primaryEnemy: { id: string; x: number; y: number; hp: number };
  allEnemies: Map<string, EnemyState>;
  combatRng: Rng;
  fireDurations?: Map<string, number>; // passed so still-vigil can extend DoT duration
}): RelicHitResult {
  const { board, synergyMap, attackerId, baseDamage, primaryEnemy, allEnemies, combatRng, fireDurations } = params;
  const owned = relicsOwnedBy(board, attackerId);

  // --- Flat damage bonuses ---
  let primaryDamage = baseDamage;
  if (owned.has('blooming-wound')) primaryDamage += WOUND_BURST_BONUS;
  if (owned.has('hollow-lens'))   primaryDamage += HOLLOW_LENS_BONUS;
  if (owned.has('still-vigil') && (fireDurations?.has(primaryEnemy.id) ?? false)) {
    primaryDamage += VIGIL_BONUS;
  }

  const splashHits: Array<{ enemyId: string; newHp: number }> = [];

  // --- Splash effects ---
  function addSplash(range: number, ratio: number) {
    const splashDmg = Math.floor(primaryDamage * ratio);
    for (const [eid, enemy] of allEnemies) {
      if (!enemy.alive || eid === primaryEnemy.id) continue;
      const d = euclidean(enemy.x, enemy.y, primaryEnemy.x, primaryEnemy.y);
      if (d <= range && !splashHits.some(s => s.enemyId === eid)) {
        splashHits.push({ enemyId: eid, newHp: Math.max(0, enemy.hp - splashDmg) });
      }
    }
  }

  if (owned.has('blooming-wound') && synergyMap['blooming-wound'] === true) {
    addSplash(BURST_SPLASH_RANGE, BURST_SPLASH_RATIO);
  }
  if (owned.has('hollow-lens') && synergyMap['hollow-lens'] === true) {
    addSplash(HOLLOW_LENS_SPLASH_RANGE, HOLLOW_LENS_SPLASH_RATIO);
  }

  // --- DoT (systemic-rot) ---
  let fireApplied = owned.has('systemic-rot');
  if (owned.has('still-vigil') && synergyMap['still-vigil'] === true && fireDurations?.has(primaryEnemy.id)) {
    const current = fireDurations.get(primaryEnemy.id)!;
    fireDurations.set(primaryEnemy.id, current + VIGIL_DURATION_BONUS);
  }

  // --- Chain effects (synaptic-filament, resonant-cord, chorus-spine) ---
  let chainHit: { enemyId: string; newHp: number } | null = null;

  function tryChain(chance: number, range: number, ratio: number, addSplashOnChain: boolean, splashRange: number, splashRatio: number) {
    if (chainHit !== null) return; // only one chain per hit
    if (combatRng.float() >= chance) return;
    const nearestId = nearestEnemy(primaryEnemy.x, primaryEnemy.y, primaryEnemy.id, allEnemies, range);
    if (nearestId === null) return;
    const target = allEnemies.get(nearestId)!;
    const chainDmg = Math.floor(primaryDamage * ratio);
    chainHit = { enemyId: nearestId, newHp: Math.max(0, target.hp - chainDmg) };
    if (addSplashOnChain) {
      const chainSplashDmg = Math.floor(primaryDamage * splashRatio);
      for (const [eid, enemy] of allEnemies) {
        if (!enemy.alive || eid === nearestId || eid === primaryEnemy.id) continue;
        const d = euclidean(enemy.x, enemy.y, target.x, target.y);
        if (d <= splashRange && !splashHits.some(s => s.enemyId === eid)) {
          splashHits.push({ enemyId: eid, newHp: Math.max(0, enemy.hp - chainSplashDmg) });
        }
      }
    }
  }

  if (owned.has('synaptic-filament')) {
    tryChain(FILAMENT_CHAIN_CHANCE, FILAMENT_CHAIN_RANGE, FILAMENT_CHAIN_RATIO, false, 0, 0);
  }
  if (owned.has('resonant-cord')) {
    const cordSplash = synergyMap['resonant-cord'] === true;
    tryChain(CORD_CHAIN_CHANCE, CORD_CHAIN_RANGE, CORD_CHAIN_RATIO, cordSplash, CORD_SPLASH_RANGE, CORD_SPLASH_RATIO);
  }
  if (owned.has('chorus-spine')) {
    const spineSplash = synergyMap['chorus-spine'] === true;
    tryChain(SPINE_CHAIN_CHANCE, SPINE_CHAIN_RANGE, SPINE_CHAIN_RATIO, spineSplash, SPINE_SPLASH_RANGE, SPINE_SPLASH_RATIO);
  }

  return { primaryDamage, splashHits, fireApplied, chainHit };
}

// Pure incoming-damage reducer. Returns the damage after all shield effects.
// chorusVotiveBonus: when true (Chorus doctrine tier-1), votive-tissue protection is doubled.
export function evaluateIncomingDamage(params: {
  board: RelicBoard;
  synergyMap: SynergyMap;
  targetPlayerId: PlayerId;
  rawDamage: number;
  chorusVotiveBonus?: boolean;
}): number {
  const { board, synergyMap, targetPlayerId, rawDamage, chorusVotiveBonus } = params;
  const owned = relicsOwnedBy(board, targetPlayerId);

  let reduction = 0;

  // calcified-shell: flat reduction
  if (owned.has('calcified-shell')) reduction += SHELL_REDUCTION;

  // latticed-node: flat reduction; synergy with any shield relic from different player → bonus
  if (owned.has('latticed-node')) {
    const bonus = synergyMap['latticed-node'] === true ? LATTICE_SYNERGY_BONUS : 0;
    reduction += LATTICE_REDUCTION + bonus;
  }

  // votive-tissue (from a different player adjacent on the board): targetPlayer benefits if
  // any of their slots is hex-adjacent to a votive-tissue slot owned by someone else.
  if (hasAdjacentRelicFromOtherPlayer(board, targetPlayerId, 'votive-tissue')) {
    const base = synergyMap['votive-tissue'] === true ? VOTIVE_SYNERGY_REDUCTION : VOTIVE_REDUCTION;
    reduction += chorusVotiveBonus ? base * 2 : base;
  }

  return Math.max(1, rawDamage - reduction);
}
