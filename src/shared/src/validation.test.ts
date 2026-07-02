import { describe, it, expect } from 'vitest';
import { validatePayload } from './validation.js';

// T3: validatePayload helper

describe('validatePayload', () => {
  const spec = {
    code: { type: 'string' as const },
    displayName: { type: 'string' as const },
  };

  it('returns ok for a valid payload', () => {
    const result = validatePayload({ code: 'ABC123', displayName: 'Aldric' }, spec);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({ code: 'ABC123', displayName: 'Aldric' });
    }
  });

  it('returns error for a missing required field', () => {
    const result = validatePayload({ code: 'ABC123' }, spec);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.field === 'displayName')).toBe(true);
    }
  });

  it('returns error for a field with wrong type', () => {
    const result = validatePayload({ code: 123, displayName: 'Aldric' }, spec);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.field === 'code')).toBe(true);
    }
  });

  it('does not error on extra unknown fields (forward-compatibility)', () => {
    const result = validatePayload({ code: 'ABC123', displayName: 'Aldric', extra: true }, spec);
    expect(result.ok).toBe(true);
  });

  it('returns error for non-object input (string)', () => {
    const result = validatePayload('not-an-object', spec);
    expect(result.ok).toBe(false);
  });

  it('returns error for null input', () => {
    const result = validatePayload(null, spec);
    expect(result.ok).toBe(false);
  });

  it('returns error for array input', () => {
    const result = validatePayload([], spec);
    expect(result.ok).toBe(false);
  });
});
