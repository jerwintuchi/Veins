import type { RelicBoard, SynergyMap, PlayerId } from '@testament/shared';
import type { Room } from '../room/state.js';

// --- Doctrine flavor text (broadcast when each doctrine's tier-2 threshold fires) ---
const FLAVOR: Record<string, string> = {
  'sanctum-2': 'The wound holds. Something has steadied its breath.',
  'tumor-2':   'They thrive on the chaos. The dungeon breathes faster.',
  'chorus-2':  'All voices align. The pulse of the Veins responds.',
  'penitent-2': 'They gave freely. The Veins remember the weight of sacrifice.',
};

// --- Threshold definitions ---
// Each doctrine has tier-1 (mechanical effect) and tier-2 (flavor event, no mechanics).
const SANCTUM_TIER1 = 8;
const SANCTUM_TIER2 = 18;
const TUMOR_TIER1   = 8;
const TUMOR_TIER2   = 18;
const CHORUS_TIER1  = 8;
const CHORUS_TIER2  = 18;
const PENITENT_TIER1 = 8;
const PENITENT_TIER2 = 18;

// Increments a doctrine score; called by event-specific scorers below.
function increment(room: Room, doctrine: 'sanctum' | 'tumor' | 'chorus' | 'penitent', by: number): void {
  if (!room.doctrineScores) return;
  room.doctrineScores[doctrine] += by;
}

// Returns true if the given cross-player adjacency exists on the board (the relic
// at `coord` is adjacent to at least one slot owned by a different player).
function hasCrossPlayerAdjacency(board: RelicBoard, ownerId: PlayerId, coord: { q: number; r: number }): boolean {
  const neighbors = [
    { q: coord.q + 1, r: coord.r },
    { q: coord.q - 1, r: coord.r },
    { q: coord.q,     r: coord.r + 1 },
    { q: coord.q,     r: coord.r - 1 },
    { q: coord.q + 1, r: coord.r - 1 },
    { q: coord.q - 1, r: coord.r + 1 },
  ];
  for (const n of neighbors) {
    const key = `${n.q},${n.r}`;
    const slot = board.slots[key];
    if (slot && slot.ownerId !== ownerId) return true;
  }
  return false;
}

// Returns true if the slot at coord is adjacent to another sanctum-tagged relic.
function hasSanctumAdjacency(board: RelicBoard, coord: { q: number; r: number }, registry: Room['registry']): boolean {
  const neighbors = [
    { q: coord.q + 1, r: coord.r },
    { q: coord.q - 1, r: coord.r },
    { q: coord.q,     r: coord.r + 1 },
    { q: coord.q,     r: coord.r - 1 },
    { q: coord.q + 1, r: coord.r - 1 },
    { q: coord.q - 1, r: coord.r + 1 },
  ];
  for (const n of neighbors) {
    const key = `${n.q},${n.r}`;
    const slot = board.slots[key];
    if (!slot?.relicId) continue;
    const relic = registry.get(slot.relicId);
    if (relic?.tags.includes('sanctum')) return true;
  }
  return false;
}

// --- R8 (Sanctum) / R9 (Tumor) / R10 (Chorus): score on relic placement ---
export function scoreRelicPlaced(
  room: Room,
  relicId: string,
  coord: { q: number; r: number },
  ownerId: PlayerId,
): void {
  if (!room.doctrineScores) return;
  const relic = room.registry.get(relicId);
  if (!relic) return;
  const tags = relic.tags;

  if (tags.includes('sanctum')) {
    const bonus = hasSanctumAdjacency(room.board, coord, room.registry) ? 2 : 1;
    increment(room, 'sanctum', bonus);
  }

  if (tags.includes('tumor')) {
    increment(room, 'tumor', 1);
  }

  if (tags.includes('chorus')) {
    const cross = hasCrossPlayerAdjacency(room.board, ownerId, coord);
    increment(room, 'chorus', cross ? 3 : 1);
  }

  if (tags.includes('penitent')) {
    increment(room, 'penitent', 1);
  }
}

// --- R9 (Tumor): score when an enemy is killed by a player owning a tumor relic ---
export function scoreEnemyKilledByTumor(room: Room, killerPlayerId: PlayerId | undefined): void {
  if (!room.doctrineScores || !killerPlayerId) return;
  const hasTumor = Object.values(room.board.slots).some(
    s => s.ownerId === killerPlayerId && s.relicId !== null &&
      (room.registry.get(s.relicId)?.tags.includes('tumor') ?? false),
  );
  if (hasTumor) increment(room, 'tumor', 1);
}

// --- R10 (Chorus): 3+ enemies die in the same tick window ---
export function scoreBurstKill(room: Room, killCount: number): void {
  if (!room.doctrineScores) return;
  if (killCount >= 3) increment(room, 'chorus', 2);
}

// --- R11 (Penitent): score on voluntary extraction or linked-fates revive ---
// Voluntary extraction: Bleed Clock < 80% bled.
// Forced extraction: Bleed Clock >= 80% bled — also adds Tumor doctrine score.
export function scoreExtract(room: Room): void {
  if (!room.doctrineScores) return;
  const pctBled = 1 - room.bleedClock.current / room.bleedClock.max;
  if (pctBled >= 0.8) {
    // Forced extraction under duress (Tumor doctrine).
    increment(room, 'tumor', 2);
  } else {
    // Voluntary extraction (Penitent doctrine).
    increment(room, 'penitent', 4);
  }
}

// --- R11 (Penitent): relic sacrificed for Linked Fates revive ---
// The spec counts RELIC_REMOVED (+1) plus the revive itself (+3) = +4 total.
// We call this once from the revive handler with +3; the RELIC_REMOVED path adds +1.
export function scoreLinkedFatesRevive(room: Room): void {
  increment(room, 'penitent', 3);
}

// Penitent +1 for any RELIC_REMOVED event (used by linked-fates relic sacrifice).
export function scoreRelicRemoved(room: Room): void {
  increment(room, 'penitent', 1);
}

// --- Threshold application (call after any score increment) ---
// Returns an array of flavor text strings to broadcast as BOARD_DOCTRINE_SHIFT events.
// Each threshold fires at most once per run (guarded by doctrineThresholdsFired).
export function applyDoctrineThresholds(room: Room): string[] {
  const scores = room.doctrineScores;
  const fired = room.doctrineThresholdsFired;
  if (!scores || !fired) return [];

  const events: string[] = [];

  // Sanctum tier-1: slow bleed drain by 10%
  if (scores.sanctum >= SANCTUM_TIER1 && !fired.has('sanctum-1')) {
    fired.add('sanctum-1');
    room.bleedDrainMult = (room.bleedDrainMult ?? 1) * 0.9;
  }
  // Sanctum tier-2: flavor event
  if (scores.sanctum >= SANCTUM_TIER2 && !fired.has('sanctum-2')) {
    fired.add('sanctum-2');
    events.push(FLAVOR['sanctum-2']!);
  }

  // Tumor tier-1: enemies attack 15% faster
  if (scores.tumor >= TUMOR_TIER1 && !fired.has('tumor-1')) {
    fired.add('tumor-1');
    room.tumorAggressionActive = true;
  }
  // Tumor tier-2: flavor event
  if (scores.tumor >= TUMOR_TIER2 && !fired.has('tumor-2')) {
    fired.add('tumor-2');
    events.push(FLAVOR['tumor-2']!);
  }

  // Chorus tier-1: votive-tissue protection doubles
  if (scores.chorus >= CHORUS_TIER1 && !fired.has('chorus-1')) {
    fired.add('chorus-1');
    room.chorusVotiveBonus = true;
  }
  // Chorus tier-2: flavor event
  if (scores.chorus >= CHORUS_TIER2 && !fired.has('chorus-2')) {
    fired.add('chorus-2');
    events.push(FLAVOR['chorus-2']!);
  }

  // Penitent tier-1: free revive token
  if (scores.penitent >= PENITENT_TIER1 && !fired.has('penitent-1')) {
    fired.add('penitent-1');
    room.penitentFreeRevive = true;
  }
  // Penitent tier-2: flavor event
  if (scores.penitent >= PENITENT_TIER2 && !fired.has('penitent-2')) {
    fired.add('penitent-2');
    events.push(FLAVOR['penitent-2']!);
  }

  return events;
}
