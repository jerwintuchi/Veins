import type { PlayerState, DungeonLayout } from '@testament/shared';
import { PLAYER_SPEED } from '@testament/shared';
import { clampToWalkable } from '../dungeon/collision.js';

// Pure player movement. Normalizes the direction vector, then clamps the
// result to walkable area (rooms + corridors) with wall-slide support.
export function movePlayer(
  playerState: PlayerState,
  dx: number,
  dy: number,
  dt: number,
  dungeon: DungeonLayout,
  speed: number = PLAYER_SPEED
): PlayerState {
  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag === 0) return playerState;

  const nx = playerState.x + (dx / mag) * speed * dt;
  const ny = playerState.y + (dy / mag) * speed * dt;
  const { x, y } = clampToWalkable(playerState.x, playerState.y, nx, ny, dungeon);
  return { ...playerState, x, y };
}
