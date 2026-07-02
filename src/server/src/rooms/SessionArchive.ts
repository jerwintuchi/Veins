// In-process memory only. Never persisted (I7, R30).
import type { RoomCode, StubArchiveEntry } from '@testament/shared';

export class SessionArchive {
  private archives = new Map<RoomCode, StubArchiveEntry[]>();

  append(roomCode: RoomCode, entries: StubArchiveEntry[]): void {
    const existing = this.archives.get(roomCode) ?? [];
    this.archives.set(roomCode, [...existing, ...entries]);
  }

  getEntries(roomCode: RoomCode): StubArchiveEntry[] {
    return this.archives.get(roomCode) ?? [];
  }

  destroyArchive(roomCode: RoomCode): void {
    this.archives.delete(roomCode);
  }
}
