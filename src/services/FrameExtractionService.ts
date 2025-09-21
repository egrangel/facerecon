import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
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
  extractionInterval: number; // seconds between frame extractions
}

export class FrameExtractionService {
  private static instance: FrameExtractionService;
  private sessions: Map<string, FrameExtractionSession> = new Map();
  private readonly frameDir: string;
  private readonly defaultInterval = 1; // Extract frame every 1 second

  constructor() {
    this.frameDir = path.join(process.cwd(), 'temp', 'frames');
    this.ensureFrameDirectory();
  }

  public static getInstance(): FrameExtractionService {
    if (!FrameExtractionService.instance) {
      FrameExtractionService.instance = new FrameExtractionService();
    }
    return FrameExtractionService.instance;
  }

  private ensureFrameDirectory(): void {
    if (!fs.existsSync(this.frameDir)) {
      fs.mkdirSync(this.frameDir, { recursive: true });
    }
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
      };

      // Initialize face recognition service - CRITICAL: Must succeed
      try {
        await faceRecognitionService.initialize();
        console.log('✅ Face recognition service ready for frame processing');
      } catch (error) {
        console.error('❌ CRITICAL: Cannot start frame extraction - Face recognition service failed to initialize');
        throw error; // Re-throw to fail the frame extraction startup
      }

      // Start FFmpeg process for frame extraction
      const frameOutputPattern = path.join(this.frameDir, `${sessionId}_%03d.jpg`);

      const ffmpegArgs = [
        // Input options
        '-rtsp_transport', 'tcp',
        '-analyzeduration', '1000000',
        '-probesize', '1000000',
        '-i', rtspUrl,

        // Frame extraction options
        '-vf', `fps=1/${extractionInterval}`, // Extract 1 frame every N seconds
        '-f', 'image2',
        '-q:v', '2', // High quality JPEG
        '-start_number', '1', // Start numbering from 1
        '-y', // Overwrite output files

        // Output pattern
        frameOutputPattern
      ];

      console.log(`Starting frame extraction for camera ${cameraId}: ffmpeg ${ffmpegArgs.join(' ')}`);

      const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      session.process = ffmpegProcess;
      session.isActive = true;
      this.sessions.set(sessionId, session);

      // Handle process events
      ffmpegProcess.stdout?.on('data', (data) => {
        // Log stdout if needed
        console.log(`FFmpeg stdout (${sessionId}): ${data}`);
      });

      ffmpegProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        console.log(`FFmpeg stderr (${sessionId}): ${output}`);

        // Check for frame generation indicators
        if (output.includes('frame=') || output.includes('fps=')) {
          session.lastFrameTime = new Date();
        }
      });

      ffmpegProcess.on('error', (error) => {
        console.error(`Frame extraction error for session ${sessionId}:`, error);
        session.isActive = false;
        this.cleanup(sessionId);
      });

      ffmpegProcess.on('exit', (code, signal) => {
        console.log(`Frame extraction exited for session ${sessionId} with code ${code} and signal ${signal}`);
        session.isActive = false;
        this.cleanup(sessionId);
      });

      // Start monitoring for new frames
      this.startFrameMonitoring(sessionId);

      console.log(`Frame extraction started for session ${sessionId}`);
    } catch (error) {
      console.error('Failed to start frame extraction:', error);
      throw error;
    }
  }

  /**
   * Monitor for new frames and process them
   */
  private startFrameMonitoring(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const framePattern = path.join(this.frameDir, `${sessionId}_*.jpg`);
    let lastProcessedFrame = 0;

    const monitor = setInterval(async () => {
      try {
        if (!session.isActive) {
          clearInterval(monitor);
          return;
        }

        // Look for new frame files
        const frameFiles = fs.readdirSync(this.frameDir)
          .filter(file => file.startsWith(`${sessionId}_`) && file.endsWith('.jpg'))
          .map(file => {
            const match = file.match(new RegExp(`${sessionId}_(\\d+)\\.jpg`));
            return match ? { file, number: parseInt(match[1]) } : null;
          })
          .filter(item => item !== null)
          .sort((a, b) => a!.number - b!.number);

        // Process new frames
        for (const frameInfo of frameFiles) {
          if (frameInfo!.number > lastProcessedFrame) {
            const framePath = path.join(this.frameDir, frameInfo!.file);

            if (fs.existsSync(framePath)) {
              await this.processFrame(framePath, session);
              lastProcessedFrame = frameInfo!.number;
              session.frameCount++;

              // Clean up old frame file to save space
              setTimeout(() => {
                if (fs.existsSync(framePath)) {
                  fs.unlinkSync(framePath);
                }
              }, 5000);
            }
          }
        }
      } catch (error) {
        console.error(`Frame monitoring error for session ${sessionId}:`, error);
      }
    }, 1000); // Check every second

    // Store monitor reference for cleanup
    (session as any).monitor = monitor;
  }

  /**
   * Process a single frame for face detection
   */
  private async processFrame(framePath: string, session: FrameExtractionSession): Promise<void> {
    try {
      // Read frame buffer
      const frameBuffer = fs.readFileSync(framePath);

      // Process frame with face detection
      await faceRecognitionService.processVideoFrame(
        frameBuffer,
        session.cameraId,
        session.organizationId
      );

      console.log(`Processed frame for camera ${session.cameraId}, session ${session.sessionId}`);
    } catch (error) {
      console.error(`Failed to process frame ${framePath}:`, error);
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
    if ((session as any).monitor) {
      clearInterval((session as any).monitor);
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
      if ((session as any).monitor) {
        clearInterval((session as any).monitor);
      }

      // Clean up frame files
      try {
        const frameFiles = fs.readdirSync(this.frameDir)
          .filter(file => file.startsWith(`${sessionId}_`));

        frameFiles.forEach(file => {
          const filePath = path.join(this.frameDir, file);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        });
      } catch (error) {
        console.error('Error cleaning up frame files:', error);
      }

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
      frameDirectory: this.frameDir,
      faceRecognitionHealth: faceRecognitionService.getServiceHealth(),
      uptime: process.uptime(),
    };
  }
}

// Export singleton instance
export const frameExtractionService = FrameExtractionService.getInstance();