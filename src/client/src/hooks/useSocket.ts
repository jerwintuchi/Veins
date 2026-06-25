import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';
const PLAYER_ID_KEY = 'veins.playerId';

// A stable, per-browser player identity, persisted so a refresh or reconnect keeps
// the same id (reconnection spec R1). Passed to the server via the socket `auth`
// handshake, where it becomes the authoritative playerId for board ownership etc.
export function getStablePlayerId(): string {
  const fallback = (): string => `p-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  try {
    let id = localStorage.getItem(PLAYER_ID_KEY);
    if (!id) {
      id = globalThis.crypto?.randomUUID?.() ?? fallback();
      localStorage.setItem(PLAYER_ID_KEY, id);
    }
    return id;
  } catch {
    return fallback();
  }
}

// Returns a stable Socket.io client socket. The socket is connected once on
// mount and cleaned up on unmount. Consumers get a ref — never a new object.
// The stable player id rides the auth handshake so reconnects re-associate.
export function useSocket(): React.RefObject<Socket | null> {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(SERVER_URL, { autoConnect: true, auth: { playerId: getStablePlayerId() } });
    socketRef.current = socket;
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return socketRef;
}
