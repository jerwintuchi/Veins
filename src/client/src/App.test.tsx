// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

// Stub Phaser before importing App so no real WebGL is created.
const mockGame = { registry: { set: vi.fn() }, destroy: vi.fn() };
vi.mock('phaser', () => {
  class FakeGame { constructor(_cfg: unknown) { Object.assign(this, mockGame); } }
  return { default: { Game: FakeGame, AUTO: 'AUTO', Scale: { RESIZE: 'RESIZE', CENTER_BOTH: 'CENTER_BOTH' } } };
});

// Stub socket.io-client — capture event handlers so tests can fire events.
const socketHandlers = new Map<string, Set<(...args: unknown[]) => void>>();
const mockEmit = vi.fn();
const mockSocket = {
  id: 'test-socket-id',
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
vi.mock('socket.io-client', () => ({ io: () => mockSocket }));

// Stub GameScene so we don't need a real Phaser.Scene.
vi.mock('./game/GameScene.js', () => ({ GameScene: class {} }));

// Stub child components that have their own socket subscriptions.
vi.mock('./components/LobbyScreen.js', () => ({
  LobbyScreen: () => <div data-testid="lobby-screen-stub" />,
}));
vi.mock('./components/WaitingRoom.js', () => ({
  WaitingRoom: () => <div data-testid="waiting-room-stub" />,
}));
vi.mock('./components/BoardPanel.js', () => ({
  BoardPanel: () => null,
}));

// Stub sceneStore to control camera/pos in aim tests.
const mockCamera = { getWorldPoint: vi.fn((_x: number, _y: number) => ({ x: 600, y: 350 })) };
vi.mock('./game/SceneStore.js', () => {
  const store = {
    camera: null as typeof mockCamera | null,
    localPlayerPos: null as { x: number; y: number } | null,
    onBleedTick: vi.fn(() => () => {}),
    onPhaseChanged: vi.fn(() => () => {}),
    onFloorChanged: vi.fn(() => () => {}),
  };
  return { sceneStore: store };
});

import { sceneStore } from './game/SceneStore.js';

function fireSocketEvent(event: string, payload?: unknown) {
  (socketHandlers.get(event) ?? new Set()).forEach(h => h(payload));
}

beforeEach(() => {
  // Do NOT call the callback synchronously — the WASD tick loop would recurse infinitely.
  vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(0));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true });
  mockEmit.mockClear();
  mockGame.destroy.mockClear();
  mockGame.registry.set.mockClear();
  socketHandlers.clear();
  (sceneStore as unknown as { camera: null }).camera = null;
  (sceneStore as unknown as { localPlayerPos: null }).localPlayerPos = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('App — screen state machine (T3, R3)', async () => {
  const { App } = await import('./App.js');

  it('renders LobbyScreen initially — no #game-container', () => {
    render(<App />);
    expect(screen.getByTestId('lobby-screen-stub')).toBeTruthy();
    expect(document.querySelector('#game-container')).toBeNull();
  });

  it('transitions to WaitingRoom on ROOM_UPDATE', async () => {
    render(<App />);
    await act(async () => {
      fireSocketEvent('ROOM_UPDATE', {
        room: { code: 'ABCD12', status: 'lobby', hostId: 'test-socket-id', players: ['test-socket-id'] },
      });
    });
    expect(screen.getByTestId('waiting-room-stub')).toBeTruthy();
    expect(screen.queryByTestId('lobby-screen-stub')).toBeNull();
  });

  it('transitions to game screen on RUN_STARTED — #game-container appears', async () => {
    render(<App />);
    // First go through waiting room.
    await act(async () => {
      fireSocketEvent('ROOM_UPDATE', {
        room: { code: 'ABCD12', status: 'lobby', hostId: 'test-socket-id', players: ['test-socket-id', 'p2'] },
      });
    });
    await act(async () => {
      fireSocketEvent('RUN_STARTED', { board: { slots: {} }, synergyMap: {}, relicRegistry: {} });
    });
    expect(document.querySelector('#game-container')).toBeTruthy();
    expect(screen.queryByTestId('waiting-room-stub')).toBeNull();
  });

  it('Phaser.Game is only constructed when screen === game', async () => {
    render(<App />);
    // Still in lobby — no Phaser.
    expect(mockGame.registry.set).not.toHaveBeenCalled();

    await act(async () => {
      fireSocketEvent('ROOM_UPDATE', {
        room: { code: 'ABCD12', status: 'lobby', hostId: 'test-socket-id', players: ['test-socket-id', 'p2'] },
      });
    });
    // Waiting room — still no Phaser.
    expect(mockGame.registry.set).not.toHaveBeenCalled();

    await act(async () => {
      fireSocketEvent('RUN_STARTED', { board: { slots: {} }, synergyMap: {}, relicRegistry: {} });
    });
    // Game screen — Phaser created.
    expect(mockGame.registry.set).toHaveBeenCalledWith('socketRef', expect.anything());
  });
});

describe('App mouse-aim listener (T9, R10)', async () => {
  const { App } = await import('./App.js');

  it('falls back to viewport-centre when camera is null', () => {
    render(<App />);
    const ev = new MouseEvent('mousemove', { clientX: 500, clientY: 300, bubbles: true });
    window.dispatchEvent(ev);
    expect(mockEmit).toHaveBeenCalledWith('aim-player', expect.objectContaining({ dx: 100, dy: 0 }));
  });

  it('uses world coordinates when camera and playerPos are set', () => {
    render(<App />);
    (sceneStore as unknown as { camera: typeof mockCamera }).camera = mockCamera;
    (sceneStore as unknown as { localPlayerPos: { x: number; y: number } }).localPlayerPos = { x: 500, y: 300 };
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 300, bubbles: true }));
    expect(mockEmit).toHaveBeenCalledWith('aim-player', expect.objectContaining({ dx: 100, dy: 50 }));
  });

  it('reverts to auto-aim (zero vector) after 500ms of mouse inactivity', () => {
    vi.useFakeTimers();
    render(<App />);
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 300, bubbles: true }));
    mockEmit.mockClear();
    vi.advanceTimersByTime(600);
    expect(mockEmit).toHaveBeenCalledWith('aim-player', { dx: 0, dy: 0 });
    vi.useRealTimers();
  });
});

describe('App — post-run screen (T1, R1, R3)', async () => {
  const { App } = await import('./App.js');

  async function advanceToGame() {
    render(<App />);
    await act(async () => {
      fireSocketEvent('ROOM_UPDATE', {
        room: { code: 'ABCD12', status: 'lobby', hostId: 'test-socket-id', players: ['test-socket-id', 'p2'] },
      });
    });
    await act(async () => {
      fireSocketEvent('RUN_STARTED', { board: { slots: {} }, synergyMap: {}, relicRegistry: {} });
    });
  }

  it('RUN_ENDED shows post-run-screen and hides game container (R1)', async () => {
    await advanceToGame();
    expect(document.querySelector('#game-container')).toBeTruthy();

    await act(async () => {
      fireSocketEvent('RUN_ENDED', { outcome: 'wiped', finalFloor: 3 });
    });

    expect(screen.getByTestId('post-run-screen')).toBeTruthy();
    expect(document.querySelector('#game-container')).toBeNull();
  });

  it('return-to-lobby-btn transitions back to lobby screen (R3)', async () => {
    await advanceToGame();
    await act(async () => {
      fireSocketEvent('RUN_ENDED', { outcome: 'extracted', finalFloor: 5 });
    });
    expect(screen.getByTestId('post-run-screen')).toBeTruthy();

    const btn = screen.getByTestId('return-to-lobby-btn');
    await act(async () => { btn.click(); });

    expect(screen.getByTestId('lobby-screen-stub')).toBeTruthy();
    expect(screen.queryByTestId('post-run-screen')).toBeNull();
  });
});
