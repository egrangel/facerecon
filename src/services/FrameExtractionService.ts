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
  private healthMonitor?: NodeJS.Timeout;
  private readonly maxSessionAge = 3600000; // 1 hour max session age
  private readonly maxIdleTime = 300000; // 5 minutes max idle time

  // Event loop and memory protection
  private readonly maxGlobalMemoryMB = 1024; // 1GB global memory limit
  private readonly maxSessionMemoryMB = 100; // 100MB per session limit
  private readonly frameProcessingThrottle = 50; // Max 50 concurrent frame processes globally
  private activeFrameProcesses = 0;
  private lastGlobalMemoryCheck = Date.now();

  constructor() {
    // Start health monitoring
    this.startHealthMonitoring();
  }

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

      // Handle stdout data - frames in memory with advanced memory management
      let frameBuffer = Buffer.alloc(0);
      let frameNumber = 1;
      const maxBufferSize = 5 * 1024 * 1024; // Reduced to 5MB max buffer
      let lastFrameProcessTime = Date.now();
      let lastMemoryCheck = Date.now();

      ffmpegProcess.stdout?.on('data', (data: Buffer) => {
        try {
          // Check global system resources before processing
          const now = Date.now();
          if (now - lastMemoryCheck > 2000) { // Check every 2 seconds
            lastMemoryCheck = now;
            if (!this.canProcessGlobalFrame()) {
              // Drop frame to protect system
              return;
            }
          }

          // Prevent memory exhaustion
          if (frameBuffer.length + data.length > maxBufferSize) {
            console.warn(`⚠️ Frame buffer too large for session ${sessionId}, dropping data to prevent memory leak`);
            frameBuffer = Buffer.alloc(0); // Reset buffer to prevent memory issues
            return;
          }

          frameBuffer = Buffer.concat([frameBuffer, data]);

          // Look for JPEG markers to separate frames
          let startIdx = 0;
          let endIdx = frameBuffer.indexOf(Buffer.from([0xFF, 0xD9]), startIdx); // JPEG end marker

          while (endIdx !== -1) {
            const frameStart = frameBuffer.indexOf(Buffer.from([0xFF, 0xD8]), startIdx); // JPEG start marker
            if (frameStart !== -1 && frameStart < endIdx) {
              const completeFrame = frameBuffer.subarray(frameStart, endIdx + 2);

              // Enhanced throttling based on global system load
              if (now - lastFrameProcessTime < 1000 || this.activeFrameProcesses >= this.frameProcessingThrottle) {
                // Skip this frame to prevent overload
                startIdx = endIdx + 2;
                endIdx = frameBuffer.indexOf(Buffer.from([0xFF, 0xD9]), startIdx);
                continue;
              }

              // Store frame in memory dictionary with size limits
              session.frameBuffer.set(frameNumber, completeFrame);
              session.frameCount++;
              session.lastFrameTime = new Date();
              lastFrameProcessTime = now;

              // Process frame with global concurrency control
              this.processFrameFromMemory(completeFrame, frameNumber, session).catch(error => {
                console.error(`Frame processing failed for session ${sessionId}, frame ${frameNumber}:`, error);
              });

              frameNumber++;
              startIdx = endIdx + 2;
            } else {
              startIdx = endIdx + 2;
            }

            endIdx = frameBuffer.indexOf(Buffer.from([0xFF, 0xD9]), startIdx);
          }

          // Keep remaining incomplete data with size limit
          if (startIdx < frameBuffer.length) {
            const remainingData = frameBuffer.subarray(startIdx);
            if (remainingData.length < maxBufferSize / 2) { // Only keep if under half max size
              frameBuffer = remainingData;
            } else {
              frameBuffer = Buffer.alloc(0); // Reset if too large
            }
          } else {
            frameBuffer = Buffer.alloc(0);
          }
        } catch (error) {
          console.error(`Error processing frame data for session ${sessionId}:`, error);
          frameBuffer = Buffer.alloc(0); // Reset buffer on error
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
   * Process frames from memory buffer with enhanced timeout and concurrency protection
   */
  private async processFrameFromMemory(
    frameBuffer: Buffer,
    frameNumber: number,
    session: FrameExtractionSession
  ): Promise<void> {
    const startTime = Date.now();
    this.activeFrameProcesses++;

    try {
      // Clean up older frames to prevent memory leaks (keep only last 5 frames - further reduced)
      if (session.frameBuffer.size > 5) {
        const frames = Array.from(session.frameBuffer.keys()).sort((a, b) => a - b);
        const framesToDelete = frames.slice(0, frames.length - 5); // Keep only the latest 5
        framesToDelete.forEach(frame => session.frameBuffer.delete(frame));
      }

      // Extract event ID from session ID
      let eventId: number | undefined;
      const eventMatch = session.sessionId.match(/^event-(\d+)-camera-\d+-\d+$/);
      if (eventMatch) {
        eventId = parseInt(eventMatch[1]);
      } else {
        console.warn(`⚠️ FRAME EXTRACT: Could not extract event ID from session ${session.sessionId}`);
      }

      // Yield to event loop before intensive processing
      await new Promise(resolve => setImmediate(resolve));

      // Create timeout promise (reduced to 15 seconds max)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Frame processing timeout')), 15000);
      });

      // Process frame with face detection with timeout protection
      await Promise.race([
        faceRecognitionService.processVideoFrame(
          frameBuffer,
          session.cameraId,
          session.organizationId,
          eventId
        ),
        timeoutPromise
      ]);

      session.lastProcessedFrame = frameNumber;

      const processingTime = Date.now() - startTime;
      if (processingTime > 3000) { // Reduced threshold
        console.warn(`⚠️ Slow frame processing detected: ${processingTime}ms for session ${session.sessionId}`);
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;
      if (error instanceof Error && error.message === 'Frame processing timeout') {
        console.error(`❌ Frame processing timeout (${processingTime}ms) for session ${session.sessionId}, frame ${frameNumber}`);
        // Force cleanup and restart of face recognition service on timeout
        this.handleProcessingTimeout(session);
      } else {
        console.error(`Failed to process frame ${frameNumber} for session ${session.sessionId}:`, error);
      }
    } finally {
      this.activeFrameProcesses--;
    }
  }

  /**
   * Check if system can handle another frame processing operation globally
   */
  private canProcessGlobalFrame(): boolean {
    // Check global memory usage
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;

    if (heapUsedMB > this.maxGlobalMemoryMB) {
      console.warn(`⚠️ Global memory usage high: ${heapUsedMB.toFixed(1)}MB, throttling frame processing`);
      return false;
    }

    // Check active processes
    if (this.activeFrameProcesses >= this.frameProcessingThrottle) {
      return false;
    }

    return true;
  }

  /**
   * Handle processing timeout by cleaning up resources
   */
  private async handleProcessingTimeout(session: FrameExtractionSession): Promise<void> {
    console.warn(`🔄 Handling processing timeout for session ${session.sessionId}`);

    try {
      // Clear frame buffer to free memory
      session.frameBuffer.clear();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        console.log(`🗑️ Forced garbage collection for session ${session.sessionId}`);
      }

      // Reset face recognition service to clear any stuck state
      await faceRecognitionService.initialize();
      console.log(`🔄 Reinitialized face recognition service for session ${session.sessionId}`);
    } catch (error) {
      console.error(`Error handling timeout for session ${session.sessionId}:`, error);
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

    // Stop health monitoring
    if (this.healthMonitor) {
      clearInterval(this.healthMonitor);
      this.healthMonitor = undefined;
    }
  }

  /**
   * Start health monitoring to detect and recover from stuck sessions
   */
  private startHealthMonitoring(): void {
    this.healthMonitor = setInterval(() => {
      this.checkSessionHealth();
    }, 60000); // Check every minute

    console.log('🏥 Frame extraction health monitoring started');
  }

  /**
   * Check health of all sessions and recover stuck ones
   */
  private checkSessionHealth(): void {
    const now = Date.now();
    let totalMemory = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      try {
        const sessionAge = now - session.lastFrameTime.getTime();
        const bufferSize = session.frameBuffer.size;
        const memoryUsage = Array.from(session.frameBuffer.values()).reduce((total, buffer) => total + buffer.length, 0);
        totalMemory += memoryUsage;

        // Check for stuck sessions
        if (sessionAge > this.maxIdleTime) {
          console.warn(`⚠️ Session ${sessionId} idle for ${Math.round(sessionAge / 1000)}s, restarting...`);
          this.restartSession(sessionId, session);
          continue;
        }

        // Check for memory bloat
        if (memoryUsage > 50 * 1024 * 1024) { // 50MB per session
          console.warn(`⚠️ Session ${sessionId} using excessive memory (${Math.round(memoryUsage / 1024 / 1024)}MB), cleaning up...`);
          this.cleanupSessionMemory(session);
        }

        // Check for process health
        if (session.process && session.process.killed) {
          console.warn(`⚠️ Session ${sessionId} process died, restarting...`);
          this.restartSession(sessionId, session);
        }

      } catch (error) {
        console.error(`Error checking health for session ${sessionId}:`, error);
        this.restartSession(sessionId, session);
      }
    }

    // Log overall health
    if (this.sessions.size > 0) {
      console.log(`🏥 Health check: ${this.sessions.size} sessions, ${Math.round(totalMemory / 1024 / 1024)}MB total memory`);
    }

    // Force garbage collection if memory usage is high
    if (totalMemory > 200 * 1024 * 1024 && global.gc) { // 200MB threshold
      console.log('🗑️ High memory usage detected, forcing garbage collection');
      global.gc();
    }
  }

  /**
   * Restart a stuck session
   */
  private async restartSession(sessionId: string, session: FrameExtractionSession): Promise<void> {
    try {
      console.log(`🔄 Restarting session ${sessionId}`);

      // Stop current session
      this.stopFrameExtraction(sessionId);

      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Restart session
      await this.startFrameExtraction(
        sessionId,
        session.cameraId,
        session.organizationId,
        session.rtspUrl,
        session.extractionInterval
      );

      console.log(`✅ Session ${sessionId} restarted successfully`);
    } catch (error) {
      console.error(`❌ Failed to restart session ${sessionId}:`, error);
    }
  }

  /**
   * Clean up session memory without restarting
   */
  private cleanupSessionMemory(session: FrameExtractionSession): void {
    // Clear old frames, keep only the latest 3
    const frames = Array.from(session.frameBuffer.keys()).sort((a, b) => b - a);
    const framesToKeep = frames.slice(0, 3);
    const framesToDelete = frames.slice(3);

    framesToDelete.forEach(frame => session.frameBuffer.delete(frame));

    console.log(`🧹 Cleaned up ${framesToDelete.length} old frames for session ${session.sessionId}`);
  }

  /**
   * Get service health with enhanced monitoring
   */
  public getServiceHealth() {
    const totalMemory = Array.from(this.sessions.values()).reduce((total, session) => {
      return total + Array.from(session.frameBuffer.values()).reduce((sessionTotal, buffer) => sessionTotal + buffer.length, 0);
    }, 0);

    const systemMemory = process.memoryUsage();

    return {
      activeSessions: this.sessions.size,
      totalMemoryUsage: Math.round(totalMemory / 1024 / 1024), // MB
      memoryPerSession: this.sessions.size > 0 ? Math.round(totalMemory / this.sessions.size / 1024 / 1024) : 0, // MB
      healthMonitorActive: !!this.healthMonitor,
      // Enhanced system monitoring
      systemHealth: {
        heapUsedMB: Math.round(systemMemory.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(systemMemory.heapTotal / 1024 / 1024),
        activeFrameProcesses: this.activeFrameProcesses,
        maxConcurrentFrames: this.frameProcessingThrottle,
        globalMemoryThresholdMB: this.maxGlobalMemoryMB,
      },
      faceRecognitionHealth: faceRecognitionService.getServiceHealth(),
      uptime: process.uptime(),
      sessions: Array.from(this.sessions.entries()).map(([id, session]) => ({
        sessionId: id,
        cameraId: session.cameraId,
        isActive: session.isActive,
        frameCount: session.frameCount,
        lastFrameAge: Math.round((Date.now() - session.lastFrameTime.getTime()) / 1000), // seconds
        bufferSize: session.frameBuffer.size,
        memoryUsage: Math.round(Array.from(session.frameBuffer.values()).reduce((total, buffer) => total + buffer.length, 0) / 1024 / 1024), // MB
      }))
    };
  }
}

// Export singleton instance
export const frameExtractionService = FrameExtractionService.getInstance();