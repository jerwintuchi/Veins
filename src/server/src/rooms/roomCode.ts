import { randomBytes } from 'node:crypto';
import { ROOM_CODE_LENGTH, ROOM_CODE_ALPHABET } from '@testament/shared';
import type { RoomCode } from '@testament/shared';

// Uses OS CSPRNG (not the seeded expedition RNG — I3 reserves that for world gen).
export function generateRoomCode(activeCodes: Set<RoomCode>): RoomCode {
  while (true) {
    const bytes = randomBytes(ROOM_CODE_LENGTH);
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code += ROOM_CODE_ALPHABET[bytes[i]! % ROOM_CODE_ALPHABET.length];
    }
    if (!activeCodes.has(code)) return code;
  }
}
