// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

// Stub Phaser before importing App so no real WebGL is created.
const mockGame = { registry: { set: vi.fn() }, destroy: vi.fn() };
vi.mock('phaser', () => {
  class FakeGame { constructor(_cfg: unknown) { Object.assign(this, mockGame); } }
  return { default: { Game: FakeGame, AUTO: 'AUTO', Scale: { RESIZE: 'RESIZE', CENTER_BOTH: 'CENTER_BOTH' } } };
});

// Stub socket.io-client — capture event handlers + the auth handshake.
const socketHandlers = new Map<string, Set<(...args: unknown[]) => void>>();
const mockEmit = vi.fn();
let capturedAuth: { playerId?: string } | null = null;
const mockSocket = {
  id: 'transport-socket-id',
  emit: mockEmit,
  disconnect: vi.fn(),
  connected: true,
  on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    if (!socketHandlers.has(event)) socketHandlers.set(event, new Set());
    socketHandlers.get(event)!.add(handler);
  }),
  off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    socketHandlers.get(event)?.delete(handler);
  }),
};
vi.mock('socket.io-client', () => ({
  io: (_url: string, opts?: { auth?: { playerId?: string } }) => {
    capturedAuth = opts?.auth ?? null;
    return mockSocket;
  },
}));

vi.mock('./game/GameScene.js', () => ({ GameScene: class {} }));
vi.mock('./components/LobbyScreen.js', () => ({ LobbyScreen: () => <div data-testid="lobby-screen-stub" /> }));
vi.mock('./components/WaitingRoom.js', () => ({ WaitingRoom: () => <div data-testid="waiting-room-stub" /> }));
vi.mock('./components/BoardPanel.js', () => ({ BoardPanel: () => null }));
vi.mock('./game/SceneStore.js', () => ({
  sceneStore: { camera: null, localPlayerPos: null, onBleedTick: vi.fn(() => () => {}), onPhaseChanged: vi.fn(() => () => {}), onFloorChanged: vi.fn(() => () => {}) },
}));

function fireSocketEvent(event: string, payload?: unknown) {
  (socketHandlers.get(event) ?? new Set()).forEach(h => h(payload));
}

const RESYNC_SNAPSHOT = {
  room: { code: 'ABCD12', status: 'in-progress', hostId: 'stable-me', players: ['stable-me', 'p2'] },
  phase: 'combat',
  floor: 2,
  dungeon: { runId: 'r', rooms: [], corridors: [], width: 100, height: 100 },
  board: { slots: {} },
  synergyMap: {},
  relicRegistry: {},
  lootPool: [],
  bleedClock: { current: 800, max: 1000, drainPerSecond: 1 },
  bleedStage: 1,
  outcome: null,
  playerStates: { 'stable-me': { hp: 100, maxHp: 100, downed: false, x: 50, y: 50 } },
  aimStates: {},
  enemies: [],
  projectiles: [],
  disconnectedPlayers: [],
};

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(0));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true });
  mockEmit.mockClear();
  capturedAuth = null;
  socketHandlers.clear();
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('App reconnection (R1, R6)', async () => {
  const { App } = await import('./App.js');

  it('passes a stable player id via the socket auth handshake, persisted in localStorage (R1)', () => {
    render(<App />);
    expect(capturedAuth?.playerId).toBeTruthy();
    expect(capturedAuth?.playerId).toBe(localStorage.getItem('veins.playerId'));
  });

  it('emits rejoin on mount when an active room code is remembered (R6)', () => {
    sessionStorage.setItem('veins.roomCode', 'ABCD12');
    render(<App />);
    expect(mockEmit).toHaveBeenCalledWith('rejoin', { code: 'ABCD12' });
  });

  it('does NOT emit rejoin when no room code is remembered', () => {
    render(<App />);
    expect(mockEmit).not.toHaveBeenCalledWith('rejoin', expect.anything());
  });

  it('STATE_RESYNC restores the game screen from the snapshot (R6)', async () => {
    render(<App />);
    expect(document.querySelector('#game-container')).toBeNull();
    await act(async () => { fireSocketEvent('STATE_RESYNC', RESYNC_SNAPSHOT); });
    expect(document.querySelector('#game-container')).toBeTruthy();
    expect(screen.queryByTestId('lobby-screen-stub')).toBeNull();
    // The active room code is now remembered for a subsequent reconnect.
    expect(sessionStorage.getItem('veins.roomCode')).toBe('ABCD12');
  });
});
