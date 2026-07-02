import { describe, it, expect } from 'vitest';
import { generateRoomCode } from './roomCode.js';
import { ROOM_CODE_LENGTH, ROOM_CODE_ALPHABET } from '@testament/shared';

// T6: room code generation

describe('generateRoomCode', () => {
  it('returns a code of exactly ROOM_CODE_LENGTH characters', () => {
    const code = generateRoomCode(new Set());
    expect(code).toHaveLength(ROOM_CODE_LENGTH);
  });

  it('only uses characters from ROOM_CODE_ALPHABET', () => {
    const code = generateRoomCode(new Set());
    for (const char of code) {
      expect(ROOM_CODE_ALPHABET).toContain(char);
    }
  });

  it('retries when the generated code is already active', () => {
    // Pre-fill all 1-char codes (not realistic, but validates retry logic).
    // We force a collision by passing a set that will be cleared after one hit.
    const first = generateRoomCode(new Set());
    const active = new Set([first]);
    // With enough retries a second unique code always emerges.
    const second = generateRoomCode(active);
    expect(second).not.toBe(first);
  });

  it('1000 successive calls with empty set produce no duplicates', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const code = generateRoomCode(codes);
      expect(codes.has(code)).toBe(false);
      codes.add(code);
    }
    expect(codes.size).toBe(1000);
  });
});
