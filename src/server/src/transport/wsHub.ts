// Raw-WebSocket implementation of the ServerHub seam (TD-002). Pure plumbing:
// it parses/serializes the JSON envelope and tracks room membership, and it
// imports no game modules (invariant: transport holds no game state).
import { encodeMessage, decodeMessage } from './protocol.js';
import type { ServerSocket, ServerHub, RoomEmitter } from './types.js';

// The minimal raw-socket surface satisfied by both `ws.WebSocket` and test fakes.
export interface RawSocket {
  send(data: string): void;
  close(): void;
  on(event: 'message', cb: (data: unknown) => void): void;
  on(event: 'close', cb: () => void): void;
}

// The 'connection' surface of `ws.WebSocketServer` (and test fakes).
export interface WebSocketServerLike {
  on(event: 'connection', cb: (socket: RawSocket, request?: { url?: string }) => void): void;
}

function parsePlayerId(requestUrl: string | undefined): string | undefined {
  if (!requestUrl) return undefined;
  try {
    return new URL(requestUrl, 'http://localhost').searchParams.get('playerId') ?? undefined;
  } catch {
    return undefined;
  }
}

let nextConnId = 0;

// Wraps one raw WebSocket connection as a ServerSocket the handlers understand.
class WsServerSocket implements ServerSocket {
  readonly id = `c${nextConnId++}`;
  data: { playerId?: string; roomCode?: string | undefined } = {};
  readonly handshake: { auth: { playerId?: string } };
  private listeners = new Map<string, ((payload: unknown) => void)[]>();

  constructor(private raw: RawSocket, private hub: WsHub, playerId: string | undefined) {
    this.handshake = { auth: playerId !== undefined ? { playerId } : {} };
    raw.on('message', (data: unknown) => {
      const msg = decodeMessage(typeof data === 'string' ? data : String(data));
      if (!msg) return;
      for (const fn of this.listeners.get(msg.type) ?? []) fn(msg.payload);
    });
    raw.on('close', () => {
      for (const fn of this.listeners.get('disconnect') ?? []) fn(undefined);
      this.hub.removeFromAllRooms(this);
    });
  }

  on(event: string, listener: (payload: unknown) => void): void {
    const arr = this.listeners.get(event);
    if (arr) arr.push(listener);
    else this.listeners.set(event, [listener]);
  }

  emit(event: string, payload: unknown): void {
    this.raw.send(encodeMessage(event, payload));
  }

  join(room: string): void {
    this.hub.join(room, this);
  }

  leave(room: string): void {
    this.hub.leave(room, this);
  }
}

export class WsHub implements ServerHub {
  private rooms = new Map<string, Set<ServerSocket>>();
  private connectionListener?: (socket: ServerSocket) => void;

  on(event: 'connection', listener: (socket: ServerSocket) => void): void {
    this.connectionListener = listener;
  }

  to(room: string): RoomEmitter {
    return {
      emit: (event: string, payload: unknown) => {
        const set = this.rooms.get(room);
        if (!set) return;
        for (const socket of set) socket.emit(event, payload);
      },
    };
  }

  // Accept a new raw connection (from the WebSocketServer 'connection' event, or
  // directly from a test). Wraps it and notifies the registered handler.
  acceptConnection(raw: RawSocket, requestUrl?: string): ServerSocket {
    const socket = new WsServerSocket(raw, this, parsePlayerId(requestUrl));
    this.connectionListener?.(socket);
    return socket;
  }

  join(room: string, socket: ServerSocket): void {
    let set = this.rooms.get(room);
    if (!set) {
      set = new Set();
      this.rooms.set(room, set);
    }
    set.add(socket);
  }

  leave(room: string, socket: ServerSocket): void {
    const set = this.rooms.get(room);
    if (!set) return;
    set.delete(socket);
    if (set.size === 0) this.rooms.delete(room);
  }

  removeFromAllRooms(socket: ServerSocket): void {
    for (const [room, set] of this.rooms) {
      set.delete(socket);
      if (set.size === 0) this.rooms.delete(room);
    }
  }
}

// Wire a real (or fake) WebSocket server to a fresh hub.
export function attachWebSocketServer(wss: WebSocketServerLike): WsHub {
  const hub = new WsHub();
  wss.on('connection', (raw, request) => {
    hub.acceptConnection(raw, request?.url);
  });
  return hub;
}
