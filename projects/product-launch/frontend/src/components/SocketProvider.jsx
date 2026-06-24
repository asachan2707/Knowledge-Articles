import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SocketCtx = createContext(null);

export function SocketProvider({ children }) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Vite proxy forwards /socket.io → localhost:4000
    socketRef.current = io({ path: '/socket.io', transports: ['websocket', 'polling'] });

    const s = socketRef.current;
    s.on('connect',    () => setConnected(true));
    s.on('disconnect', () => setConnected(false));

    return () => s.disconnect();
  }, []);

  return (
    <SocketCtx.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </SocketCtx.Provider>
  );
}

export function useSocket() {
  return useContext(SocketCtx);
}
