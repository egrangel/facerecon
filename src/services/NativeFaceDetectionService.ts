import * as path from 'path';

interface NativeFaceDetector {
  initialize(modelPath?: string, useDeepLearning?: boolean): boolean;
  initialize(modelPath: string, useDeepLearning: boolean, callback: (err: Error | null, success: boolean) => void): void;
  detectFaces(buffer: Buffer): NativeDetectionResult;
  detectFacesAsync(buffer: Buffer, callback: (err: Error | null, result: NativeDetectionResult) => void): void;
  setConfidenceThreshold(threshold: number): void;
  isInitialized(): boolean;
}

interface NativeDetectionResult {
  success: boolean;
  faces: Array<{
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    confidence: number;
    encoding: number[]; // Face encoding for recognition
  }>;
  processingTimeMs: number;
  error?: string;
}

export class NativeFaceDetectionService {
  private detector: NativeFaceDetector | null = null;
  private isInitialized = false;
  // Enhanced timeout and safety management
  private readonly maxConcurrentDetections = 100; // Allow high concurrency for multi-camera
  private readonly detectionTimeoutMs = 10000; // 10 second timeout per detection
  private readonly maxDetectionRetries = 2;
  private activeTimeouts = new Set<NodeJS.Timeout>();

  private performanceStats = {
    totalDetections: 0,
    totalProcessingTime: 0,
    averageProcessingTime: 0,
    maxProcessingTime: 0,
    minProcessingTime: Infinity,
    concurrentDetections: 0,
    timeoutErrors: 0,
    retryCount: 0,
  };

  constructor() {
    try {
      // Try to load the native module using absolute path
      const nativeModulePath = path.join(process.cwd(), 'build', 'Release', 'face_detector.node');
      const nativeModule = require(nativeModulePath);
      this.detector = new nativeModule.FaceDetector();
    } catch (error: any) {
      // Silently fall back to null detector
      this.detector = null;
    }
  }

  /**
   * Initialize the native face detector
   */
  public async initialize(modelPath?: string, useDeepLearning = true): Promise<boolean> {
    if (!this.detector) {
      return false;
    }

    try {
      // Set up model path for Facenet and fallback models
      const defaultModelPath = path.join(process.cwd(), 'models').replace(/\\/g, '/');
      const finalModelPath = modelPath || defaultModelPath;

      console.log(`🔧 NATIVE DETECTOR: Initializing with model path: ${finalModelPath}`);
      console.log(`🔧 NATIVE DETECTOR: Deep learning enabled: ${useDeepLearning}`);
      console.log(`🔧 NATIVE DETECTOR: Expected facenet model at: ${finalModelPath}/facenet/facenet.onnx`);

      // Use synchronous initialization for better reliability
      const success = this.detector.initialize(finalModelPath, useDeepLearning);

      if (success) {
        this.isInitialized = true;
        this.detector.setConfidenceThreshold(0.6); // Facenet demo default - good balance of accuracy vs false positives
        console.log(`✅ NATIVE DETECTOR: Initialization successful - detector ready`);
        return true;
      } else {
        console.error(`❌ NATIVE DETECTOR: Initialization failed - C++ module returned false`);
        return false;
      }
    } catch (error) {
      console.error(`❌ NATIVE DETECTOR: Initialization error:`, error);
      return false;
    }
  }

  /**
   * Detect faces using the high-performance C++ module - removed queue for full parallelism
   */
  public async detectFaces(imageBuffer: Buffer): Promise<{
    faces: Array<{
      boundingBox: { x: number; y: number; width: number; height: number };
      confidence: number;
      landmarks?: any[];
      encoding?: number[]; // Include encoding
    }>;
    processingTimeMs: number;
  }> {
    if (!this.detector || !this.isInitialized) {
      throw new Error('Native face detector not initialized');
    }

    try {
      const result = this.detector.detectFaces(imageBuffer);

      if (!result.success) {
        throw new Error(`Face detection failed: ${result.error}`);
      }

      // Update performance statistics
      this.updatePerformanceStats(result.processingTimeMs);

      const processedFaces = result.faces.map(face => ({
        boundingBox: face.boundingBox,
        confidence: face.confidence,
        landmarks: [], // C++ module can be extended to include landmarks
        encoding: face.encoding || [], // Include face encoding from C++
      }));

      // Debug logging for encoding issues
      if (processedFaces.length > 0) {
        const faceWithEncoding = processedFaces.find(f => f.encoding && f.encoding.length > 0);
        if (!faceWithEncoding) {
          console.warn('⚠️ NATIVE DETECTOR: No encodings found in detected faces - C++ module may not be generating encodings');
        } else {
          console.log(`✅ NATIVE DETECTOR: Found ${processedFaces.length} face(s) with encodings (${faceWithEncoding.encoding!.length} dimensions)`);
        }
      }

      return {
        faces: processedFaces,
        processingTimeMs: result.processingTimeMs,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Async face detection with enhanced timeout protection and retry logic
   */
  public detectFacesAsync(
    imageBuffer: Buffer,
    retryCount = 0
  ): Promise<{
    faces: Array<{
      boundingBox: { x: number; y: number; width: number; height: number };
      confidence: number;
      landmarks?: any[];
      encoding?: number[];
    }>;
    processingTimeMs: number;
  }> {
    return new Promise((resolve, reject) => {
      if (!this.detector || !this.isInitialized) {
        reject(new Error('Native face detector not initialized'));
        return;
      }

      // Check concurrency limits
      if (this.performanceStats.concurrentDetections >= this.maxConcurrentDetections) {
        reject(new Error('Maximum concurrent detections exceeded'));
        return;
      }

      // Track concurrent detections
      this.performanceStats.concurrentDetections++;
      const startTime = Date.now();
      let isResolved = false;

      // Enhanced timeout with cleanup
      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          this.performanceStats.concurrentDetections--;
          this.performanceStats.timeoutErrors++;
          this.activeTimeouts.delete(timeoutId);

          // Retry logic for timeouts
          if (retryCount < this.maxDetectionRetries) {
            this.performanceStats.retryCount++;
            console.warn(`⚠️ Face detection timeout, retrying (${retryCount + 1}/${this.maxDetectionRetries})`);
            this.detectFacesAsync(imageBuffer, retryCount + 1)
              .then(resolve)
              .catch(reject);
          } else {
            reject(new Error(`Face detection timeout - ${this.detectionTimeoutMs}ms exceeded after ${this.maxDetectionRetries} retries`));
          }
        }
      }, this.detectionTimeoutMs);

      this.activeTimeouts.add(timeoutId);

      // Direct async call with enhanced error handling
      try {
        this.detector.detectFacesAsync(imageBuffer, (err, result) => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutId);
            this.activeTimeouts.delete(timeoutId);
            this.performanceStats.concurrentDetections--;

            if (err) {
              // Retry on specific errors
              if (retryCount < this.maxDetectionRetries && this.isRetryableError(err)) {
                this.performanceStats.retryCount++;
                console.warn(`⚠️ Face detection error, retrying (${retryCount + 1}/${this.maxDetectionRetries}):`, err.message);
                this.detectFacesAsync(imageBuffer, retryCount + 1)
                  .then(resolve)
                  .catch(reject);
                return;
              }
              reject(err);
              return;
            }

            if (!result.success) {
              const error = new Error(`Face detection failed: ${result.error}`);
              if (retryCount < this.maxDetectionRetries) {
                this.performanceStats.retryCount++;
                console.warn(`⚠️ Face detection failed, retrying (${retryCount + 1}/${this.maxDetectionRetries}):`, result.error);
                this.detectFacesAsync(imageBuffer, retryCount + 1)
                  .then(resolve)
                  .catch(reject);
                return;
              }
              reject(error);
              return;
            }

            // Update performance statistics
            this.updatePerformanceStats(result.processingTimeMs);

            const processedFaces = result.faces.map(face => ({
              boundingBox: face.boundingBox,
              confidence: face.confidence,
              landmarks: [],
              encoding: face.encoding || [],
            }));

            // Debug logging for encoding issues (reduced frequency)
            if (processedFaces.length > 0 && Math.random() < 0.01) { // 1% sampling
              const faceWithEncoding = processedFaces.find(f => f.encoding && f.encoding.length > 0);
              if (!faceWithEncoding) {
                console.warn('⚠️ NATIVE DETECTOR ASYNC: No encodings found in detected faces');
              }
            }

            resolve({
              faces: processedFaces,
              processingTimeMs: result.processingTimeMs,
            });
          }
        });
      } catch (syncError) {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
          this.activeTimeouts.delete(timeoutId);
          this.performanceStats.concurrentDetections--;
          reject(syncError);
        }
      }
    });
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const retryableMessages = [
      'timeout',
      'memory',
      'resource temporarily unavailable',
      'connection',
      'temporary'
    ];

    const errorMessage = error.message.toLowerCase();
    return retryableMessages.some(msg => errorMessage.includes(msg));
  }

  /**
   * Set confidence threshold for face detection
   */
  public setConfidenceThreshold(threshold: number): void {
    if (this.detector && this.isInitialized) {
      this.detector.setConfidenceThreshold(threshold);
    }
  }

  /**
   * Check if the detector is available and initialized
   */
  public isAvailable(): boolean {
    return this.detector !== null && this.isInitialized;
  }

  /**
   * Get performance statistics with enhanced safety metrics
   */
  public getPerformanceStats() {
    return {
      ...this.performanceStats,
      isNativeDetector: true,
      detectorType: 'C++ OpenCV',
      safetyMetrics: {
        maxConcurrentDetections: this.maxConcurrentDetections,
        detectionTimeoutMs: this.detectionTimeoutMs,
        maxRetries: this.maxDetectionRetries,
        activeTimeouts: this.activeTimeouts.size,
        timeoutErrorRate: this.performanceStats.totalDetections > 0
          ? (this.performanceStats.timeoutErrors / this.performanceStats.totalDetections * 100).toFixed(2) + '%'
          : '0%',
        retryRate: this.performanceStats.totalDetections > 0
          ? (this.performanceStats.retryCount / this.performanceStats.totalDetections * 100).toFixed(2) + '%'
          : '0%',
      },
    };
  }

  /**
   * Performance test to validate native module speed
   */
  private async performanceTest(): Promise<void> {
    // Silent performance test - no output
  }

  /**
   * Update performance statistics
   */
  private updatePerformanceStats(processingTime: number): void {
    this.performanceStats.totalDetections++;
    this.performanceStats.totalProcessingTime += processingTime;
    this.performanceStats.averageProcessingTime =
      this.performanceStats.totalProcessingTime / this.performanceStats.totalDetections;
    this.performanceStats.maxProcessingTime = Math.max(
      this.performanceStats.maxProcessingTime,
      processingTime
    );
    this.performanceStats.minProcessingTime = Math.min(
      this.performanceStats.minProcessingTime,
      processingTime
    );
  }

  /**
   * Cleanup resources with timeout management
   */
  public dispose(): void {
    // Clear all active timeouts
    this.activeTimeouts.forEach(timeoutId => {
      clearTimeout(timeoutId);
    });
    this.activeTimeouts.clear();

    // Reset concurrent detection counter
    this.performanceStats.concurrentDetections = 0;

    // The C++ detector will clean up automatically when GC'd
    this.isInitialized = false;
    console.log('🔄 Native face detector disposed with enhanced cleanup');
  }

  /**
   * Emergency cleanup - force stop all operations
   */
  public emergencyStop(): void {
    console.warn('😨 Emergency stop triggered for native face detector');
    this.dispose();

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }
}

// Export singleton instance
export const nativeFaceDetectionService = new NativeFaceDetectionService();