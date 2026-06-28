import { useState, useEffect, useCallback } from 'react';
import type { RefObject } from 'react';
import type { Socket } from 'socket.io-client';
import { MdContentCopy, MdCheck } from 'react-icons/md';
import type { RoomSummary, RoomUpdateEvent } from '@veins/shared';
import { MAX_PLAYERS, MIN_PLAYERS_TO_START } from '@veins/shared';

type Props = {
  socketRef: RefObject<Socket | null>;
  room: RoomSummary;
  localPlayerId: string;
  connected: boolean;
  onLeave: () => void;
};

// Best-effort clipboard copy with a legacy fallback for insecure origins
// (navigator.clipboard is undefined on plain http:// and in some webviews).
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function WaitingRoom({ socketRef, room: initialRoom, localPlayerId, connected, onLeave }: Props) {
  const [room, setRoom] = useState<RoomSummary>(initialRoom);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    function onRoomUpdate(ev: RoomUpdateEvent) {
      setRoom(ev.room);
    }

    socket.on('ROOM_UPDATE', onRoomUpdate);
    return () => { socket.off('ROOM_UPDATE', onRoomUpdate); };
  }, [socketRef]);

  const [copied, setCopied] = useState(false);

  const isHost = localPlayerId === room.hostId;
  const enoughPlayers = room.players.length >= MIN_PLAYERS_TO_START;

  function startRun() {
    socketRef.current?.emit('start-run', undefined);
  }

  function leaveRoom() {
    // Tell the server, then return to the lobby immediately. Leaving is a local
    // intent — the server sends the leaver no ack (and deletes a now-empty room),
    // so we must not wait for an event to transition.
    socketRef.current?.emit('leave-room', undefined);
    onLeave();
  }

  const copyCode = useCallback(() => {
    void copyToClipboard(room.code).then(ok => {
      if (!ok) return;
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [room.code]);

  // Stable, friendly label per player: "Player N", with markers for self/host.
  function playerLabel(id: string, index: number): string {
    const base = id === localPlayerId ? 'You' : `Player ${index + 1}`;
    return id === room.hostId ? `${base} ★` : base;
  }

  const emptySlots = Math.max(0, MAX_PLAYERS - room.players.length);

  return (
    <div
      data-testid="waiting-room"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100vw',
        height: '100vh',
        background: '#0d0d0d',
        color: '#ffffff',
        gap: '16px',
      }}
    >
      <h1 style={{ fontSize: '2rem', color: '#cc2222', margin: 0 }}>Veins</h1>

      {!connected && (
        <p data-testid="connection-status" role="status" style={{ color: '#e0a000', margin: 0 }}>
          Disconnected — reconnecting…
        </p>
      )}

      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#888', margin: 0, fontSize: '0.85rem' }}>ROOM CODE</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
          <p
            data-testid="room-code"
            style={{ fontSize: '2rem', fontWeight: 'bold', letterSpacing: '6px', margin: '4px 0' }}
          >
            {room.code}
          </p>
          <button
            data-testid="copy-code-btn"
            onClick={copyCode}
            aria-label={copied ? 'Copied!' : 'Copy room code'}
            title={copied ? 'Copied!' : 'Copy room code'}
            style={iconBtnStyle}
          >
            {copied ? <MdCheck size={18} color="#4caf50" /> : <MdContentCopy size={18} />}
          </button>
        </div>
      </div>

      <ul
        data-testid="player-list"
        style={{ listStyle: 'none', padding: 0, margin: 0, textAlign: 'center' }}
      >
        {room.players.map((p, i) => (
          <li key={p} style={{ padding: '4px 0' }}>
            {playerLabel(p, i)}
          </li>
        ))}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <li
            key={`empty-${i}`}
            data-testid="empty-slot"
            style={{ padding: '4px 0', color: '#444', fontStyle: 'italic' }}
          >
            Empty
          </li>
        ))}
      </ul>

      <p style={{ color: '#555', margin: 0 }}>
        {room.players.length}/{MAX_PLAYERS} players
      </p>

      {isHost ? (
        <>
          <button
            data-testid="start-run-btn"
            onClick={startRun}
            disabled={!enoughPlayers || !connected}
            style={{ ...btnStyle, background: !enoughPlayers || !connected ? '#222' : '#550000' }}
          >
            Start Run
          </button>
          {!enoughPlayers && (
            <p data-testid="start-hint" style={{ color: '#888', margin: 0, fontSize: '0.8rem' }}>
              Need {MIN_PLAYERS_TO_START}+ players to start.
            </p>
          )}
          {enoughPlayers && room.players.length === 1 && (
            <p data-testid="solo-hint" style={{ color: '#888', margin: 0, fontSize: '0.8rem' }}>
              Start solo, or share the code to add friends.
            </p>
          )}
        </>
      ) : (
        <p data-testid="waiting-hint" style={{ color: '#888', margin: 0, fontSize: '0.9rem' }}>
          Waiting for host to start…
        </p>
      )}

      <button data-testid="leave-btn" onClick={leaveRoom} style={btnStyle}>
        Leave Room
      </button>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '10px 24px',
  fontSize: '1rem',
  cursor: 'pointer',
  background: '#333',
  color: '#fff',
  border: '1px solid #666',
  borderRadius: '4px',
};

const iconBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '6px',
  cursor: 'pointer',
  background: '#333',
  color: '#fff',
  border: '1px solid #666',
  borderRadius: '4px',
  lineHeight: 0,
};
