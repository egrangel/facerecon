import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { apiClient } from '../services/api';

interface StreamSession {
  sessionId: string;
  cameraId: number;
  streamUrl: string;
  isPlaying: boolean;
  isLoading: boolean;
  hasError: boolean;
  errorMessage: string;
  lastAccessed: number;
  streamType: 'websocket';
}

interface WebSocketStreamContextValue {
  streams: Map<number, StreamSession>;
  startStream: (cameraId: number) => Promise<void>;
  stopStream: (cameraId: number) => Promise<void>;
  getStreamState: (cameraId: number) => {
    isPlaying: boolean;
    isLoading: boolean;
    hasError: boolean;
    errorMessage: string;
  };
  refreshStream: (cameraId: number) => Promise<void>;
}

const WebSocketStreamContext = createContext<WebSocketStreamContextValue | undefined>(undefined);

export const useWebSocketStream = () => {
  const context = useContext(WebSocketStreamContext);
  if (!context) {
    throw new Error('useWebSocketStream must be used within a WebSocketStreamProvider');
  }
  return context;
};

interface WebSocketStreamProviderProps {
  children: React.ReactNode;
}

export const WebSocketStreamProvider: React.FC<WebSocketStreamProviderProps> = ({ children }) => {
  const [streams] = useState<Map<number, StreamSession>>(new Map());
  const [, forceUpdate] = useState({});

  // Force re-render when streams change
  const triggerUpdate = useCallback(() => {
    forceUpdate({});
  }, []);

  // Cleanup inactive streams periodically
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      const INACTIVE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

      streams.forEach((stream, cameraId) => {
        if (!stream.isPlaying && now - stream.lastAccessed > INACTIVE_TIMEOUT) {
          console.log(`Cleaning up inactive WebSocket stream for camera ${cameraId}`);
          stopStream(cameraId);
        }
      });
    }, 60000); // Check every minute

    return () => clearInterval(cleanup);
  }, []);

  const startStream = useCallback(async (cameraId: number) => {
    // Always create a fresh stream session to avoid stale sessionId issues
    const stream = {
      sessionId: '',
      cameraId,
      streamUrl: '',
      isPlaying: false,
      isLoading: true,
      hasError: false,
      errorMessage: '',
      lastAccessed: Date.now(),
      streamType: 'websocket' as const,
    };
    streams.set(cameraId, stream);
    triggerUpdate();

    try {
      // Get or create backend WebSocket stream session
      const response = await apiClient.getCameraStreamUrl(cameraId);
      stream.sessionId = response.sessionId;
      stream.streamUrl = response.streamUrl;

      console.log(`WebSocket stream started for camera ${cameraId}, session: ${stream.sessionId}`);

      // The WebSocketStreamPlayer component will handle the actual connection
      stream.isLoading = false;
      stream.isPlaying = true;
      triggerUpdate();

    } catch (error: any) {
      console.error('Error starting WebSocket stream:', error);
      stream.isLoading = false;
      stream.hasError = true;
      stream.isPlaying = false;

      // Better error messages based on the error type
      if (error.response?.status === 401) {
        stream.errorMessage = 'Authentication error - please login again';
      } else if (error.response?.status === 403) {
        stream.errorMessage = 'Access denied - insufficient permissions';
      } else if (error.response?.data?.message) {
        stream.errorMessage = error.response.data.message;
      } else if (error.message) {
        stream.errorMessage = error.message;
      } else {
        stream.errorMessage = 'Failed to start WebSocket stream';
      }

      triggerUpdate();
    }
  }, [streams, triggerUpdate]);

  const stopStream = useCallback(async (cameraId: number) => {
    const stream = streams.get(cameraId);
    if (!stream) return;

    try {
      // Stop stream on backend
      if (stream.sessionId) {
        await apiClient.stopStream(stream.sessionId);
      }

      // Remove stream from state
      streams.delete(cameraId);
      triggerUpdate();

    } catch (error) {
      console.error('Error stopping WebSocket stream:', error);
      // Remove from state even if backend call fails
      streams.delete(cameraId);
      triggerUpdate();
    }
  }, [streams, triggerUpdate]);

  const getStreamState = useCallback((cameraId: number) => {
    const stream = streams.get(cameraId);
    if (!stream) {
      return {
        isPlaying: false,
        isLoading: false,
        hasError: false,
        errorMessage: '',
      };
    }

    return {
      isPlaying: stream.isPlaying,
      isLoading: stream.isLoading,
      hasError: stream.hasError,
      errorMessage: stream.errorMessage,
    };
  }, [streams]);

  const refreshStream = useCallback(async (cameraId: number) => {
    await stopStream(cameraId);
    setTimeout(() => startStream(cameraId), 1000);
  }, [startStream, stopStream]);

  const value: WebSocketStreamContextValue = {
    streams,
    startStream,
    stopStream,
    getStreamState,
    refreshStream,
  };

  return (
    <WebSocketStreamContext.Provider value={value}>
      {children}
    </WebSocketStreamContext.Provider>
  );
};