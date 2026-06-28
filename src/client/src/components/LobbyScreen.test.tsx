// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { RefObject } from 'react';
import { LobbyScreen } from './LobbyScreen.js';

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

function renderLobby(socket: FakeSocket, connected = true) {
  return render(<LobbyScreen socketRef={makeRef(socket) as never} connected={connected} />);
}

// Navigate from the menu into the join (code-entry) view.
function openJoinView() {
  fireEvent.click(screen.getByTestId('join-room-btn'));
}

describe('LobbyScreen (T1, R1)', () => {
  it('renders with data-testid="lobby-screen" and starts on the menu', () => {
    renderLobby(makeSocket());
    expect(screen.getByTestId('lobby-screen')).toBeTruthy();
    expect(screen.getByTestId('create-room-btn')).toBeTruthy();
    expect(screen.getByTestId('join-room-btn')).toBeTruthy();
    // The code input does not exist until Join Room is clicked.
    expect(screen.queryByTestId('code-input')).toBeNull();
  });

  it('clicking Create Room emits create-room', () => {
    const socket = makeSocket();
    renderLobby(socket);
    fireEvent.click(screen.getByTestId('create-room-btn'));
    expect(socket.emits.some(e => e.event === 'create-room')).toBe(true);
  });

  // --- two-step join flow ---

  it('clicking Join Room reveals the code input and a Back control', () => {
    renderLobby(makeSocket());
    openJoinView();
    expect(screen.getByTestId('code-input')).toBeTruthy();
    expect(screen.getByTestId('join-submit-btn')).toBeTruthy();
    expect(screen.getByTestId('back-btn')).toBeTruthy();
    // The menu buttons are gone while entering a code.
    expect(screen.queryByTestId('create-room-btn')).toBeNull();
  });

  it('Back returns to the menu and clears the code', () => {
    renderLobby(makeSocket());
    openJoinView();
    fireEvent.change(screen.getByTestId('code-input'), { target: { value: 'abc123' } });
    fireEvent.click(screen.getByTestId('back-btn'));
    expect(screen.getByTestId('create-room-btn')).toBeTruthy();
    expect(screen.queryByTestId('code-input')).toBeNull();
    // Reopening shows an empty field, not the stale code.
    openJoinView();
    expect((screen.getByTestId('code-input') as HTMLInputElement).value).toBe('');
  });

  it('entering a code and clicking Join emits join-room with the uppercased code', () => {
    const socket = makeSocket();
    renderLobby(socket);
    openJoinView();
    fireEvent.change(screen.getByTestId('code-input'), { target: { value: 'abc123' } });
    fireEvent.click(screen.getByTestId('join-submit-btn'));
    const ev = socket.emits.find(e => e.event === 'join-room');
    expect(ev).toBeDefined();
    expect((ev!.payload as { code: string }).code).toBe('ABC123');
  });

  it('pressing Enter in the code input emits join-room', () => {
    const socket = makeSocket();
    renderLobby(socket);
    openJoinView();
    const input = screen.getByTestId('code-input');
    fireEvent.change(input, { target: { value: 'wxyz99' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    const ev = socket.emits.find(e => e.event === 'join-room');
    expect(ev).toBeDefined();
    expect((ev!.payload as { code: string }).code).toBe('WXYZ99');
  });

  it('pressing Escape in the code input returns to the menu', () => {
    renderLobby(makeSocket());
    openJoinView();
    fireEvent.keyDown(screen.getByTestId('code-input'), { key: 'Escape' });
    expect(screen.getByTestId('create-room-btn')).toBeTruthy();
    expect(screen.queryByTestId('code-input')).toBeNull();
  });

  it('Join with an empty code shows a prompt and does not emit', () => {
    const socket = makeSocket();
    renderLobby(socket);
    openJoinView();
    fireEvent.click(screen.getByTestId('join-submit-btn'));
    expect(socket.emits.find(e => e.event === 'join-room')).toBeUndefined();
    expect(screen.getByTestId('lobby-error').textContent).toContain('Enter a room code.');
  });

  // Back cancels a pending join so the user is never stranded on "Joining…".
  it('Back cancels a pending join and re-enables the menu', () => {
    const socket = makeSocket();
    renderLobby(socket);
    openJoinView();
    fireEvent.change(screen.getByTestId('code-input'), { target: { value: 'abc123' } });
    fireEvent.click(screen.getByTestId('join-submit-btn'));
    expect(screen.getByTestId('join-submit-btn').textContent).toBe('Joining…');
    fireEvent.click(screen.getByTestId('back-btn'));
    const createBtn = screen.getByTestId('create-room-btn') as HTMLButtonElement;
    expect(createBtn.disabled).toBe(false);
    expect(createBtn.textContent).toBe('Create Room');
  });

  // Safety net: a join that gets no server response releases after the timeout.
  it('releases a stuck join after the response timeout with a message', () => {
    vi.useFakeTimers();
    const socket = makeSocket();
    renderLobby(socket);
    openJoinView();
    fireEvent.change(screen.getByTestId('code-input'), { target: { value: 'abc123' } });
    fireEvent.click(screen.getByTestId('join-submit-btn'));
    expect(screen.getByTestId('join-submit-btn').textContent).toBe('Joining…');
    act(() => { vi.advanceTimersByTime(8000); });
    expect(screen.getByTestId('join-submit-btn').textContent).toBe('Join');
    expect(screen.getByTestId('lobby-error').textContent).toContain('Could not reach the room');
    vi.useRealTimers();
  });

  // --- error + connection handling ---

  it('LOBBY_ERROR event shows an error with role=alert', async () => {
    const socket = makeSocket();
    renderLobby(socket);
    await act(async () => {
      socket.handlers.get('LOBBY_ERROR')!({ code: 'ROOM_NOT_FOUND', message: 'No room with that code.' });
    });
    expect(screen.getByRole('alert').textContent).toContain('No room with that code.');
  });

  it('error clears when Create Room is clicked', async () => {
    const socket = makeSocket();
    renderLobby(socket);
    await act(async () => {
      socket.handlers.get('LOBBY_ERROR')!({ code: 'ROOM_NOT_FOUND', message: 'No room.' });
    });
    expect(screen.getByTestId('lobby-error')).toBeTruthy();
    fireEvent.click(screen.getByTestId('create-room-btn'));
    expect(screen.queryByTestId('lobby-error')).toBeNull();
  });

  it('disables menu buttons and shows status when not connected', () => {
    const socket = makeSocket();
    renderLobby(socket, false);
    expect(screen.getByTestId('connection-status')).toBeTruthy();
    expect((screen.getByTestId('create-room-btn') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('join-room-btn') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('create-room-btn'));
    expect(socket.emits.some(e => e.event === 'create-room')).toBe(false);
  });

  it('shows "Creating…" and ignores a second click while pending', () => {
    const socket = makeSocket();
    renderLobby(socket);
    fireEvent.click(screen.getByTestId('create-room-btn'));
    fireEvent.click(screen.getByTestId('create-room-btn'));
    expect(screen.getByTestId('create-room-btn').textContent).toBe('Creating…');
    expect(socket.emits.filter(e => e.event === 'create-room').length).toBe(1);
  });

  it('re-enables Create Room after a LOBBY_ERROR', async () => {
    const socket = makeSocket();
    renderLobby(socket);
    fireEvent.click(screen.getByTestId('create-room-btn'));
    await act(async () => {
      socket.handlers.get('LOBBY_ERROR')!({ code: 'INVALID_REQUEST', message: 'nope' });
    });
    expect(screen.getByTestId('create-room-btn').textContent).toBe('Create Room');
    expect((screen.getByTestId('create-room-btn') as HTMLButtonElement).disabled).toBe(false);
  });
});
