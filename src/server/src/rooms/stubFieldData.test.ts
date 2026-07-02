import { describe, it, expect } from 'vitest';
import { STUB_FIELD_DATA } from './stubFieldData.js';
import type { StubFieldData } from '@testament/shared';

// T37: STUB_FIELD_DATA constant

describe('STUB_FIELD_DATA', () => {
  it('satisfies the StubFieldData type (compiler check)', () => {
    const _: StubFieldData = STUB_FIELD_DATA;
    expect(_).toBeDefined();
  });

  it('has no traitRoll key', () => {
    expect(Object.keys(STUB_FIELD_DATA)).not.toContain('traitRoll');
  });

  it('fieldId is FIELD-001', () => {
    expect(STUB_FIELD_DATA.fieldId).toBe('FIELD-001');
  });
});
