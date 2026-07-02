// Pure function. Strips non-printable chars, enforces 1–32 char length.
export type LobbyValidationError = { reason: string };

export function sanitizeDisplayName(raw: unknown): string | LobbyValidationError {
  if (typeof raw !== 'string') return { reason: 'displayName must be a string' };
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { reason: 'displayName must not be empty' };
  if (trimmed.length > 32) return { reason: 'displayName must be 32 characters or fewer' };
  // Strip control characters while preserving unicode letters, numbers, spaces, hyphens.
  const cleaned = trimmed.replace(/\p{C}/gu, '');
  if (cleaned.length === 0) return { reason: 'displayName must not be empty after sanitization' };
  return cleaned;
}
