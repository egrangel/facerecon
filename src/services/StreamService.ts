import { webSocketStreamService } from './WebSocketStreamService';

// Legacy interface - kept for compatibility but all streaming now uses WebSocket
export interface StreamSession {
  id: string;
  cameraId: number;
  organizationId?: number;
  rtspUrl: string;
  isActive: boolean;
  createdAt: Date;
  lastAccessed: Date;
  faceRecognitionEnabled?: boolean;
}

/**
 * StreamService - Simplified wrapper around WebSocketStreamService
 * All streaming now uses WebSocket for ultra-low latency (200-500ms vs HLS 10-30 seconds)
 */
export class StreamService {
  private static instance: StreamService;

  constructor() {
    console.log('StreamService initialized - using WebSocket streaming only');
  }

  public static getInstance(): StreamService {
    if (!StreamService.instance) {
      StreamService.instance = new StreamService();
    }
    return StreamService.instance;
  }

  /**
   * Start WebSocket stream for a camera
   */
  public async startStream(
    cameraId: number,
    rtspUrl: string,
    organizationId?: number,
    enableFaceRecognition: boolean = false
  ): Promise<string> {
    // All streaming now uses WebSocket for ultra-low latency
    return await webSocketStreamService.startStream(cameraId, rtspUrl, organizationId, enableFaceRecognition);
  }

  /**
   * Stop stream
   */
  public stopStream(sessionId: string): boolean {
    return webSocketStreamService.stopStream(sessionId);
  }

  /**
   * Check if stream is active
   */
  public isStreamActive(sessionId: string): boolean {
    return webSocketStreamService.isStreamActive(sessionId);
  }

  /**
   * Get active sessions (WebSocket only)
   */
  public getActiveSessions(): any[] {
    return webSocketStreamService.getActiveSessions();
  }

  /**
   * Stop all streams
   */
  public stopAllStreams(): void {
    webSocketStreamService.stopAllStreams();
  }

  /**
   * Get service health
   */
  public getServiceHealth() {
    const webSocketHealth = webSocketStreamService.getServiceHealth();
    return {
      streamType: 'websocket',
      websocket: webSocketHealth,
      uptime: process.uptime(),
    };
  }

  // Legacy methods for compatibility - these are no longer used but kept to avoid breaking changes

  /**
   * @deprecated WebSocket streaming doesn't use URLs like HLS
   */
  public getStreamUrl(sessionId: string): string | null {
    // WebSocket streams don't have URLs like HLS
    return '/ws/stream';
  }

  /**
   * @deprecated WebSocket streaming doesn't use file paths
   */
  public getStreamPath(sessionId: string): string | null {
    // WebSocket streams don't have file paths
    return null;
  }

  /**
   * @deprecated WebSocket streaming doesn't use segments
   */
  public getSegmentPath(sessionId: string, segmentName: string): string | null {
    // WebSocket streams don't have segments
    return null;
  }
}

// Export singleton instance
export const streamService = StreamService.getInstance();