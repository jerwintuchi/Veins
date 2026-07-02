// Runtime payload validation helper. Pure structural check — no game logic (I4).

export type ValidationError = { field: string; reason: string };
export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: ValidationError[] };

type FieldSpec = { type: 'string' | 'number' | 'boolean' | 'object' };

// Validates that `input` is an object containing all required fields with the
// expected typeof types. Extra fields are ignored (forward-compatibility).
export function validatePayload<T extends object>(
  input: unknown,
  required: Record<string, FieldSpec>,
): ValidationResult<T> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errors: [{ field: '(root)', reason: 'must be an object' }] };
  }

  const errors: ValidationError[] = [];
  const obj = input as Record<string, unknown>;

  for (const [field, spec] of Object.entries(required)) {
    if (!(field in obj)) {
      errors.push({ field, reason: 'required field missing' });
    } else if (typeof obj[field] !== spec.type) {
      errors.push({ field, reason: `expected ${spec.type}, got ${typeof obj[field]}` });
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: input as T };
}
