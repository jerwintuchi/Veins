import { randomUUID } from 'node:crypto';
import type { ReconnectToken, ReconnectEntry } from './types.js';
import type { RoomCode } from '@testament/shared';

const TOKEN_TTL_MS = 120_000;

export class ReconnectTokenStore {
  // playerId → latest token (only one valid token per player at a time)
  private byPlayer = new Map<string, ReconnectToken>();
  private byToken = new Map<ReconnectToken, ReconnectEntry>();

  issue(playerId: string, roomCode: RoomCode): ReconnectToken {
    // Revoke any existing token for this player.
    const old = this.byPlayer.get(playerId);
    if (old !== undefined) this.byToken.delete(old);

    const token: ReconnectToken = randomUUID();
    const entry: ReconnectEntry = { token, playerId, roomCode, issuedAt: Date.now() };
    this.byToken.set(token, entry);
    this.byPlayer.set(playerId, token);
    return token;
  }

  resolve(token: ReconnectToken): ReconnectEntry | undefined {
    const entry = this.byToken.get(token);
    if (!entry) return undefined;
    if (Date.now() - entry.issuedAt > TOKEN_TTL_MS) {
      this.byToken.delete(token);
      this.byPlayer.delete(entry.playerId);
      return undefined;
    }
    return entry;
  }

  revoke(token: ReconnectToken): void {
    const entry = this.byToken.get(token);
    if (entry) this.byPlayer.delete(entry.playerId);
    this.byToken.delete(token);
  }
}
