// T22: Integration test — full lobby flow against a real in-process WebSocket server.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocketServer, WebSocket } from 'ws';
import type { AddressInfo } from 'node:net';
import { RoomManager } from './RoomManager.js';
import { ReconnectTokenStore } from './ReconnectTokenStore.js';
import { SessionArchive } from './SessionArchive.js';
import { routeMessage } from './messageRouter.js';
import { handleSocketDisconnect } from './handlers/disconnect.js';

type Msg = { type: string; payload: unknown };

// ── Test client helper ────────────────────────────────────────────────────────

class TestClient {
  private ws: WebSocket;
  private queue: Msg[] = [];
  private waiters: Array<(msg: Msg) => void> = [];

  constructor(ws: WebSocket) {
    this.ws = ws;
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString()) as Msg;
      const waiter = this.waiters.shift();
      if (waiter) waiter(msg);
      else this.queue.push(msg);
    });
  }

  send(type: string, payload: unknown = {}): void {
    this.ws.send(JSON.stringify({ type, payload }));
  }

  next(): Promise<Msg> {
    return new Promise((resolve) => {
      const queued = this.queue.shift();
      if (queued) resolve(queued);
      else this.waiters.push(resolve);
    });
  }

  close(): void { this.ws.close(); }
}

// ── Minimal test server ───────────────────────────────────────────────────────

function startServer(): Promise<{ wss: WebSocketServer; port: number; mgr: RoomManager; store: ReconnectTokenStore; sessionArchive: SessionArchive }> {
  return new Promise((resolve) => {
    const mgr = new RoomManager();
    const store = new ReconnectTokenStore();
    const sessionArchive = new SessionArchive();
    const wss = new WebSocketServer({ port: 0 });

    wss.on('connection', (ws) => {
      const socketId = Math.random().toString(36).slice(2);
      (ws as unknown as Record<string, unknown>)['_tid'] = socketId;

      const emit = (type: string, payload: unknown) =>
        ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type, payload }));

      const emitTo = (targetSocketId: string, type: string, payload: unknown) => {
        wss.clients.forEach((client) => {
          const cid = (client as unknown as Record<string, unknown>)['_tid'] as string;
          if (cid === targetSocketId && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type, payload }));
          }
        });
      };

      const broadcast = (roomCode: string, type: string, payload: unknown) => {
        const room = mgr.getRoom(roomCode);
        if (!room) return;
        wss.clients.forEach((client) => {
          const cid = (client as unknown as Record<string, unknown>)['_tid'] as string;
          if (room.players.some(p => p.socketId === cid) && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type, payload }));
          }
        });
      };

      ws.on('message', (raw) => routeMessage(socketId, raw.toString(), mgr, store, emit, emitTo, broadcast, sessionArchive));
      ws.on('close', () => handleSocketDisconnect(socketId, mgr, broadcast));
    });

    wss.on('listening', () => {
      const { port } = wss.address() as AddressInfo;
      resolve({ wss, port, mgr, store, sessionArchive });
    });
  });
}

function connect(port: number): Promise<TestClient> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on('open', () => resolve(new TestClient(ws)));
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

let wss: WebSocketServer;
let port: number;
let mgr: RoomManager;
let store: ReconnectTokenStore;
let sessionArchive: SessionArchive;

beforeEach(async () => {
  ({ wss, port, mgr, store, sessionArchive } = await startServer());
});

afterEach(() => {
  wss.clients.forEach(c => c.terminate());
  wss.close();
});

describe('T22: lobby integration — full flow', () => {
  it('create → join → both ready → accept contract produces the correct event sequence', async () => {
    const host = await connect(port);
    const p2 = await connect(port);

    // Host creates room.
    host.send('CREATE_ROOM', { displayName: 'Host' });
    const created = await host.next();
    expect(created.type).toBe('ROOM_CREATED');
    const code = (created.payload as { snapshot: { roomCode: string } }).snapshot.roomCode;

    // P2 joins.
    p2.send('JOIN_ROOM', { code, displayName: 'Seeker' });
    // host gets LOBBY_UPDATED broadcast, p2 gets LOBBY_UPDATED + RECONNECT_TOKEN
    const hostGotJoin = await host.next();
    expect(hostGotJoin.type).toBe('LOBBY_UPDATED');
    const p2GotJoin = await p2.next();
    expect(p2GotJoin.type).toBe('LOBBY_UPDATED');
    expect((p2GotJoin.payload as { snapshot: { players: unknown[] } }).snapshot.players).toHaveLength(2);
    await p2.next(); // RECONNECT_TOKEN

    // Both toggle ready.
    host.send('TOGGLE_READY');
    await host.next(); // LOBBY_UPDATED to host
    await p2.next();   // LOBBY_UPDATED to p2

    p2.send('TOGGLE_READY');
    await host.next(); // LOBBY_UPDATED to host
    await p2.next();   // LOBBY_UPDATED to p2

    // Leader accepts contract.
    host.send('ACCEPT_CONTRACT');
    const deployingHost = await host.next();
    const deployingP2 = await p2.next();
    expect(deployingHost.type).toBe('ROOM_DEPLOYING');
    expect(deployingP2.type).toBe('ROOM_DEPLOYING');

    // ContractIntel validation — no server-only fields (R48/T49).
    const contract = (deployingHost.payload as { contract: Record<string, unknown> }).contract;
    expect(Object.keys(contract)).not.toContain('traitRoll');
    expect(Object.keys(contract)).not.toContain('expeditionSeed');
    expect(contract['tier']).toBe('APPRENTICE');
    expect(['INVESTIGATE', 'ELIMINATE', 'CAPTURE', 'BANISH']).toContain(contract['primaryVerb']);
    expect(typeof contract['contractId']).toBe('string');
    expect(typeof contract['targetName']).toBe('string');
    expect(typeof contract['siteName']).toBe('string');

    host.close();
    p2.close();
  }, 10000);

  it('no STATE_RESYNC is sent to already-connected players during normal flow', async () => {
    const host = await connect(port);

    const received: string[] = [];
    host['ws' as never] /* unused — tap via constructor ws */ ;
    // Track via a fresh connection that collects everything.
    const freshWs = new WebSocket(`ws://localhost:${port}`);
    const allTypes: string[] = [];
    freshWs.on('message', raw => allTypes.push((JSON.parse(raw.toString()) as Msg).type));
    await new Promise<void>(r => freshWs.on('open', r));
    const fresh = new TestClient(freshWs);

    fresh.send('CREATE_ROOM', { displayName: 'Scout' });
    await fresh.next(); // ROOM_CREATED

    const p2 = await connect(port);
    const created2 = await (async () => {
      // we need the code
      host.send('CREATE_ROOM', { displayName: 'Host2' });
      return host.next();
    })();
    const code2 = (created2.payload as { snapshot: { roomCode: string } }).snapshot.roomCode;
    p2.send('JOIN_ROOM', { code: code2, displayName: 'P2' });
    await host.next(); // LOBBY_UPDATED
    await p2.next(); // LOBBY_UPDATED
    await p2.next(); // RECONNECT_TOKEN

    // allTypes for 'fresh' should not contain STATE_RESYNC.
    await new Promise(r => setTimeout(r, 50));
    expect(allTypes).not.toContain('STATE_RESYNC');

    host.close();
    p2.close();
    freshWs.close();
  }, 10000);

  it('room destroyed after last player leaves — JOIN_ROOM returns ROOM_NOT_FOUND', async () => {
    const host = await connect(port);
    host.send('CREATE_ROOM', { displayName: 'Host' });
    const created = await host.next();
    const code = (created.payload as { snapshot: { roomCode: string } }).snapshot.roomCode;

    host.send('LEAVE_ROOM');
    await new Promise(r => setTimeout(r, 30));
    expect(mgr.getRoom(code)).toBeUndefined();

    const late = await connect(port);
    late.send('JOIN_ROOM', { code, displayName: 'Late' });
    const err = await late.next();
    expect(err.type).toBe('LOBBY_ERROR');
    expect((err.payload as { code: string }).code).toBe('ROOM_NOT_FOUND');

    host.close();
    late.close();
  }, 10000);

  it('reconnect: player disconnects from a 2-player room, reconnects and receives STATE_RESYNC', async () => {
    const host = await connect(port);
    const p2 = await connect(port);

    // Create room with 2 players so the room survives host disconnect.
    host.send('CREATE_ROOM', { displayName: 'Host' });
    const created = await host.next();
    const code = (created.payload as { snapshot: { roomCode: string } }).snapshot.roomCode;
    const token = (created.payload as { reconnectToken: string }).reconnectToken;

    p2.send('JOIN_ROOM', { code, displayName: 'P2' });
    await host.next(); // LOBBY_UPDATED
    await p2.next();   // LOBBY_UPDATED
    await p2.next();   // RECONNECT_TOKEN

    // Host disconnects.
    host.close();
    await new Promise(r => setTimeout(r, 50));
    await p2.next(); // LOBBY_UPDATED (leader changed)

    // Host reconnects.
    const hostNew = await connect(port);
    hostNew.send('RECONNECT', { token });
    const resync = await hostNew.next();
    expect(resync.type).toBe('STATE_RESYNC');
    expect((resync.payload as { snapshot: unknown }).snapshot).toBeDefined();

    // Room still has the room code in the snapshot.
    const snap = (resync.payload as { snapshot: { roomCode: string } }).snapshot;
    expect(snap.roomCode).toBe(code);

    // p2 receives LOBBY_UPDATED when host reconnects.
    const p2Update = await p2.next();
    expect(p2Update.type).toBe('LOBBY_UPDATED');

    hostNew.close();
    p2.close();
  }, 10000);
});
