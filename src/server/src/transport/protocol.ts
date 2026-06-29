// The raw-WebSocket message envelope. Every message on the wire is JSON:
//   { "type": <event name>, "payload": <event data> }
// This is the language-neutral contract the GDScript client mirrors (TD-002).

export type Envelope = { type: string; payload: unknown };

export function encodeMessage(type: string, payload: unknown): string {
  return JSON.stringify({ type, payload });
}

// Parse one inbound frame. Never throws: returns null for anything that is not a
// well-formed envelope with a string `type`.
export function decodeMessage(raw: string): Envelope | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const type = (parsed as { type?: unknown }).type;
  if (typeof type !== 'string') return null;
  return { type, payload: (parsed as { payload?: unknown }).payload };
}
