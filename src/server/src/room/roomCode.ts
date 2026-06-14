import { randomInt } from 'node:crypto';

// Unambiguous alphabet: no O/0, I/1, so codes are easy to read aloud and type.
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 5;

// Room codes need uniqueness, not reproducibility, so true randomness via
// node:crypto is appropriate here (this is not seeded procedural game logic, so
// it sits outside invariant I3's seeded-RNG requirement).
export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  }
  return code;
}
