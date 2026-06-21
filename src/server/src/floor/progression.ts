import type { DungeonConfig, FloorAdvancedEvent } from '@veins/shared';
import { advanceFloor, type Room } from '../room/state.js';
import { generateDungeon, STANDARD_DUNGEON_CONFIG } from '../dungeon/bsp.js';

// Descends the party to the next floor. Reuses the pure `advanceFloor` for the
// floor/drain/board/clock carry-over (R1, R3), generates the new floor's
// dungeon (R2), and gates relic placement by entering the combat phase (R6).
// Mutates the room in place (the manager holds the reference).
export function descendFloor(
  room: Room,
  config: DungeonConfig = STANDARD_DUNGEON_CONFIG
): { ok: true; event: FloorAdvancedEvent } | { ok: false } {
  if (room.status !== 'in-progress') return { ok: false }; // R4

  const next = advanceFloor(room);
  room.floor = next.floor;
  room.bleedClock = next.bleedClock; // drainPerSecond raised; current preserved
  room.phase = 'combat';
  // room.board is intentionally untouched (R3).

  const dungeon = generateDungeon(room.runId, config, room.floor);
  return { ok: true, event: { floor: room.floor, dungeon } };
}
