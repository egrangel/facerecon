import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
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
  updateStream: (cameraId: number, updates: Partial<StreamSession>) => void;
  refreshStream: (cameraId: number) => Promise<void>;
  subscribeToCamera: (cameraId: number, callback: () => void) => () => void;
}

const WebSocketStreamContext = createContext<WebSocketStreamContextValue | undefined>(undefined);

export const useWebSocketStream = () => {
  const context = useContext(WebSocketStreamContext);
  if (!context) {
    throw new Error('useWebSocketStream must be used within a WebSocketStreamProvider');
  }
  return context;
};

// Custom hook for camera-specific state that doesn't cause global re-renders
export const useCameraStream = (cameraId: number) => {
  const context = useWebSocketStream();
  const [, forceUpdate] = useState({});

  // Subscribe to this specific camera's updates only
  useEffect(() => {
    const unsubscribe = context.subscribeToCamera(cameraId, () => {
      forceUpdate({});
    });

    return unsubscribe;
  }, [context, cameraId]);

  // Return camera-specific methods and state
  return {
    stream: context.streams.get(cameraId),
    state: context.getStreamState(cameraId),
    startStream: () => context.startStream(cameraId),
    stopStream: () => context.stopStream(cameraId),
    refreshStream: () => context.refreshStream(cameraId),
  };
};

interface WebSocketStreamProviderProps {
  children: React.ReactNode;
}

export const WebSocketStreamProvider: React.FC<WebSocketStreamProviderProps> = ({ children }) => {
  const [streams] = useState<Map<number, StreamSession>>(new Map());
  const [updateCounter, setUpdateCounter] = useState(0);
  const cameraSubscriptions = useRef<Map<number, Set<() => void>>>(new Map());

  // Targeted update for specific cameras only
  const triggerCameraUpdate = useCallback((cameraId: number) => {
    const callbacks = cameraSubscriptions.current.get(cameraId);
    if (callbacks) {
      callbacks.forEach(callback => {
        requestAnimationFrame(callback);
      });
    }
  }, []);

  // Global update only when absolutely necessary (like clearing all streams)
  const triggerGlobalUpdate = useCallback(() => {
    requestAnimationFrame(() => {
      setUpdateCounter(prev => prev + 1);
    });
  }, []);

  // Clear all streams on app startup to prevent stale session issues
  useEffect(() => {
    console.log('WebSocketStreamProvider initialized - clearing any existing streams');
    streams.clear();
    triggerGlobalUpdate(); // Only use global update for initialization
  }, [triggerGlobalUpdate]);

  // Add page visibility handling to detect navigation back to cameras page
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('Page became visible - validating stream sessions');

        // Check all existing stream sessions for validity
        const streamEntries = Array.from(streams.entries());
        for (const [cameraId, stream] of streamEntries) {
          if (stream.isPlaying && stream.sessionId) {
            try {
              // Quick validation by checking if session still exists
              const response = await apiClient.getCameraStreamUrl(cameraId);
              if (response.sessionId !== stream.sessionId) {
                console.log(`📱 SESSION: Session mismatch for camera ${cameraId} (frontend: ${stream.sessionId}, backend: ${response.sessionId})`);
                stream.hasError = true;
                stream.errorMessage = 'Stream session expired - click refresh to restart';
                stream.isPlaying = false;
                triggerCameraUpdate(cameraId);
              } else {
                console.log(`✅ SESSION: Session ${stream.sessionId} for camera ${cameraId} is still valid`);
              }
            } catch (error: any) {
              console.log(`❌ SESSION: Session validation failed for camera ${cameraId}:`, error.message || error);
              stream.hasError = true;
              stream.errorMessage = 'Stream session not found - click refresh to restart';
              stream.isPlaying = false;
              triggerCameraUpdate(cameraId);
            }
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [streams, triggerCameraUpdate]);

  // Cleanup live streams when browser/tab is closed (keep facial recognition running)
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      console.log('Browser closing - cleaning up live viewing streams only');

      // Get all active live viewing streams
      const liveStreams = Array.from(streams.values()).filter(stream =>
        stream.isPlaying && stream.sessionId
      );

      if (liveStreams.length > 0) {
        console.log(`Stopping ${liveStreams.length} live viewing streams before browser close`);

        // Use optimized bulk cleanup endpoint
        const apiUrl = process.env.REACT_APP_API_URL || 'http://192.168.1.2:3001/api/v1';
        const cleanupUrl = `${apiUrl}/streams/cleanup`;
        const sessionIds = liveStreams.map(stream => stream.sessionId);

        try {
          // Try sendBeacon first (most reliable for browser close)
          if (navigator.sendBeacon) {
            const formData = new FormData();
            formData.append('sessionIds', sessionIds.join(','));
            const sent = navigator.sendBeacon(cleanupUrl, formData);
            console.log(`Cleanup beacon sent: ${sent}, sessions: ${sessionIds.join(', ')}`);
          } else {
            // Fallback to synchronous fetch for older browsers
            fetch(cleanupUrl, {
              method: 'POST',
              keepalive: true,
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ sessionIds }),
            }).catch(error => {
              console.warn('Cleanup fallback failed:', error);
            });
          }
        } catch (error) {
          console.warn('Failed to send cleanup request:', error);
        }
      }
    };

    // Add beforeunload listener
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Add pagehide listener as backup (more reliable on mobile/modern browsers)
    window.addEventListener('pagehide', handleBeforeUnload);

    // Add visibilitychange listener for additional coverage
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleBeforeUnload(new Event('visibilitychange') as any);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [streams]);

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
    // Check if we have an existing stream that might be stale
    const existingStream = streams.get(cameraId);
    if (existingStream && existingStream.sessionId) {
      console.log(`Checking existing session ${existingStream.sessionId} for camera ${cameraId}`);

      try {
        // Validate the existing session
        const response = await apiClient.getCameraStreamUrl(cameraId);
        if (response.sessionId === existingStream.sessionId && existingStream.isPlaying) {
          // Session is still valid, just update access time
          existingStream.lastAccessed = Date.now();
          console.log(`Reusing valid session ${existingStream.sessionId} for camera ${cameraId}`);
          return;
        } else {
          // Session is stale, clean it up
          console.log(`Cleaning up stale session ${existingStream.sessionId} for camera ${cameraId}`);
          try {
            await apiClient.stopStream(existingStream.sessionId);
          } catch (cleanupError) {
            console.log('Stale session already cleaned up on backend');
          }
        }
      } catch (error) {
        console.log('Session validation failed, creating fresh session');
      }
    }

    // Create a fresh stream session
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
    // Only update this specific camera
    triggerCameraUpdate(cameraId);

    try {
      // Get or create backend WebSocket stream session for video display only
      const response = await apiClient.getCameraStreamUrl(cameraId);
      stream.sessionId = response.sessionId;
      stream.streamUrl = response.streamUrl;

      // WebSocket stream started successfully

      // The WebSocketStreamPlayer component will handle the actual connection
      stream.isLoading = false;
      stream.isPlaying = true;
      // Only update this specific camera
      triggerCameraUpdate(cameraId);

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
      } else if (error.response?.status === 404) {
        stream.errorMessage = 'Camera not found or not configured';
        // Clear the stream since the camera doesn't exist
        streams.delete(cameraId);
      } else if (error.response?.data?.message) {
        stream.errorMessage = error.response.data.message;
      } else if (error.message) {
        stream.errorMessage = error.message;
      } else {
        stream.errorMessage = 'Failed to start WebSocket stream';
      }

      triggerCameraUpdate(cameraId);
    }
  }, [streams, triggerGlobalUpdate]);

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
      triggerCameraUpdate(cameraId);

    } catch (error) {
      console.error('Error stopping WebSocket stream:', error);
      // Remove from state even if backend call fails
      streams.delete(cameraId);
      triggerCameraUpdate(cameraId);
    }
  }, [streams, triggerGlobalUpdate]);

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
    // Create a completely fresh stream session to avoid any stale state issues
    const oldSessionId = streams.get(cameraId)?.sessionId;

    // Remove the old stream first to prevent conflicts
    streams.delete(cameraId);
    triggerCameraUpdate(cameraId);

    try {
      // Try to stop the old backend stream if it exists
      if (oldSessionId) {
        try {
          await apiClient.stopStream(oldSessionId);
        } catch (stopError: any) {
          // Session might already be stopped, which is fine
          console.log(`Old session ${oldSessionId} was already stopped or not found`);
        }
      }

      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 500));

      // Start completely fresh stream
      await startStream(cameraId);
    } catch (error: any) {
      console.error('Error refreshing stream:', error);

      // Create a fresh error state for this camera only
      const errorStream = {
        sessionId: '',
        cameraId,
        streamUrl: '',
        isPlaying: false,
        isLoading: false,
        hasError: true,
        errorMessage: 'Failed to refresh stream',
        lastAccessed: Date.now(),
        streamType: 'websocket' as const,
      };

      streams.set(cameraId, errorStream);
      triggerCameraUpdate(cameraId);
    }
  }, [streams, startStream, triggerGlobalUpdate]);

  const updateStream = useCallback((cameraId: number, updates: Partial<StreamSession>) => {
    const stream = streams.get(cameraId);
    if (stream) {
      Object.assign(stream, updates);
      // Minimal update - only trigger re-render for state changes
      triggerCameraUpdate(cameraId);
    }
  }, [streams, triggerCameraUpdate]);

  const subscribeToCamera = useCallback((cameraId: number, callback: () => void) => {
    if (!cameraSubscriptions.current.has(cameraId)) {
      cameraSubscriptions.current.set(cameraId, new Set());
    }

    cameraSubscriptions.current.get(cameraId)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = cameraSubscriptions.current.get(cameraId);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          cameraSubscriptions.current.delete(cameraId);
        }
      }
    };
  }, []);

  const value: WebSocketStreamContextValue = {
    streams,
    startStream,
    stopStream,
    getStreamState,
    updateStream,
    refreshStream,
    subscribeToCamera,
  };

  return (
    <WebSocketStreamContext.Provider value={value}>
      {children}
    </WebSocketStreamContext.Provider>
  );
};