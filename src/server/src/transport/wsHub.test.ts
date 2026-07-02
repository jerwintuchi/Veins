import { describe, it, expect } from 'vitest';
import { WsHub, attachWebSocketServer, type RawSocket, type WebSocketServerLike } from './wsHub.js';
import { encodeMessage, decodeMessage, type Envelope } from './protocol.js';
import { RoomManager } from '../room/manager.js';
import { registerHandlers } from '../index.js';
import type { ServerSocket } from './types.js';

// A fake raw socket that records sends and lets the test drive message/close.
class FakeSocket implements RawSocket {
  sent: string[] = [];
  private msgCb?: (data: unknown) => void;
  private closeCb?: () => void;
  send(data: string): void { this.sent.push(data); }
  close(): void { /* no-op */ }
  on(event: 'message' | 'close', cb: (data?: unknown) => void): void {
    if (event === 'message') this.msgCb = cb as (d: unknown) => void;
    else this.closeCb = cb as () => void;
  }
  receive(type: string, payload?: unknown): void { this.msgCb?.(encodeMessage(type, payload)); }
  fireClose(): void { this.closeCb?.(); }
  decoded(): (Envelope | null)[] { return this.sent.map(decodeMessage); }
  types(): string[] { return this.sent.map(s => decodeMessage(s)?.type ?? '?'); }
}

describe('WsHub', () => {
  it('derives handshake playerId from the connection url query', () => {
    const hub = new WsHub();
    let captured: ServerSocket | undefined;
    hub.on('connection', (s) => { captured = s; });
    hub.acceptConnection(new FakeSocket(), '/?playerId=abc');
    expect(captured?.handshake?.auth?.['playerId']).toBe('abc');
  });

  it('has no handshake playerId when the query is absent', () => {
    const hub = new WsHub();
    let captured: ServerSocket | undefined;
    hub.on('connection', (s) => { captured = s; });
    hub.acceptConnection(new FakeSocket(), '/');
    expect(captured?.handshake?.auth?.['playerId']).toBeUndefined();
  });

  it('dispatches incoming messages to on() listeners by type', () => {
    const hub = new WsHub();
    const fake = new FakeSocket();
    const got: unknown[] = [];
    hub.on('connection', (s) => s.on('move-player', (p) => got.push(p)));
    hub.acceptConnection(fake, '/');
    fake.receive('move-player', { dx: 1, dy: 0 });
    expect(got).toEqual([{ dx: 1, dy: 0 }]);
  });

  it('to(room).emit reaches only joined sockets', () => {
    const hub = new WsHub();
    const a = new FakeSocket(); const b = new FakeSocket(); const c = new FakeSocket();
    hub.on('connection', () => { /* sockets captured via return value */ });
    const sa = hub.acceptConnection(a, '/');
    const sb = hub.acceptConnection(b, '/');
    hub.acceptConnection(c, '/');
    sa.join('room1');
    sb.join('room1');
    hub.to('room1').emit('PING', { n: 1 });
    expect(a.types()).toContain('PING');
    expect(b.types()).toContain('PING');
    expect(c.types()).not.toContain('PING');
  });

  it('fires the disconnect listener and unrooms the socket on close', () => {
    const hub = new WsHub();
    const fake = new FakeSocket();
    let disconnected = false;
    hub.on('connection', (s) => s.on('disconnect', () => { disconnected = true; }));
    const s = hub.acceptConnection(fake, '/');
    s.join('room1');
    fake.fireClose();
    expect(disconnected).toBe(true);
    hub.to('room1').emit('PING', {});
    expect(fake.types()).not.toContain('PING');
  });

  it('runs the real lobby handlers over the transport (create-room -> ROOM_UPDATE)', () => {
    const hub = new WsHub();
    registerHandlers(hub, new RoomManager());
    const fake = new FakeSocket();
    hub.acceptConnection(fake, '/?playerId=host');
    fake.receive('create-room', undefined);
    const update = fake.decoded().find(m => m?.type === 'ROOM_UPDATE');
    expect(update).toBeDefined();
    expect((update?.payload as { room: { hostId: string } }).room.hostId).toBe('host');
  });

  it('attachWebSocketServer wires connections from a server-like', () => {
    let connCb: ((raw: RawSocket, req?: { url?: string }) => void) | undefined;
    const wss: WebSocketServerLike = { on: (_e, cb) => { connCb = cb; } };
    const hub = attachWebSocketServer(wss);
    let captured: ServerSocket | undefined;
    hub.on('connection', (s) => { captured = s; });
    connCb?.(new FakeSocket(), { url: '/?playerId=zed' });
    expect(captured?.handshake?.auth?.['playerId']).toBe('zed');
  });
});
