import React, { useState, useCallback } from 'react';
import { WebSocketStreamPlayer } from './WebSocketStreamPlayer';
import { useWebSocketStream } from '../contexts/WebSocketStreamContext';

interface StreamPlayerProps {
  cameraId: number;
  className?: string;
  onError?: (error: string) => void;
}

/**
 * StreamPlayer - WebSocket-only streaming component
 * Provides ultra-low latency streaming (200-500ms) perfect for real-time facial recognition
 */
export const StreamPlayer: React.FC<StreamPlayerProps> = ({
  cameraId,
  className = '',
  onError,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // WebSocket streaming context
  const webSocketStream = useWebSocketStream();
  const webSocketState = webSocketStream.getStreamState(cameraId);
  const webSocketSession = webSocketStream.streams.get(cameraId);

  const startStream = useCallback(async () => {
    try {
      console.log(`Starting WebSocket stream for camera ${cameraId}`);
      await webSocketStream.startStream(cameraId);
      console.log('WebSocket stream started, session:', webSocketSession);
      setIsPlaying(true);
    } catch (error: any) {
      console.error('Error starting stream:', error);
      setError(error.message || 'Failed to start stream');
      onError?.(error.message || 'Failed to start stream');
    }
  }, [cameraId, webSocketStream, webSocketSession, onError]);

  const stopStream = useCallback(async () => {
    try {
      await webSocketStream.stopStream(cameraId);
      setIsPlaying(false);
      setError(null);
    } catch (error: any) {
      console.error('Error stopping stream:', error);
    }
  }, [cameraId, webSocketStream]);

  const refreshStream = useCallback(async () => {
    await webSocketStream.refreshStream(cameraId);
    setError(null);
  }, [cameraId, webSocketStream]);

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    console.error(`Camera ${cameraId} stream error:`, errorMessage);
    onError?.(errorMessage);
  }, [cameraId, onError]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <div className={`relative ${className}`}>
      {/* Stream Type Indicator */}
      {/* <div className="absolute top-2 left-2 z-10 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
        📡 WebSocket
        <span className="ml-1 text-green-400">◝ Ultra Low Latency</span>
      </div> */}

      {/* WebSocket Stream Player */}
      {webSocketSession && webSocketSession.sessionId && (
        <WebSocketStreamPlayer
          sessionId={webSocketSession.sessionId}
          className="w-full h-full"
          onError={handleError}
          onStreamStart={() => setIsPlaying(true)}
          onStreamStop={() => setIsPlaying(false)}
        />
      )}

      {/* Small error indicator (doesn't block video) */}
      {(webSocketState.hasError || error) && webSocketSession?.sessionId && (
        <div className="absolute top-2 right-2 z-10">
          <div className="bg-red-600 bg-opacity-90 text-white text-xs px-2 py-1 rounded flex items-center space-x-1">
            <span>⚠️</span>
            <span>Connection issue</span>
            <button
              onClick={clearError}
              className="ml-1 text-red-200 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* No stream active or waiting for session ID */}
      {(!webSocketSession || !webSocketSession.sessionId) && (
        <div className="w-full h-full bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            {webSocketSession && !webSocketSession.sessionId ? (
              <div className="text-white">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mx-auto mb-2"></div>
                <p className="text-sm">Connecting to stream...</p>
              </div>
            ) : (
              <button
                onClick={startStream}
                disabled={webSocketState.isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {webSocketState.isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Starting...
                  </div>
                ) : (
                  'Start Stream'
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error State - Only show if there's a real error and no stream is playing */}
      {(webSocketState.hasError || error) && !webSocketSession?.sessionId && (
        <div className="absolute inset-0 bg-red-900 bg-opacity-75 flex items-center justify-center">
          <div className="text-center text-white">
            <p className="text-sm mb-2">❌ {webSocketState.errorMessage || error}</p>
            <div className="space-x-2">
              <button
                onClick={refreshStream}
                className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
              >
                Retry
              </button>
              <button
                onClick={clearError}
                className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Control Buttons */}
      {webSocketSession && webSocketSession.sessionId && !webSocketState.hasError && !error && (
        <div className="absolute bottom-2 left-2 z-10 space-x-2">
          <button
            onClick={isPlaying ? stopStream : startStream}
            className="px-3 py-1 bg-gray-800 bg-opacity-75 text-white text-xs rounded hover:bg-gray-700"
          >
            {isPlaying ? '❹︝ Stop' : '▶︝ Play'}
          </button>
          <button
            onClick={refreshStream}
            className="px-3 py-1 bg-gray-800 bg-opacity-75 text-white text-xs rounded hover:bg-gray-700"
          >
            🔄 Refresh
          </button>
        </div>
      )}
    </div>
  );
};