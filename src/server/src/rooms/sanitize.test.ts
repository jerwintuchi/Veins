import { describe, it, expect } from 'vitest';
import { sanitizeDisplayName } from './sanitize.js';

// T10: display name sanitization

describe('sanitizeDisplayName', () => {
  it('passes a valid name through trimmed', () => {
    const result = sanitizeDisplayName('  Aldric  ');
    expect(result).toBe('Aldric');
  });

  it('returns an error for an empty string', () => {
    const result = sanitizeDisplayName('');
    expect(typeof result).toBe('object');
  });

  it('returns an error for a whitespace-only string', () => {
    const result = sanitizeDisplayName('   ');
    expect(typeof result).toBe('object');
  });

  it('returns an error for a name longer than 32 chars', () => {
    const result = sanitizeDisplayName('A'.repeat(33));
    expect(typeof result).toBe('object');
  });

  it('returns an error for non-string input', () => {
    expect(typeof sanitizeDisplayName(42)).toBe('object');
    expect(typeof sanitizeDisplayName(null)).toBe('object');
    expect(typeof sanitizeDisplayName(undefined)).toBe('object');
  });

  it('strips control characters without erroring when result is within length bounds', () => {
    const result = sanitizeDisplayName('Aldric\x00\x01');
    expect(result).toBe('Aldric');
  });
});
