import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

// Returns a stable Socket.io client socket. The socket is connected once on
// mount and cleaned up on unmount. Consumers get a ref — never a new object.
export function useSocket(): React.RefObject<Socket | null> {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(SERVER_URL, { autoConnect: true });
    socketRef.current = socket;
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return socketRef;
}
