import { describe, it, expect } from 'vitest';
import { generateRoomCode, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './roomCode.js';

describe('generateRoomCode', () => {
  it('returns a string of the configured length', () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(ROOM_CODE_LENGTH);
  });

  it('uses only the allowed alphabet (no ambiguous chars)', () => {
    for (let i = 0; i < 1000; i++) {
      for (const ch of generateRoomCode()) {
        expect(ROOM_CODE_ALPHABET).toContain(ch);
      }
    }
    expect(ROOM_CODE_ALPHABET).not.toContain('O');
    expect(ROOM_CODE_ALPHABET).not.toContain('0');
    expect(ROOM_CODE_ALPHABET).not.toContain('I');
    expect(ROOM_CODE_ALPHABET).not.toContain('1');
  });

  it('produces effectively no collisions across many generations', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(generateRoomCode());
    // 32^5 ~= 33M space; 5000 draws should essentially never collide.
    expect(seen.size).toBeGreaterThan(4990);
  });
});
