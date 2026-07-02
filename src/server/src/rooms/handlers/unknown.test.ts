import { describe, it, expect } from 'vitest';
import { handleUnknownMessage } from './unknown.js';
import type { EmitFn } from '../types.js';

// T18: unknown message handler

describe('handleUnknownMessage', () => {
  it('emits LOBBY_ERROR INVALID_PAYLOAD to the requesting socket only', () => {
    const calls: Array<[string, unknown]> = [];
    const emit: EmitFn = (t, p) => calls.push([t, p]);
    handleUnknownMessage('sock-1', 'SOME_UNKNOWN_TYPE', emit);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[0]).toBe('LOBBY_ERROR');
    expect((calls[0]?.[1] as { code: string }).code).toBe('INVALID_PAYLOAD');
  });

  it('includes the unknown type in the error message', () => {
    const calls: Array<[string, unknown]> = [];
    handleUnknownMessage('sock-1', 'MYSTERY_EVENT', (t, p) => calls.push([t, p]));
    const msg = (calls[0]?.[1] as { message: string }).message;
    expect(msg).toContain('MYSTERY_EVENT');
  });
});
