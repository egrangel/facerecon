import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { createError } from '../middlewares/errorHandler';
import { frameExtractionService } from './FrameExtractionService';

export interface StreamSession {
  id: string;
  cameraId: number;
  organizationId?: number;
  rtspUrl: string;
  hlsPath: string;
  isActive: boolean;
  process?: ChildProcess;
  createdAt: Date;
  lastAccessed: Date;
  faceRecognitionEnabled?: boolean;
}

export class StreamService {
  private static instance: StreamService;
  private sessions: Map<string, StreamSession> = new Map();
  private readonly streamDir: string;
  private readonly segmentDuration: number = 2; // seconds
  private readonly playlistSize: number = 3; // number of segments in playlist

  constructor() {
    // Create streams directory if it doesn't exist
    this.streamDir = path.join(process.cwd(), 'streams');
    this.ensureStreamDirectory();

    // Clean up old streams on startup
    this.cleanupStreamDirectory();

    // Setup periodic cleanup
    setInterval(() => this.cleanupInactiveSessions(), 30000); // Clean every 30 seconds
  }

  public static getInstance(): StreamService {
    if (!StreamService.instance) {
      StreamService.instance = new StreamService();
    }
    return StreamService.instance;
  }

  private ensureStreamDirectory(): void {
    if (!fs.existsSync(this.streamDir)) {
      fs.mkdirSync(this.streamDir, { recursive: true });
    }
  }

  private cleanupStreamDirectory(): void {
    try {
      if (fs.existsSync(this.streamDir)) {
        const files = fs.readdirSync(this.streamDir);
        files.forEach(file => {
          const filePath = path.join(this.streamDir, file);
          fs.unlinkSync(filePath);
        });
      }
    } catch (error) {
      console.error('Error cleaning up stream directory:', error);
    }
  }

  public async startStream(
    cameraId: number,
    rtspUrl: string,
    organizationId?: number,
    enableFaceRecognition: boolean = false
  ): Promise<string> {
    let sessionId: string | null = null;
    try {
      // Check if stream already exists for this camera
      const existingSession = this.findSessionByCameraId(cameraId);
      if (existingSession && existingSession.isActive) {
        existingSession.lastAccessed = new Date();
        return existingSession.id;
      }

      // Create new session
      sessionId = uuidv4();
      const hlsPath = path.join(this.streamDir, `${sessionId}.m3u8`);
      const segmentPattern = path.join(this.streamDir, `${sessionId}_%03d.ts`);

      const session: StreamSession = {
        id: sessionId,
        cameraId,
        organizationId,
        rtspUrl,
        hlsPath,
        isActive: false,
        createdAt: new Date(),
        lastAccessed: new Date(),
        faceRecognitionEnabled: enableFaceRecognition,
      };

      // Store session early so we can clean up on error
      this.sessions.set(sessionId, session);

      // Check if FFmpeg is available
      await this.checkFFmpegAvailability();

      // Build FFmpeg arguments
      const ffmpegArgs = [
        // Input options
        '-rtsp_transport', 'tcp',
        '-analyzeduration', '1000000',
        '-probesize', '1000000',
        '-max_delay', '500000',
        '-i', rtspUrl,

        // Video encoding
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-profile:v', 'baseline',
        '-level', '3.0',
        '-pix_fmt', 'yuv420p',

        // Audio encoding
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '44100',

        // HLS output
        '-f', 'hls',
        '-hls_time', this.segmentDuration.toString(),
        '-hls_list_size', this.playlistSize.toString(),
        '-hls_flags', 'delete_segments+append_list',
        '-hls_allow_cache', '0',
        '-hls_segment_filename', segmentPattern,

        // Output file
        hlsPath
      ];

      console.log(`Starting FFmpeg for camera ${cameraId} with command: ffmpeg ${ffmpegArgs.join(' ')}`);

      // Start FFmpeg process
      const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      session.process = ffmpegProcess;

      // Handle process events
      ffmpegProcess.stdout?.on('data', (data) => {
        // FFmpeg writes to stderr, but we can log stdout if needed
        console.log(`FFmpeg stdout: ${data}`);
      });

      ffmpegProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        console.log(`FFmpeg stderr: ${output}`);

        // Check for successful stream start indicators
        if (output.includes('Opening') || output.includes('Stream mapping') || output.includes('Press [q] to stop')) {
          if (!session.isActive) {
            session.isActive = true;
            console.log(`Stream started successfully for camera ${cameraId}`);
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

      // Wait for the stream to initialize
      await this.waitForPlaylist(hlsPath, 30000); // Increased to 30 seconds

      // Mark as active after successful initialization
      session.isActive = true;

      // Start face recognition if enabled
      if (enableFaceRecognition && organizationId) {
        try {
          await frameExtractionService.startFrameExtraction(
            sessionId,
            cameraId,
            organizationId,
            rtspUrl,
            5 // Extract frame every 5 seconds
          );
          console.log(`Face recognition started for session ${sessionId}`);
        } catch (error) {
          console.error(`Failed to start face recognition for session ${sessionId}:`, error);
          // Don't fail the stream if face recognition fails
        }
      }

      return sessionId;
    } catch (error: any) {
      console.error('Error starting stream:', error);

      // Clean up the session if it was created
      if (sessionId) {
        this.cleanup(sessionId);
      }

      // If it's already a custom error, rethrow it
      if (error.statusCode) {
        throw error;
      }
      // Otherwise, create a new error with the original message
      throw createError(`Failed to start stream: ${error.message || error}`, 500);
    }
  }

  public stopStream(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Stop face recognition if it was enabled
    if (session.faceRecognitionEnabled) {
      try {
        frameExtractionService.stopFrameExtraction(sessionId);
        console.log(`Face recognition stopped for session ${sessionId}`);
      } catch (error) {
        console.error(`Error stopping face recognition for session ${sessionId}:`, error);
      }
    }

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

  public getStreamUrl(sessionId: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      return null;
    }

    session.lastAccessed = new Date();
    return `/api/v1/streams/${sessionId}/playlist.m3u8`;
  }

  public getStreamPath(sessionId: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      return null;
    }

    return session.hlsPath;
  }

  public getSegmentPath(sessionId: string, segmentName: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      return null;
    }

    session.lastAccessed = new Date();
    return path.join(this.streamDir, segmentName);
  }

  public isStreamActive(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session ? session.isActive : false;
  }

  public getActiveSessions(): StreamSession[] {
    return Array.from(this.sessions.values()).filter(session => session.isActive);
  }

  private findSessionByCameraId(cameraId: number): StreamSession | undefined {
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

  private async waitForPlaylist(playlistPath: string, timeout: number = 30000): Promise<void> {
    const startTime = Date.now();
    const tmpPath = `${playlistPath}.tmp`;
    console.log(`Waiting for playlist at: ${playlistPath} (or temp file: ${tmpPath})`);

    while (Date.now() - startTime < timeout) {
      // Check for either the final file or the temp file
      const finalExists = fs.existsSync(playlistPath);
      const tmpExists = fs.existsSync(tmpPath);

      if (finalExists || tmpExists) {
        const fileToRead = finalExists ? playlistPath : tmpPath;
        try {
          const content = fs.readFileSync(fileToRead, 'utf8');
          console.log(`Reading ${finalExists ? 'final' : 'temp'} playlist - content length: ${content.length}`);

          // Check if playlist is valid (has header and optionally segments)
          const hasHeader = content.includes('#EXTM3U');
          const hasSegmentInfo = content.includes('#EXTINF') || content.includes('#EXT-X-TARGETDURATION');

          if (hasHeader && hasSegmentInfo) {
            console.log('Playlist ready with valid HLS structure');

            // If we were reading the temp file, wait a bit for FFmpeg to rename it
            if (!finalExists && tmpExists) {
              console.log('Waiting for FFmpeg to rename temp file to final playlist...');
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
            return;
          }
        } catch (error) {
          console.log(`Error reading playlist file (${fileToRead}): ${error}`);
          // File might be being written, continue waiting
        }
      } else {
        console.log(`Neither playlist file nor temp file exists yet`);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.error(`Timeout waiting for HLS playlist after ${timeout}ms`);
    throw new Error(`Timeout waiting for HLS playlist to be generated at ${playlistPath}`);
  }

  private cleanup(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Remove playlist and segments
      try {
        if (fs.existsSync(session.hlsPath)) {
          fs.unlinkSync(session.hlsPath);
        }

        // Remove associated segment files
        const segmentPattern = new RegExp(`^${sessionId}_\\d{3}\\.ts$`);
        const files = fs.readdirSync(this.streamDir);
        files.forEach(file => {
          if (segmentPattern.test(file)) {
            const filePath = path.join(this.streamDir, file);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          }
        });
      } catch (error) {
        console.error('Error cleaning up stream files:', error);
      }

      this.sessions.delete(sessionId);
    }
  }

  private cleanupInactiveSessions(): void {
    const now = new Date();
    const maxIdleTime = 5 * 60 * 1000; // 5 minutes

    this.sessions.forEach((session, sessionId) => {
      const idleTime = now.getTime() - session.lastAccessed.getTime();
      if (idleTime > maxIdleTime) {
        console.log(`Cleaning up inactive session: ${sessionId}`);
        this.stopStream(sessionId);
      }
    });
  }

  public stopAllStreams(): void {
    this.sessions.forEach((session, sessionId) => {
      this.stopStream(sessionId);
    });
  }

  // Health check method
  public getServiceHealth() {
    return {
      activeSessions: this.sessions.size,
      streamDirectory: this.streamDir,
      uptime: process.uptime(),
    };
  }
}

// Export singleton instance
export const streamService = StreamService.getInstance();