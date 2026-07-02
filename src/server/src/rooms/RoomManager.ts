// Testament Phase 3 RoomManager. In-memory only — never persisted (I7).
import type { RoomCode } from '@testament/shared';
import type { RoomRecord, ServerPlayerEntry } from './types.js';
import { generateRoomCode } from './roomCode.js';
import { randomUUID } from 'node:crypto';

export class RoomManager {
  private rooms = new Map<RoomCode, RoomRecord>();

  private uniqueCode(): RoomCode {
    const active = new Set(this.rooms.keys());
    return generateRoomCode(active);
  }

  createRoom(socketId: string, displayName: string): RoomRecord {
    const code = this.uniqueCode();
    const playerId = randomUUID();
    const player: ServerPlayerEntry = {
      playerId,
      displayName,
      socketId,
      isLeader: true,
      readyState: false,
      disconnectedAt: null,
      perceivedChannels: [],
    };
    const room: RoomRecord = {
      code,
      phase: 'WAITING',
      players: [player],
      contract: null,
      fieldData: null,
      exposure: 0,
      revealedSigns: [],
    };
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code: RoomCode): RoomRecord | undefined {
    return this.rooms.get(code);
  }

  getRoomBySocketId(socketId: string): RoomRecord | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.some(p => p.socketId === socketId)) return room;
    }
    return undefined;
  }

  destroyRoom(code: RoomCode): void {
    this.rooms.delete(code);
  }
}
