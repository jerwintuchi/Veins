import type { ServerPlayerEntry } from './types.js';

// Pure function. Returns true when all players are ready (vacuously true for empty).
export function allReady(players: ServerPlayerEntry[]): boolean {
  return players.every(p => p.readyState === true);
}
