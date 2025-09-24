import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { spawn, ChildProcess } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { createError } from '../middlewares/errorHandler';

export interface WebSocketStreamSession {
  id: string;
  cameraId: number;
  organizationId?: number;
  rtspUrl: string;
  isActive: boolean;
  process?: ChildProcess;
  createdAt: Date;
  lastAccessed: Date;
  clients: Set<WebSocket>;
  faceRecognitionEnabled?: boolean;
}

export class WebSocketStreamService {
  private static instance: WebSocketStreamService;
  private wss: WebSocketServer | null = null;
  private sessions: Map<string, WebSocketStreamSession> = new Map();
  private clientSessions: Map<WebSocket, string> = new Map();

  private constructor() {
    // Setup periodic cleanup
    setInterval(() => this.cleanupInactiveSessions(), 30000);
  }

  public static getInstance(): WebSocketStreamService {
    if (!WebSocketStreamService.instance) {
      WebSocketStreamService.instance = new WebSocketStreamService();
    }
    return WebSocketStreamService.instance;
  }

  public initialize(server: HTTPServer): void {
    this.wss = new WebSocketServer({
      server,
      path: '/ws/stream'
    });

    this.wss.on('connection', (ws, req) => {
      console.log('WebSocket client connected');

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleClientMessage(ws, data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
        this.handleClientDisconnect(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.handleClientDisconnect(ws);
      });
    });
  }

  private async handleClientMessage(ws: WebSocket, data: any): Promise<void> {
    switch (data.type) {
      case 'subscribe':
        await this.subscribeToStream(ws, data.sessionId);
        break;
      case 'unsubscribe':
        this.unsubscribeFromStream(ws);
        break;
      default:
        ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
    }
  }

  private async subscribeToStream(ws: WebSocket, sessionId: string): Promise<void> {
    try {
      console.log(`Client attempting to subscribe to session: ${sessionId}`);

      const session = this.sessions.get(sessionId);
      if (!session) {
        console.error(`Session ${sessionId} not found`);
        ws.send(JSON.stringify({ type: 'error', message: 'Stream session not found' }));
        return;
      }

      if (!session.isActive) {
        console.error(`Session ${sessionId} is not active`);
        ws.send(JSON.stringify({ type: 'error', message: 'Stream session is not active' }));
        return;
      }

      // Remove client from previous session if any
      this.unsubscribeFromStream(ws);

      // Add client to session
      session.clients.add(ws);
      this.clientSessions.set(ws, sessionId);
      session.lastAccessed = new Date();

      ws.send(JSON.stringify({
        type: 'subscribed',
        sessionId: sessionId,
        message: 'Successfully subscribed to stream'
      }));

      console.log(`Client subscribed to stream session: ${sessionId}. Total clients: ${session.clients.size}`);
    } catch (error) {
      console.error('Error subscribing to stream:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Failed to subscribe to stream' }));
    }
  }

  private unsubscribeFromStream(ws: WebSocket): void {
    const sessionId = this.clientSessions.get(ws);
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.clients.delete(ws);
        console.log(`Client unsubscribed from stream session: ${sessionId}`);
      }
      this.clientSessions.delete(ws);
    }
  }

  private handleClientDisconnect(ws: WebSocket): void {
    this.unsubscribeFromStream(ws);
  }

  public async startStream(
    cameraId: number,
    rtspUrl: string,
    organizationId?: number
  ): Promise<string> {
    let sessionId: string | null = null;
    try {
      // Check if stream already exists for this camera with active clients (live viewing)
      const existingSession = this.findSessionByCameraId(cameraId);
      if (existingSession && existingSession.isActive) {
        if (existingSession.clients.size > 0) {
          // Only reuse sessions that have active WebSocket clients (live viewing)
          existingSession.lastAccessed = new Date();
          console.log(`🔄 REUSE: Reusing existing live viewing session ${existingSession.id} for camera ${cameraId} (${existingSession.clients.size} clients)`);
          return existingSession.id;
        } else {
          // Session exists but has no clients - this is likely a face recognition session
          console.log(`🧠 FACE: Face recognition session ${existingSession.id} exists for camera ${cameraId}, creating separate live viewing session`);
        }
      }

      // Create new session for live viewing
      sessionId = uuidv4();
      const session: WebSocketStreamSession = {
        id: sessionId,
        cameraId,
        organizationId,
        rtspUrl,
        isActive: false,
        createdAt: new Date(),
        lastAccessed: new Date(),
        clients: new Set(),
        faceRecognitionEnabled: false, // Video streaming doesn't include face recognition
      };

      console.log(`📺 NEW: Creating new live viewing session ${sessionId} for camera ${cameraId}`);

      // Store session early so we can clean up on error
      this.sessions.set(sessionId, session);

      // Check if FFmpeg is available
      await this.checkFFmpegAvailability();

      // Build FFmpeg arguments for MJPEG over WebSocket
      const ffmpegArgs = [
        // Input options - optimized for real-time streaming
        '-rtsp_transport', 'tcp',
        '-analyzeduration', '500000',  // Reduced for faster startup
        '-probesize', '500000',        // Reduced for faster startup
        '-max_delay', '0',             // No delay for real-time
        '-fflags', 'nobuffer',         // Disable buffering
        '-flags', 'low_delay',         // Low delay flag
        '-i', rtspUrl,

        // Video encoding for MJPEG - optimized for streaming
        '-c:v', 'mjpeg',
        '-q:v', '5',                   // Balanced quality (3=high quality, 5=good quality, less data)
        '-r', '15',                    // Increased to 15 FPS for smoother video
        '-s', '800x600',               // Slightly higher resolution
        '-pix_fmt', 'yuvj420p',

        // Output format - optimized for streaming
        '-f', 'mjpeg',
        '-fflags', '+flush_packets+nobuffer',
        '-tune', 'zerolatency',        // Zero latency tuning
        '-'
      ];

      console.log(`Starting FFmpeg for camera ${cameraId} with WebSocket MJPEG streaming`);

      // Start FFmpeg process
      const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      session.process = ffmpegProcess;

      // Handle MJPEG frames from stdout
      let buffer = Buffer.alloc(0);

      ffmpegProcess.stdout?.on('data', (data: Buffer) => {
        buffer = Buffer.concat([buffer, data]);

        // Process all complete JPEG frames in the buffer
        let processed = true;
        while (processed) {
          processed = false;

          // Look for JPEG start marker (0xFF 0xD8)
          const startMarker = Buffer.from([0xFF, 0xD8]);
          const startIndex = buffer.indexOf(startMarker);

          if (startIndex !== -1) {
            // Look for JPEG end marker (0xFF 0xD9) after the start
            const endMarker = Buffer.from([0xFF, 0xD9]);
            const endIndex = buffer.indexOf(endMarker, startIndex + 2);

            if (endIndex !== -1) {
              // Extract complete JPEG frame (including end marker)
              const frameData = buffer.slice(startIndex, endIndex + 2);

              // Only broadcast frames that are reasonable size (avoid corrupted frames)
              if (frameData.length > 1000 && frameData.length < 500000) { // 1KB to 500KB
                this.broadcastFrame(sessionId!, frameData);
              } else {
                console.warn(`Skipping invalid frame size: ${frameData.length} bytes`);
              }

              // Remove processed frame from buffer
              buffer = buffer.slice(endIndex + 2);
              processed = true; // Continue processing if there might be more frames
            }
          }
        }

        // Keep buffer size manageable - if it gets too large, reset it
        if (buffer.length > 2 * 1024 * 1024) { // 2MB limit
          console.warn('Buffer too large, resetting...');
          buffer = Buffer.alloc(0);
        }
      });

      ffmpegProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        console.log(`FFmpeg stderr: ${output}`);

        // Check for successful stream start indicators
        if (output.includes('Stream mapping') || output.includes('Press [q] to stop')) {
          if (!session.isActive) {
            session.isActive = true;
            console.log(`WebSocket stream started successfully for camera ${cameraId}`);
          }
        }
      });

      ffmpegProcess.on('error', (error) => {
        console.error(`FFmpeg process error for camera ${cameraId}:`, error);
        session.isActive = false;
        if (sessionId) this.cleanup(sessionId);
      });

      ffmpegProcess.on('exit', (code, signal) => {
        console.log(`FFmpeg process exited for camera ${cameraId} with code ${code} and signal ${signal}`);
        session.isActive = false;
        if (sessionId) this.cleanup(sessionId);
      });

      // Wait a moment for the stream to initialize
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mark as active
      session.isActive = true;

      console.log(`WebSocket video stream started successfully for camera ${cameraId}`);
      return sessionId;
    } catch (error: any) {
      console.error('Error starting WebSocket stream:', error);

      // Clean up the session if it was created
      if (sessionId) {
        this.cleanup(sessionId);
      }

      // If it's already a custom error, rethrow it
      if (error.statusCode) {
        throw error;
      }
      // Otherwise, create a new error with the original message
      throw createError(`Failed to start WebSocket stream: ${error.message || error}`, 500);
    }
  }

  private broadcastFrame(sessionId: string, frameData: Buffer): void {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      console.warn(`Session ${sessionId} not found or inactive`);
      return;
    }

    if (session.clients.size === 0) {
      return;
    }

    const base64Frame = frameData.toString('base64');
    const message = JSON.stringify({
      type: 'frame',
      sessionId: sessionId,
      data: base64Frame,
      timestamp: Date.now()
    });

    // Broadcast to all connected clients
    let successCount = 0;
    let failCount = 0;

    session.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
          successCount++;
        } catch (error) {
          console.error('Error sending frame to client:', error);
          session.clients.delete(client);
          failCount++;
        }
      } else {
        console.log(`Removing closed client from session ${sessionId}`);
        session.clients.delete(client);
        failCount++;
      }
    });

    if (failCount > 0) {
      console.warn(`Failed to send frame to ${failCount} clients`);
    }
  }

  public stopStream(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Notify all clients that stream is stopping
    const stopMessage = JSON.stringify({
      type: 'stream_stopped',
      sessionId: sessionId,
      message: 'Stream has been stopped'
    });

    session.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(stopMessage);
        } catch (error) {
          console.error('Error notifying client of stream stop:', error);
        }
      }
    });

    if (session.process && !session.process.killed) {
      try {
        // Try graceful termination first
        session.process.kill('SIGTERM');

        // Force kill after 5 seconds if process doesn't terminate
        setTimeout(() => {
          if (session.process && !session.process.killed) {
            console.warn(`Force killing FFmpeg process for session ${sessionId}`);
            session.process.kill('SIGKILL');
          }
        }, 5000);
      } catch (error) {
        console.error(`Error stopping FFmpeg process for session ${sessionId}:`, error);
      }
    }

    this.cleanup(sessionId);
    return true;
  }

  public isStreamActive(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session ? session.isActive : false;
  }

  public getActiveSessions(): WebSocketStreamSession[] {
    return Array.from(this.sessions.values()).filter(session => session.isActive);
  }

  private findSessionByCameraId(cameraId: number): WebSocketStreamSession | undefined {
    return Array.from(this.sessions.values()).find(session =>
      session.cameraId === cameraId && session.isActive
    );
  }

  private async checkFFmpegAvailability(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpegProcess = spawn('ffmpeg', ['-version'], { stdio: 'pipe' });

      ffmpegProcess.on('error', (error) => {
        reject(new Error(`FFmpeg is not available: ${error.message}. Please install FFmpeg and add it to your PATH.`));
      });

      ffmpegProcess.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg version check failed with exit code: ${code}`));
        }
      });
    });
  }

  private cleanup(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Clear all client connections
      session.clients.forEach(client => {
        this.clientSessions.delete(client);
      });
      session.clients.clear();

      this.sessions.delete(sessionId);
      console.log(`WebSocket video stream session ${sessionId} cleaned up`);
    }
  }

  private cleanupInactiveSessions(): void {
    const now = new Date();
    const maxIdleTime = 5 * 60 * 1000; // 5 minutes

    this.sessions.forEach((session, sessionId) => {
      const idleTime = now.getTime() - session.lastAccessed.getTime();
      const hasActiveClients = session.clients.size > 0;

      if (!hasActiveClients && idleTime > maxIdleTime) {
        console.log(`Cleaning up inactive WebSocket session: ${sessionId}`);
        this.stopStream(sessionId);
      }
    });
  }

  public stopAllStreams(): void {
    this.sessions.forEach((session, sessionId) => {
      this.stopStream(sessionId);
    });
  }

  public getServiceHealth() {
    return {
      activeSessions: this.sessions.size,
      totalClients: Array.from(this.sessions.values()).reduce((total, session) => total + session.clients.size, 0),
      uptime: process.uptime(),
    };
  }
}

// Export singleton instance
export const webSocketStreamService = WebSocketStreamService.getInstance();