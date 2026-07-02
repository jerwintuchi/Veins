import type { ServerPlayerEntry } from './types.js';

// Pure function. Assigns leader to the earliest-joined (index 0) remaining player.
export function reassignLeader(players: ServerPlayerEntry[]): ServerPlayerEntry[] {
  if (players.length === 0) return [];
  return players.map((p, i) => ({ ...p, isLeader: i === 0 }));
}
