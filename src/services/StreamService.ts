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
   * Start WebSocket stream for a camera (video display only, no facial recognition)
   */
  public async startStream(
    cameraId: number,
    rtspUrl: string,
    organizationId?: number
  ): Promise<string> {
    // All streaming now uses WebSocket for ultra-low latency video display
    return await webSocketStreamService.startStream(cameraId, rtspUrl, organizationId);
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
 
}

// Export singleton instance
export const streamService = StreamService.getInstance();