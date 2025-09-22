import React, { useRef, useEffect, useState, useCallback } from 'react';

interface WebSocketStreamPlayerProps {
  sessionId: string;
  className?: string;
  onError?: (error: string) => void;
  onStreamStart?: () => void;
  onStreamStop?: () => void;
}

interface WebSocketMessage {
  type: 'frame' | 'subscribed' | 'stream_stopped' | 'error';
  sessionId?: string;
  data?: string;
  message?: string;
  timestamp?: number;
}

export const WebSocketStreamPlayer: React.FC<WebSocketStreamPlayerProps> = ({
  sessionId,
  className = '',
  onError,
  onStreamStart,
  onStreamStop,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [frameCount, setFrameCount] = useState(0);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    // Use the same host as the API URL for WebSocket connection
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';
    const apiHost = new URL(apiUrl).host; // Extract host:port from API URL
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${apiHost}/ws/stream`;
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);

        // Subscribe to the stream
        const subscribeMessage = {
          type: 'subscribe',
          sessionId: sessionId
        };
        ws.send(JSON.stringify(subscribeMessage));
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          switch (message.type) {
            case 'subscribed':
              setIsLoading(false);
              onStreamStart?.();
              break;

            case 'frame':
              if (message.data && canvasRef.current) {
                drawFrame(message.data);
                setFrameCount(prev => prev + 1);
              } else {
              }
              break;

            case 'stream_stopped':
              console.log('Stream stopped:', message.message);
              setIsLoading(false);
              onStreamStop?.();
              break;

            case 'error':
              console.error('WebSocket stream error:', message.message);
              setError(message.message || 'Unknown stream error');
              setIsLoading(false);
              onError?.(message.message || 'Unknown stream error');
              break;

            default:
              console.warn('Unknown message type:', message.type);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err, 'Raw data:', event.data.substring(0, 100));
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        setIsLoading(false);

        // Attempt to reconnect after a delay unless it was intentionally closed
        if (event.code !== 1000) {
          setTimeout(() => {
            if (sessionId) {
              connectWebSocket();
            }
          }, 3000);
        }
      };

    } catch (err) {
      console.error('Failed to create WebSocket connection:', err);
      setError('Failed to create WebSocket connection');
      setIsLoading(false);
      onError?.('Failed to create WebSocket connection');
    }
  }, [sessionId, onError, onStreamStart, onStreamStop]);

  const drawFrame = useCallback((base64Data: string) => {
    console.log('drawFrame called with data length:', base64Data.length);

    const canvas = canvasRef.current;
    if (!canvas) {
      console.error('Canvas not available');
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Canvas context not available');
      return;
    }

    const img = new Image();
    img.onload = () => {
      console.log(`Image loaded successfully: ${img.width}x${img.height}`);

      // Set canvas size to match image
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw the frame
      ctx.drawImage(img, 0, 0);
      console.log('Frame drawn to canvas');
    };

    img.onerror = (err) => {
      console.error('Error loading frame image:', err);
      console.error('Base64 data preview:', base64Data.substring(0, 100));
    };

    // Set the image source to the base64 data
    const dataUrl = `data:image/jpeg;base64,${base64Data}`;
    console.log('Setting image src, data URL length:', dataUrl.length);
    img.src = dataUrl;
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      // Send unsubscribe message
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'unsubscribe'
        }));
      }

      wsRef.current.close(1000, 'Component unmounting');
      wsRef.current = null;
    }
    setIsConnected(false);
    setFrameCount(0);
  }, []);

  // Connect when component mounts or sessionId changes
  useEffect(() => {
    if (sessionId) {
      // Only proceed if this is a valid sessionId (not empty string)
      if (sessionId.length > 0) {
        // Clear all states when sessionId changes (fresh start)
        setIsLoading(true);
        setError(null);
        setIsConnected(false);
        setFrameCount(0);

        // Disconnect any existing connection first
        disconnect();

        // Wait a moment for the backend session to be fully ready
        // This prevents "stream session not found" errors when restarting streams
        const connectTimer = setTimeout(() => {
          connectWebSocket();
        }, 500);

        return () => {
          clearTimeout(connectTimer);
          disconnect();
        };
      } else {
        // If sessionId is empty, just clear states but don't try to connect
        setIsLoading(false);
        setError(null);
        setIsConnected(false);
        setFrameCount(0);
        disconnect();
      }
    } else {
      // No sessionId, clear everything
      setIsLoading(false);
      setError(null);
      setIsConnected(false);
      setFrameCount(0);
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [sessionId, connectWebSocket, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain bg-black"
        style={{ display: isLoading || error ? 'none' : 'block' }}
      />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
            <p className="text-white text-sm">Connecting to stream...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900 bg-opacity-75">
          <div className="text-center">
            <p className="text-white text-sm mb-2">❌ {error}</p>
            <button
              onClick={connectWebSocket}
              className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
};