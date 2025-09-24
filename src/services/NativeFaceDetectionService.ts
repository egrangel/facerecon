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
  private detectionQueue: Promise<any> = Promise.resolve();
  private performanceStats = {
    totalDetections: 0,
    totalProcessingTime: 0,
    averageProcessingTime: 0,
    maxProcessingTime: 0,
    minProcessingTime: Infinity,
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
      // Set up model path for OpenCV DNN models
      const defaultModelPath = path.join(process.cwd(), 'models', 'face_detection');
      const finalModelPath = modelPath || defaultModelPath;

      // Use synchronous initialization for better reliability
      const success = this.detector.initialize(finalModelPath, useDeepLearning);

      if (success) {
        this.isInitialized = true;
        this.detector.setConfidenceThreshold(0.15); // Lower threshold for surveillance scenarios
        return true;
      } else {
        return false;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Detect faces using the high-performance C++ module with thread safety
   */
  public async detectFaces(imageBuffer: Buffer): Promise<{
    faces: Array<{
      boundingBox: { x: number; y: number; width: number; height: number };
      confidence: number;
      landmarks?: any[];
    }>;
    processingTimeMs: number;
  }> {
    // Use queue to ensure thread safety for concurrent requests
    return new Promise((resolve, reject) => {
      this.detectionQueue = this.detectionQueue.then(async () => {
        try {
          if (!this.detector || !this.isInitialized) {
            throw new Error('Native face detector not initialized');
          }

          const result = this.detector.detectFaces(imageBuffer);

          if (!result.success) {
            throw new Error(`Face detection failed: ${result.error}`);
          }

          // Update performance statistics
          this.updatePerformanceStats(result.processingTimeMs);

          const processedResult = {
            faces: result.faces.map(face => ({
              boundingBox: face.boundingBox,
              confidence: face.confidence,
              landmarks: [], // C++ module can be extended to include landmarks
            })),
            processingTimeMs: result.processingTimeMs,
          };

          resolve(processedResult);
        } catch (error) {
          reject(error);
        }
      }).catch(reject);
    });
  }

  /**
   * Async face detection for non-blocking operations with thread safety
   */
  public detectFacesAsync(
    imageBuffer: Buffer
  ): Promise<{
    faces: Array<{
      boundingBox: { x: number; y: number; width: number; height: number };
      confidence: number;
      landmarks?: any[];
    }>;
    processingTimeMs: number;
  }> {
    // Use queue to ensure thread safety for concurrent requests
    return new Promise((resolve, reject) => {
      this.detectionQueue = this.detectionQueue.then(async () => {
        return new Promise<void>((queueResolve, queueReject) => {
          if (!this.detector || !this.isInitialized) {
            const error = new Error('Native face detector not initialized');
            reject(error);
            queueReject(error);
            return;
          }

          this.detector.detectFacesAsync(imageBuffer, (err, result) => {
            try {
              if (err) {
                reject(err);
                queueReject(err);
                return;
              }

              if (!result.success) {
                const error = new Error(`Face detection failed: ${result.error}`);
                reject(error);
                queueReject(error);
                return;
              }

              // Update performance statistics
              this.updatePerformanceStats(result.processingTimeMs);

              const processedResult = {
                faces: result.faces.map(face => ({
                  boundingBox: face.boundingBox,
                  confidence: face.confidence,
                  landmarks: [],
                })),
                processingTimeMs: result.processingTimeMs,
              };

              resolve(processedResult);
              queueResolve();
            } catch (error) {
              reject(error);
              queueReject(error);
            }
          });
        });
      }).catch(reject);
    });
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
   * Get performance statistics
   */
  public getPerformanceStats() {
    return {
      ...this.performanceStats,
      isNativeDetector: true,
      detectorType: 'C++ OpenCV',
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
   * Cleanup resources
   */
  public dispose(): void {
    // The C++ detector will clean up automatically when GC'd
    this.isInitialized = false;
  }
}

// Export singleton instance
export const nativeFaceDetectionService = new NativeFaceDetectionService();