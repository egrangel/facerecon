import { spawn, ChildProcess } from 'child_process';
import { faceRecognitionService } from './FaceRecognitionService';

export interface FrameExtractionSession {
  cameraId: number;
  organizationId: number;
  sessionId: string;
  rtspUrl: string;
  isActive: boolean;
  process?: ChildProcess;
  frameCount: number;
  lastFrameTime: Date;
  extractionInterval: number;
  frameBuffer: Map<number, Buffer>; // In-memory frame storage
  lastProcessedFrame: number;
  monitor?: NodeJS.Timeout;
}

export class FrameExtractionService {
  private static instance: FrameExtractionService;
  private sessions: Map<string, FrameExtractionSession> = new Map();
  private readonly defaultInterval = 1; // Extract frame every 1 second

  constructor() {}

  public static getInstance(): FrameExtractionService {
    if (!FrameExtractionService.instance) {
      FrameExtractionService.instance = new FrameExtractionService();
    }
    return FrameExtractionService.instance;
  }


  /**
   * Start frame extraction for a camera stream
   */
  public async startFrameExtraction(
    sessionId: string,
    cameraId: number,
    organizationId: number,
    rtspUrl: string,
    extractionInterval: number = this.defaultInterval
  ): Promise<void> {
    try {
      // Check if already running
      if (this.sessions.has(sessionId)) {
        console.log(`Frame extraction already running for session ${sessionId}`);
        return;
      }

      const session: FrameExtractionSession = {
        cameraId,
        organizationId,
        sessionId,
        rtspUrl,
        isActive: false,
        frameCount: 0,
        lastFrameTime: new Date(),
        extractionInterval,
        frameBuffer: new Map<number, Buffer>(),
        lastProcessedFrame: 0
      };

      // Initialize face recognition service - CRITICAL: Must succeed
      try {
        await faceRecognitionService.initialize();
        console.log('✅ Face recognition service ready for frame processing');
      } catch (error) {
        console.error('❌ CRITICAL: Cannot start frame extraction - Face recognition service failed to initialize');
        throw error; // Re-throw to fail the frame extraction startup
      }

      // Start FFmpeg process for frame extraction to stdout
      const ffmpegArgs = [
        // Enhanced input options for better camera compatibility
        '-rtsp_transport', 'tcp',
        '-analyzeduration', '2000000',
        '-probesize', '2000000',
        '-fflags', '+genpts',
        '-max_delay', '5000000',
        '-i', rtspUrl,

        // Enhanced frame extraction options - output to stdout
        '-vf', `fps=1/${extractionInterval},scale=1280:720:force_original_aspect_ratio=decrease`,
        '-f', 'image2pipe',
        '-q:v', '3',
        '-pix_fmt', 'yuvj420p',
        '-vcodec', 'mjpeg',
        'pipe:1' // Output to stdout
      ];

      // console.log(`Starting frame extraction for camera ${cameraId}: ffmpeg ${ffmpegArgs.join(' ')}`);

      const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      session.process = ffmpegProcess;
      session.isActive = true;
      this.sessions.set(sessionId, session);

      // Handle stdout data - frames in memory
      let frameBuffer = Buffer.alloc(0);
      let frameNumber = 1;

      ffmpegProcess.stdout?.on('data', (data: Buffer) => {
        frameBuffer = Buffer.concat([frameBuffer, data]);

        // Look for JPEG markers to separate frames
        let startIdx = 0;
        let endIdx = frameBuffer.indexOf(Buffer.from([0xFF, 0xD9]), startIdx); // JPEG end marker

        while (endIdx !== -1) {
          const frameStart = frameBuffer.indexOf(Buffer.from([0xFF, 0xD8]), startIdx); // JPEG start marker
          if (frameStart !== -1 && frameStart < endIdx) {
            const completeFrame = frameBuffer.subarray(frameStart, endIdx + 2);

            // Store frame in memory dictionary
            session.frameBuffer.set(frameNumber, completeFrame);
            session.frameCount++;
            session.lastFrameTime = new Date();

            // Process frame immediately
            this.processFrameFromMemory(completeFrame, frameNumber, session);

            frameNumber++;
            startIdx = endIdx + 2;
          } else {
            startIdx = endIdx + 2;
          }

          endIdx = frameBuffer.indexOf(Buffer.from([0xFF, 0xD9]), startIdx);
        }

        // Keep remaining incomplete data
        if (startIdx < frameBuffer.length) {
          frameBuffer = frameBuffer.subarray(startIdx);
        } else {
          frameBuffer = Buffer.alloc(0);
        }
      });

      // ffmpegProcess.stderr?.on('data', (data) => {
      //   const output = data.toString();

      //   // Log important information, filter noise
      //   if (output.includes('frame=') || output.includes('fps=') ||
      //       output.includes('error') || output.includes('failed') ||
      //       output.includes('Connection') || output.includes('timeout')) {
      //     console.log(`FFmpeg (${sessionId}): ${output.trim()}`);
      //   }

      //   // Check for frame generation indicators
      //   if (output.includes('frame=') || output.includes('fps=')) {
      //     session.lastFrameTime = new Date();
      //   }

      //   // Check for connection errors
      //   if (output.includes('Connection refused') ||
      //       output.includes('No route to host') ||
      //       output.includes('Invalid data found') ||
      //       output.includes('Server returned 404') ||
      //       output.includes('Connection timed out')) {
      //     console.error(`🚨 CAMERA ERROR (${sessionId}): ${output.trim()}`);
      //   }
      // });

      ffmpegProcess.on('error', (error) => {
        console.error(`Frame extraction error for session ${sessionId}:`, error);
        session.isActive = false;
        this.cleanup(sessionId);
      });

      ffmpegProcess.on('exit', (code, signal) => {
        // console.log(`Frame extraction exited for session ${sessionId} with code ${code} and signal ${signal}`);
        session.isActive = false;
        this.cleanup(sessionId);
      });

      console.log(`Frame extraction started for session ${sessionId}`);
    } catch (error) {
      console.error('Failed to start frame extraction:', error);
      throw error;
    }
  }

  /**
   * Process frames from memory buffer
   */
  private async processFrameFromMemory(
    frameBuffer: Buffer,
    frameNumber: number,
    session: FrameExtractionSession
  ): Promise<void> {
    try {
      // Clean up older frames to prevent memory leaks (keep only last 20 frames)
      if (session.frameBuffer.size > 20) {
        const frames = Array.from(session.frameBuffer.keys());
        const oldestFrame = Math.min(...frames);
        session.frameBuffer.delete(oldestFrame);
      }

      // Extract event ID from session ID
      let eventId: number | undefined;
      const eventMatch = session.sessionId.match(/^event-(\d+)-camera-\d+-\d+$/);
      if (eventMatch) {
        eventId = parseInt(eventMatch[1]);
      } else {
        console.warn(`⚠️ FRAME EXTRACT: Could not extract event ID from session ${session.sessionId}`);
      }

      // Process frame with face detection
      await faceRecognitionService.processVideoFrame(
        frameBuffer,
        session.cameraId,
        session.organizationId,
        eventId
      );

      session.lastProcessedFrame = frameNumber;
    } catch (error) {
      console.error(`Failed to process frame ${frameNumber}:`, error);
    }
  }

  /**
   * Stop frame extraction for a session
   */
  public stopFrameExtraction(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    if (session.process && !session.process.killed) {
      try {
        // Try graceful termination first
        session.process.kill('SIGTERM');

        // Force kill after 5 seconds if process doesn't terminate
        setTimeout(() => {
          if (session.process && !session.process.killed) {
            console.warn(`Force killing frame extraction process for session ${sessionId}`);
            session.process.kill('SIGKILL');
          }
        }, 5000);
      } catch (error) {
        console.error(`Error stopping frame extraction for session ${sessionId}:`, error);
      }
    }

    // Clear monitoring interval
    if (session.monitor) {
      clearInterval(session.monitor);
    }

    this.cleanup(sessionId);
    return true;
  }

  /**
   * Get active frame extraction sessions
   */
  public getActiveSessions(): FrameExtractionSession[] {
    return Array.from(this.sessions.values()).filter(session => session.isActive);
  }

  /**
   * Check if frame extraction is active for a session
   */
  public isActive(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session ? session.isActive : false;
  }

  /**
   * Get session statistics
   */
  public getSessionStats(sessionId: string): any {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return {
      sessionId: session.sessionId,
      cameraId: session.cameraId,
      isActive: session.isActive,
      frameCount: session.frameCount,
      lastFrameTime: session.lastFrameTime,
      extractionInterval: session.extractionInterval,
      uptime: Date.now() - session.lastFrameTime.getTime(),
    };
  }

  /**
   * Cleanup session resources
   */
  private cleanup(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Clear monitoring interval
      if (session.monitor) {
        clearInterval(session.monitor);
      }

      // Clear frame buffer from memory
      session.frameBuffer.clear();

      this.sessions.delete(sessionId);
    }
  }

  /**
   * Stop all frame extraction sessions
   */
  public stopAllSessions(): void {
    this.sessions.forEach((session, sessionId) => {
      this.stopFrameExtraction(sessionId);
    });
  }

  /**
   * Get service health
   */
  public getServiceHealth() {
    return {
      activeSessions: this.sessions.size,
      memoryFrameBuffers: Array.from(this.sessions.values()).reduce((total, session) => total + session.frameBuffer.size, 0),
      faceRecognitionHealth: faceRecognitionService.getServiceHealth(),
      uptime: process.uptime(),
    };
  }
}

// Export singleton instance
export const frameExtractionService = FrameExtractionService.getInstance();