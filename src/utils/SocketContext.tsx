'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { getCookie } from 'cookies-next';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  sendMessage: (data: any) => void;
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
}

const defaultContext: SocketContextType = {
  socket: null,
  isConnected: false,
  sendMessage: () => {},
  joinConversation: () => {},
  leaveConversation: () => {}
};

const SocketContext = createContext<SocketContextType>(defaultContext);

export const useSocket = () => useContext(SocketContext);

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeRooms, setActiveRooms] = useState<Set<string>>(new Set());
  const [connectionAttempts, setConnectionAttempts] = useState(0);

  // Initialize socket connection
  useEffect(() => {
    const token = getCookie('token');
    if (!token) {
      console.warn('No authentication token found, skipping socket connection');
      return;
    }

    // IMPORTANT: Use the correct socket URL with port 4001
    // This should match your server configuration
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4001';
    
    console.log('Attempting socket connection to:', socketUrl);

    // Create socket instance with authentication
    const socketInstance = io(socketUrl, {
      auth: { token },
      withCredentials: true,
      transports: ['websocket', 'polling'], // Try websocket first, fall back to polling
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000
    });

    // Connection event handlers
    socketInstance.on('connect', () => {
      console.log('✅ Socket connected successfully with ID:', socketInstance.id);
      setIsConnected(true);
      setConnectionAttempts(0);
      
      // Rejoin any active rooms on reconnect
      activeRooms.forEach(roomId => {
        socketInstance.emit('joinConversation', roomId);
        console.log('Rejoined room after reconnect:', roomId);
      });
    });

    socketInstance.on('connect_error', (err) => {
      const attempts = connectionAttempts + 1;
      setConnectionAttempts(attempts);
      console.error(`❌ Socket connection error (attempt ${attempts}):`, err.message);
      setIsConnected(false);
      
      // After multiple failed attempts, log more debug info
      if (attempts >= 3) {
        console.warn('Connection troubleshooting info:', {
          url: socketUrl,
          token: token ? '✓ Present' : '✗ Missing',
          transports: ['websocket', 'polling']
        });
      }
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      setIsConnected(false);
    });

    socketInstance.on('error', (error) => {
      console.error('🛑 Socket error:', error);
    });

    // Debug event - listen for ANY message
    socketInstance.onAny((event, ...args) => {
      console.log(`📡 Socket Event [${event}]:`, args);
    });

    // Test ping/pong
    socketInstance.on('connect', () => {
      console.log('Sending ping test...');
      socketInstance.emit('ping');
    });
    
    socketInstance.on('pong', (data) => {
      console.log('✓ Received pong from server:', data);
    });

    setSocket(socketInstance);

    // Cleanup on unmount
    return () => {
      console.log('Cleaning up socket connection');
      socketInstance.disconnect();
    };
  }, [connectionAttempts]);

  // Send message helper
  const sendMessage = useCallback((data: any) => {
    if (!socket || !isConnected) {
      console.warn('Cannot send message: Socket not connected');
      return false;
    }
    
    if (!data.conversationId) {
      console.error('Cannot send message: No conversationId provided');
      return false;
    }
    
    try {
      console.log('Sending message via socket:', data);
      socket.emit('message', {
        type: 'NEW_MESSAGE',
        payload: data
      });
      return true;
    } catch (error) {
      console.error('Error sending message via socket:', error);
      return false;
    }
  }, [socket, isConnected]);

  // Join conversation helper
  const joinConversation = useCallback((conversationId: string) => {
    if (!socket || !isConnected || !conversationId) return;
    
    try {
      socket.emit('joinConversation', conversationId);
      console.log('Joined conversation room:', conversationId);
      
      // Track active rooms
      setActiveRooms(prev => {
        const updated = new Set(prev);
        updated.add(conversationId);
        return updated;
      });
    } catch (error) {
      console.error('Error joining conversation:', error);
    }
  }, [socket, isConnected]);

  // Leave conversation helper
  const leaveConversation = useCallback((conversationId: string) => {
    if (!socket || !conversationId) return;
    
    try {
      socket.emit('leaveConversation', conversationId);
      console.log('Left conversation room:', conversationId);
      
      // Update active rooms
      setActiveRooms(prev => {
        const updated = new Set(prev);
        updated.delete(conversationId);
        return updated;
      });
    } catch (error) {
      console.error('Error leaving conversation:', error);
    }
  }, [socket]);

  // For development debugging
  useEffect(() => {
    console.log('Socket Provider State:', { 
      socketInstance: socket?.id || 'Not connected',
      connected: isConnected, 
      activeRooms: Array.from(activeRooms) 
    });
  }, [socket, isConnected, activeRooms]);

  const value = {
    socket,
    isConnected,
    sendMessage,
    joinConversation,
    leaveConversation
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};