import { describe, it, expect } from 'vitest';
import { encodeMessage, decodeMessage } from './protocol.js';

describe('envelope protocol', () => {
  it('round-trips type and payload', () => {
    const raw = encodeMessage('ROOM_UPDATE', { room: { code: 'AAAA' } });
    expect(decodeMessage(raw)).toEqual({ type: 'ROOM_UPDATE', payload: { room: { code: 'AAAA' } } });
  });

  it('round-trips a message with an undefined payload', () => {
    const msg = decodeMessage(encodeMessage('start-run', undefined));
    expect(msg?.type).toBe('start-run');
    expect(msg?.payload).toBeUndefined();
  });

  it('returns null for non-JSON', () => {
    expect(decodeMessage('not json {')).toBeNull();
  });

  it('returns null for a non-object', () => {
    expect(decodeMessage('42')).toBeNull();
    expect(decodeMessage('"hi"')).toBeNull();
    expect(decodeMessage('null')).toBeNull();
  });

  it('returns null when type is missing or not a string', () => {
    expect(decodeMessage(JSON.stringify({ payload: 1 }))).toBeNull();
    expect(decodeMessage(JSON.stringify({ type: 5, payload: 1 }))).toBeNull();
  });
});
