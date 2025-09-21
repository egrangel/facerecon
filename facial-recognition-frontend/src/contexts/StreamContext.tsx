import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import Hls from 'hls.js';
import { apiClient } from '../services/api';

interface StreamSession {
  sessionId: string;
  cameraId: number;
  streamUrl: string;
  hlsInstance: Hls | null;
  videoElement: HTMLVideoElement | null;
  isPlaying: boolean;
  isLoading: boolean;
  hasError: boolean;
  errorMessage: string;
  lastAccessed: number;
}

interface StreamContextValue {
  streams: Map<number, StreamSession>;
  startStream: (cameraId: number, videoElement: HTMLVideoElement) => Promise<void>;
  stopStream: (cameraId: number) => Promise<void>;
  getStreamState: (cameraId: number) => {
    isPlaying: boolean;
    isLoading: boolean;
    hasError: boolean;
    errorMessage: string;
  };
  attachVideoElement: (cameraId: number, videoElement: HTMLVideoElement) => void;
  detachVideoElement: (cameraId: number) => void;
  refreshStream: (cameraId: number) => Promise<void>;
}

const StreamContext = createContext<StreamContextValue | undefined>(undefined);

export const useStream = () => {
  const context = useContext(StreamContext);
  if (!context) {
    throw new Error('useStream must be used within a StreamProvider');
  }
  return context;
};

interface StreamProviderProps {
  children: React.ReactNode;
}

export const StreamProvider: React.FC<StreamProviderProps> = ({ children }) => {
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
        if (!stream.videoElement && now - stream.lastAccessed > INACTIVE_TIMEOUT) {
          console.log(`Cleaning up inactive stream for camera ${cameraId}`);
          stopStream(cameraId);
        }
      });
    }, 60000); // Check every minute

    return () => clearInterval(cleanup);
  }, []);

  const startStream = useCallback(async (cameraId: number, videoElement: HTMLVideoElement) => {
    let stream = streams.get(cameraId);

    if (!stream) {
      // Create new stream session
      stream = {
        sessionId: '',
        cameraId,
        streamUrl: '',
        hlsInstance: null,
        videoElement: null,
        isPlaying: false,
        isLoading: true,
        hasError: false,
        errorMessage: '',
        lastAccessed: Date.now(),
      };
      streams.set(cameraId, stream);
    }

    // Update stream state
    stream.isLoading = true;
    stream.hasError = false;
    stream.errorMessage = '';
    stream.videoElement = videoElement;
    stream.lastAccessed = Date.now();
    triggerUpdate();

    try {
      // Get or create backend stream session
      const response = await apiClient.getCameraStreamUrl(cameraId);
      stream.sessionId = response.sessionId;
      stream.streamUrl = response.streamUrl;

      // Initialize HLS player if not already created
      if (!stream.hlsInstance) {
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: false,
            lowLatencyMode: true,
            backBufferLength: 90,
          });

          stream.hlsInstance = hls;
          const src = `${process.env.REACT_APP_API_URL}${response.streamUrl}`;
          hls.loadSource(src);
          hls.attachMedia(videoElement);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            stream!.isLoading = false;
            stream!.isPlaying = true;
            triggerUpdate();
            videoElement.play().catch(err => {
              console.warn('Autoplay failed:', err);
              stream!.hasError = true;
              stream!.errorMessage = 'Autoplay bloqueado. Clique para reproduzir.';
              triggerUpdate();
            });
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            console.error('HLS Error:', event, data);
            if (data.fatal) {
              stream!.isLoading = false;
              stream!.hasError = true;
              stream!.isPlaying = false;
              stream!.errorMessage = `Erro no stream: ${data.type} - ${data.details}`;
              triggerUpdate();
            }
          });

        } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
          // Safari native HLS support
          videoElement.src = `${process.env.REACT_APP_API_URL}${response.streamUrl}`;

          videoElement.addEventListener('loadedmetadata', () => {
            stream!.isLoading = false;
            stream!.isPlaying = true;
            triggerUpdate();
          });

          videoElement.addEventListener('error', () => {
            stream!.isLoading = false;
            stream!.hasError = true;
            stream!.isPlaying = false;
            stream!.errorMessage = 'Erro ao carregar o stream';
            triggerUpdate();
          });

          videoElement.load();
        } else {
          throw new Error('HLS not supported in this browser');
        }
      } else {
        // Re-attach existing HLS instance to new video element
        stream.hlsInstance.attachMedia(videoElement);
        stream.isLoading = false;
        stream.isPlaying = true;
        triggerUpdate();
        videoElement.play().catch(err => {
          console.warn('Autoplay failed:', err);
          stream!.hasError = true;
          stream!.errorMessage = 'Autoplay bloqueado. Clique para reproduzir.';
          triggerUpdate();
        });
      }

    } catch (error: any) {
      console.error('Error starting stream:', error);
      stream.isLoading = false;
      stream.hasError = true;
      stream.isPlaying = false;
      stream.errorMessage = error.response?.data?.message || error.message || 'Erro ao iniciar stream';
      triggerUpdate();
    }
  }, [streams, triggerUpdate]);

  const stopStream = useCallback(async (cameraId: number) => {
    const stream = streams.get(cameraId);
    if (!stream) return;

    try {
      // Stop HLS player
      if (stream.hlsInstance) {
        stream.hlsInstance.destroy();
        stream.hlsInstance = null;
      }

      if (stream.videoElement) {
        stream.videoElement.pause();
        stream.videoElement.src = '';
        stream.videoElement.load();
      }

      // Stop stream on backend
      if (stream.sessionId) {
        await apiClient.stopStream(stream.sessionId);
      }

      // Remove stream from state
      streams.delete(cameraId);
      triggerUpdate();

    } catch (error) {
      console.error('Error stopping stream:', error);
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

  const attachVideoElement = useCallback((cameraId: number, videoElement: HTMLVideoElement) => {
    const stream = streams.get(cameraId);
    if (stream) {
      stream.videoElement = videoElement;
      stream.lastAccessed = Date.now();

      // If stream is already playing, attach it to the new video element
      if (stream.hlsInstance && stream.isPlaying) {
        stream.hlsInstance.attachMedia(videoElement);
        videoElement.play().catch(err => {
          console.warn('Autoplay failed:', err);
        });
      }
    }
  }, [streams]);

  const detachVideoElement = useCallback((cameraId: number) => {
    const stream = streams.get(cameraId);
    if (stream) {
      stream.videoElement = null;
      stream.lastAccessed = Date.now();
    }
  }, [streams]);

  const refreshStream = useCallback(async (cameraId: number) => {
    const stream = streams.get(cameraId);
    if (!stream || !stream.videoElement) return;

    const videoElement = stream.videoElement;
    await stopStream(cameraId);
    setTimeout(() => startStream(cameraId, videoElement), 1000);
  }, [streams, startStream, stopStream]);

  const value: StreamContextValue = {
    streams,
    startStream,
    stopStream,
    getStreamState,
    attachVideoElement,
    detachVideoElement,
    refreshStream,
  };

  return (
    <StreamContext.Provider value={value}>
      {children}
    </StreamContext.Provider>
  );
};