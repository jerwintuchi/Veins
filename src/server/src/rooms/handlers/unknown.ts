import type { EmitFn } from '../types.js';

export function handleUnknownMessage(
  socketId: string,
  type: string,
  emit: EmitFn,
): void {
  emit('LOBBY_ERROR', {
    code: 'INVALID_PAYLOAD',
    message: `Unrecognized message type: "${type}"`,
  });
}
