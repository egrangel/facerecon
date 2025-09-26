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
  // Remove queue system - use true parallel processing instead
  private performanceStats = {
    totalDetections: 0,
    totalProcessingTime: 0,
    averageProcessingTime: 0,
    maxProcessingTime: 0,
    minProcessingTime: Infinity,
    concurrentDetections: 0, // Track concurrent detections
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
   * Async face detection with true parallel processing - no queuing
   */
  public detectFacesAsync(
    imageBuffer: Buffer
  ): Promise<{
    faces: Array<{
      boundingBox: { x: number; y: number; width: number; height: number };
      confidence: number;
      landmarks?: any[];
      encoding?: number[]; // Include encoding
    }>;
    processingTimeMs: number;
  }> {
    return new Promise((resolve, reject) => {
      if (!this.detector || !this.isInitialized) {
        reject(new Error('Native face detector not initialized'));
        return;
      }

      // Track concurrent detections
      this.performanceStats.concurrentDetections++;
      const startTime = Date.now();

      // Add timeout for safety
      const timeoutId = setTimeout(() => {
        this.performanceStats.concurrentDetections--;
        reject(new Error('Face detection timeout - 15 seconds exceeded'));
      }, 15000); // 15 second timeout

      // Direct async call - no queuing, full parallelism
      this.detector.detectFacesAsync(imageBuffer, (err, result) => {
        try {
          clearTimeout(timeoutId);
          this.performanceStats.concurrentDetections--;

          if (err) {
            reject(err);
            return;
          }

          if (!result.success) {
            reject(new Error(`Face detection failed: ${result.error}`));
            return;
          }

          // Update performance statistics
          this.updatePerformanceStats(result.processingTimeMs);

          const processedFaces = result.faces.map(face => ({
            boundingBox: face.boundingBox,
            confidence: face.confidence,
            landmarks: [],
            encoding: face.encoding || [], // Include face encoding from C++
          }));

          // Debug logging for encoding issues
          if (processedFaces.length > 0) {
            const faceWithEncoding = processedFaces.find(f => f.encoding && f.encoding.length > 0);
            if (!faceWithEncoding) {
              console.warn('⚠️ NATIVE DETECTOR ASYNC: No encodings found in detected faces - C++ module may not be generating encodings');
            } else {
              console.log(`✅ NATIVE DETECTOR ASYNC: Found ${processedFaces.length} face(s) with encodings (${faceWithEncoding.encoding!.length} dimensions)`);
            }
          }

          const processedResult = {
            faces: processedFaces,
            processingTimeMs: result.processingTimeMs,
          };

          resolve(processedResult);
        } catch (error) {
          this.performanceStats.concurrentDetections--;
          reject(error);
        }
      });
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