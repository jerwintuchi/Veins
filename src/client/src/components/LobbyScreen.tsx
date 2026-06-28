import { useState, useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { Socket } from 'socket.io-client';
import type { LobbyErrorEvent } from '@veins/shared';
import { useInstallPrompt } from '../hooks/useInstallPrompt.js';

type Props = {
  socketRef: RefObject<Socket | null>;
  connected: boolean;
};

// Two-step lobby: a main menu (Create / Join) and a join panel that asks for a
// room code with a Back control. The code input only exists in the join view.
type View = 'menu' | 'join';

// If the server never answers a create/join (dropped packet, server down after
// connect), don't hang on "…" forever — release the button and show a message.
const RESPONSE_TIMEOUT_MS = 8000;

export function LobbyScreen({ socketRef, connected }: Props) {
  const [view, setView] = useState<View>('menu');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Which action is awaiting a server response, if any. Guards double-clicks.
  const [pending, setPending] = useState<'create' | 'join' | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { canInstall, promptInstall } = useInstallPrompt();

  function clearTimer() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  // Attach the LOBBY_ERROR listener once the socket actually exists. The socket
  // is created by the parent's useSocket effect, which runs AFTER this child's
  // effects on first mount — so we re-run when `connected` flips, by which point
  // socketRef.current is set. Without this, a failed join would never surface an
  // error and the button would hang on "Joining…".
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    function onError(ev: LobbyErrorEvent) {
      clearTimer();
      setError(ev.message);
      setPending(null); // server rejected — release the buttons
    }

    socket.on('LOBBY_ERROR', onError);
    return () => { socket.off('LOBBY_ERROR', onError); };
  }, [socketRef, connected]);

  // A dropped connection mid-handshake should never leave a button stuck.
  useEffect(() => {
    if (!connected) {
      clearTimer();
      setPending(null);
    }
  }, [connected]);

  // Clear any pending timer if we unmount (e.g. a successful join swaps screens).
  useEffect(() => clearTimer, []);

  const busy = !connected || pending !== null;

  function startPending(action: 'create' | 'join') {
    setError(null);
    setPending(action);
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setPending(null);
      setError('Could not reach the room. Check the code and try again.');
    }, RESPONSE_TIMEOUT_MS);
  }

  function createRoom() {
    if (busy) return;
    startPending('create');
    socketRef.current?.emit('create-room', undefined);
  }

  function openJoin() {
    setError(null);
    setView('join');
  }

  // Back doubles as "cancel": it always releases a pending join so the user is
  // never stranded on "Joining…".
  function backToMenu() {
    clearTimer();
    setPending(null);
    setView('menu');
    setCode('');
    setError(null);
  }

  function joinRoom() {
    if (busy) return;
    if (!code.trim()) {
      setError('Enter a room code.');
      return;
    }
    startPending('join');
    socketRef.current?.emit('join-room', { code: code.trim() });
  }

  function onCodeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') joinRoom();
    if (e.key === 'Escape') backToMenu();
  }

  return (
    <div data-testid="lobby-screen" style={screenStyle}>
      <h1 style={{ fontSize: '3rem', color: '#cc2222', margin: 0, letterSpacing: '4px' }}>Veins</h1>
      <p style={{ color: '#888', margin: 0, fontSize: '0.95rem', fontStyle: 'italic' }}>
        A roguelike you literally cannot beat by yourself.
      </p>

      {!connected && (
        <p data-testid="connection-status" role="status" style={{ color: '#e0a000', margin: 0 }}>
          Connecting to server…
        </p>
      )}

      {view === 'menu' ? (
        <div style={panelStyle}>
          <button
            data-testid="create-room-btn"
            onClick={createRoom}
            disabled={busy}
            aria-label="Create a new room"
            style={{ ...primaryBtnStyle, ...(busy ? disabledBtnStyle : null) }}
          >
            {pending === 'create' ? 'Creating…' : 'Create Room'}
          </button>

          <button
            data-testid="join-room-btn"
            onClick={openJoin}
            disabled={!connected}
            aria-label="Join an existing room"
            style={{ ...primaryBtnStyle, ...(!connected ? disabledBtnStyle : null) }}
          >
            Join Room
          </button>
        </div>
      ) : (
        <div style={panelStyle}>
          <button
            data-testid="back-btn"
            onClick={backToMenu}
            aria-label="Back to main menu"
            style={backBtnStyle}
          >
            ← Back
          </button>

          <p style={{ color: '#888', margin: 0, fontSize: '0.85rem' }}>ENTER ROOM CODE</p>

          <input
            data-testid="code-input"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={onCodeKeyDown}
            placeholder="ROOM CODE"
            aria-label="Room code"
            maxLength={6}
            disabled={!connected}
            autoFocus
            style={inputStyle}
          />

          <button
            data-testid="join-submit-btn"
            onClick={joinRoom}
            disabled={busy}
            aria-label="Join room with this code"
            style={{ ...primaryBtnStyle, ...(busy ? disabledBtnStyle : null) }}
          >
            {pending === 'join' ? 'Joining…' : 'Join'}
          </button>
        </div>
      )}

      {error && (
        <p data-testid="lobby-error" role="alert" style={{ color: '#ff4444', margin: 0 }}>
          {error}
        </p>
      )}

      {canInstall && view === 'menu' && (
        <button
          data-testid="install-app-btn"
          onClick={promptInstall}
          style={{ ...backBtnStyle, marginTop: '8px' }}
        >
          Install App
        </button>
      )}
    </div>
  );
}

const screenStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100vw',
  height: '100vh',
  background: '#0d0d0d',
  color: '#ffffff',
  gap: '16px',
};

// Vertical stack so both views line up the same way and buttons share a width.
const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '12px',
  width: '220px',
};

const primaryBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 24px',
  fontSize: '1rem',
  cursor: 'pointer',
  background: '#333',
  color: '#fff',
  border: '1px solid #666',
  borderRadius: '4px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  fontSize: '1.1rem',
  textAlign: 'center',
  background: '#1a1a1a',
  color: '#fff',
  border: '1px solid #555',
  borderRadius: '4px',
  textTransform: 'uppercase',
  letterSpacing: '4px',
};

const backBtnStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  padding: '6px 12px',
  fontSize: '0.85rem',
  cursor: 'pointer',
  background: 'transparent',
  color: '#aaa',
  border: '1px solid #444',
  borderRadius: '4px',
};

const disabledBtnStyle: React.CSSProperties = {
  cursor: 'not-allowed',
  opacity: 0.5,
};
