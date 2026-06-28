// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { RefObject } from 'react';
import { WaitingRoom } from './WaitingRoom.js';
import type { RoomSummary } from '@veins/shared';

function makeSocket() {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const emits: Array<{ event: string; payload: unknown }> = [];
  return {
    connected: true,
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => { handlers.set(event, handler); }),
    off: vi.fn(),
    emit: vi.fn((event: string, payload: unknown) => { emits.push({ event, payload }); }),
    handlers,
    emits,
  };
}

type FakeSocket = ReturnType<typeof makeSocket>;
function makeRef(s: FakeSocket): RefObject<FakeSocket> {
  return { current: s } as unknown as RefObject<FakeSocket>;
}

const HOST_ID = 'host-player';
const GUEST_ID = 'guest-player';

const BASE_ROOM: RoomSummary = {
  code: 'ABCD12',
  status: 'lobby',
  hostId: HOST_ID,
  players: [HOST_ID, GUEST_ID],
};

function renderRoom(
  socket: FakeSocket,
  opts: { room?: RoomSummary; localPlayerId?: string; connected?: boolean; onLeave?: () => void } = {}
) {
  const { room = BASE_ROOM, localPlayerId = HOST_ID, connected = true, onLeave = vi.fn() } = opts;
  const result = render(
    <WaitingRoom
      socketRef={makeRef(socket) as never}
      room={room}
      localPlayerId={localPlayerId}
      connected={connected}
      onLeave={onLeave}
    />
  );
  return { ...result, onLeave };
}

describe('WaitingRoom (T2, R2)', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });

  it('displays the room code', () => {
    renderRoom(makeSocket());
    expect(screen.getByTestId('room-code').textContent).toBe('ABCD12');
  });

  it('renders friendly labels: "You" for self and "Player N" for others', () => {
    renderRoom(makeSocket());
    const list = screen.getByTestId('player-list');
    expect(list.textContent).toContain('You');
    expect(list.textContent).toContain('Player 2');
    // raw socket ids must never leak into the UI
    expect(list.textContent).not.toContain(GUEST_ID);
  });

  it('shows Start Run button when localPlayerId === hostId', () => {
    renderRoom(makeSocket());
    expect(screen.getByTestId('start-run-btn')).toBeTruthy();
  });

  it('hides Start Run button when localPlayerId !== hostId', () => {
    renderRoom(makeSocket(), { localPlayerId: GUEST_ID });
    expect(screen.queryByTestId('start-run-btn')).toBeNull();
  });

  it('non-host sees a "waiting for host" hint', () => {
    renderRoom(makeSocket(), { localPlayerId: GUEST_ID });
    expect(screen.getByTestId('waiting-hint').textContent).toContain('Waiting for host');
  });

  it('clicking Start Run emits start-run', () => {
    const socket = makeSocket();
    renderRoom(socket);
    fireEvent.click(screen.getByTestId('start-run-btn'));
    expect(socket.emits.some(e => e.event === 'start-run')).toBe(true);
  });

  it('clicking Leave Room emits leave-room and calls onLeave (returns to lobby)', () => {
    const socket = makeSocket();
    const { onLeave } = renderRoom(socket);
    fireEvent.click(screen.getByTestId('leave-btn'));
    expect(socket.emits.some(e => e.event === 'leave-room')).toBe(true);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('ROOM_UPDATE event updates the player list', async () => {
    const socket = makeSocket();
    renderRoom(socket);
    const newRoom: RoomSummary = { ...BASE_ROOM, players: [HOST_ID, GUEST_ID, 'player-3'] };
    await act(async () => {
      socket.handlers.get('ROOM_UPDATE')!({ room: newRoom });
    });
    expect(screen.getByTestId('player-list').textContent).toContain('Player 3');
  });

  // R4 (solo-play) — a lone host can start solo; Start Run is enabled, no blocking hint.
  it('enables Start Run for a solo host and shows a solo hint', () => {
    const soloRoom: RoomSummary = { ...BASE_ROOM, players: [HOST_ID] };
    renderRoom(makeSocket(), { room: soloRoom });
    expect((screen.getByTestId('start-run-btn') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByTestId('start-hint')).toBeNull();
    expect(screen.getByTestId('solo-hint').textContent).toContain('Start solo');
  });

  // #8 — empty slots are visualized
  it('renders empty slots up to the max player count', () => {
    const soloRoom: RoomSummary = { ...BASE_ROOM, players: [HOST_ID] };
    renderRoom(makeSocket(), { room: soloRoom });
    expect(screen.getAllByTestId('empty-slot').length).toBe(3); // MAX_PLAYERS(4) - 1
  });

  // #1/#10 — connection feedback
  it('shows a reconnecting banner and disables Start Run when disconnected', () => {
    renderRoom(makeSocket(), { connected: false });
    expect(screen.getByTestId('connection-status').textContent).toContain('reconnecting');
    expect((screen.getByTestId('start-run-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('copy-code-btn is rendered', () => {
    renderRoom(makeSocket());
    expect(screen.getByTestId('copy-code-btn')).not.toBeNull();
  });

  it('copy-code-btn calls navigator.clipboard.writeText with room code', async () => {
    renderRoom(makeSocket());
    await act(async () => { fireEvent.click(screen.getByTestId('copy-code-btn')); });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('ABCD12');
  });

  it('copy-code-btn is an icon button whose label flips to "Copied!" briefly', async () => {
    vi.useFakeTimers();
    renderRoom(makeSocket());
    const btn = screen.getByTestId('copy-code-btn');
    // icon-only button: no text label, uses aria-label instead
    expect(btn.getAttribute('aria-label')).toBe('Copy room code');
    expect(btn.querySelector('svg')).not.toBeNull();
    await act(async () => { fireEvent.click(btn); });
    // allow the writeText promise microtask to resolve under fake timers
    await act(async () => { await Promise.resolve(); });
    expect(btn.getAttribute('aria-label')).toBe('Copied!');
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(btn.getAttribute('aria-label')).toBe('Copy room code');
    vi.useRealTimers();
  });
});
