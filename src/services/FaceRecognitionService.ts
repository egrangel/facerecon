import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-cpu';
import * as faceDetection from '@tensorflow-models/face-detection';
import { createCanvas, loadImage, Canvas } from 'canvas';
import * as sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';
import { PersonService, DetectionService, EventService, EventCameraService } from './index';
import { nativeFaceDetectionService } from './NativeFaceDetectionService';

export interface FaceDetectionResult {
  faces: DetectedFace[];
  processedImagePath?: string;
  canvas?: any; // Store the canvas used for detection
}

export interface DetectedFace {
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  landmarks?: any[];
  encoding?: number[];
}

export interface RecognitionResult {
  personFaceId?: number;
  personName?: string;
  confidence: number;
  isMatch: boolean;
}

export class FaceRecognitionService {
  private detector: faceDetection.FaceDetector | null = null;
  private isInitialized = false;
  private personService: PersonService;
  private detectionService: DetectionService;
  private eventService: EventService;
  private eventCameraService: EventCameraService;
  private readonly faceThreshold = 0.2; // Lower threshold for better detection
  private readonly recognitionThreshold = 0.8; // Minimum confidence for face recognition
  private readonly enableAdvancedFiltering = true; // Toggle for advanced false positive filtering
  private lastSavedImageTime = 0; // Track when we last saved a detection image
  private readonly imageSaveInterval = 1000; // Save detection images max every 1000ms for crowd monitoring
  private readonly useNativeDetector = true; // Use high-performance C++ detector when available

  constructor() {
    this.personService = new PersonService();
    this.detectionService = new DetectionService();
    this.eventService = new EventService();
    this.eventCameraService = new EventCameraService();
  }

  /**
   * Initialize the face detection model
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('🔄 INIT: Forcing face detection re-initialization...');
      this.dispose(); // Force re-initialization with new config
    }

    try {
      // Try to initialize native C++ detector first (much faster)
      if (this.useNativeDetector) {
        console.log('🚀 INIT: Attempting native C++ face detector initialization...');
        const nativeSuccess = await nativeFaceDetectionService.initialize();

        if (nativeSuccess) {
          this.isInitialized = true;
          console.log('🎉 INIT: High-performance C++ face detector ready!');
          console.log('⚡ NATIVE: Expected 10-50x performance improvement for crowd detection');
          return;
        } else {
          console.log('⚠️ INIT: Native detector failed, falling back to TensorFlow.js...');
        }
      }

      // Fallback to TensorFlow.js MediaPipe detector
      console.log('🚀 INIT: Starting TensorFlow.js MediaPipe initialization...');

      // Set TensorFlow backend to GPU for faster inference
      await tf.setBackend('cpu');
      await tf.ready();
      console.log(`✅ INIT: TensorFlow.js backend ready: ${tf.getBackend()}`);

      // Create MediaPipe detector optimized for mass attendance (many faces)
      const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
      const detectorConfig = {
        runtime: 'tfjs' as const,
        modelType: 'full' as const, // More accurate model for better detection
        maxFaces: 50, // Higher limit for crowd detection
        minDetectionConfidence: 0.2, // Lower threshold to catch more faces
        minSuppressionThreshold: 0.05, // Even lower to detect overlapping faces
      };

      console.log(`⚡ INIT: TensorFlow.js MediaPipe config: ${JSON.stringify(detectorConfig)}`);

      this.detector = await faceDetection.createDetector(model, detectorConfig);
      this.isInitialized = true;
      console.log('🎉 INIT: TensorFlow.js MediaPipe initialization completed!');
    } catch (error) {
      console.error('❌ CRITICAL: Failed to initialize face detection:', error);
      throw new Error(`Face detection initialization failed: ${error}`);
    }
  }

  /**
   * Detect faces in an image buffer
   */
  public async detectFaces(imageBuffer: Buffer): Promise<FaceDetectionResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Use native C++ detector if available (much faster)
      if (this.useNativeDetector && nativeFaceDetectionService.isAvailable()) {
        console.log(`⚡ NATIVE: Running high-performance C++ face detection...`);

        const startTime = Date.now();
        const nativeResult = await nativeFaceDetectionService.detectFacesAsync(imageBuffer);
        const totalTime = Date.now() - startTime;

        console.log(`🚀 NATIVE: Detected ${nativeResult.faces.length} faces in ${nativeResult.processingTimeMs}ms (total: ${totalTime}ms)`);

        // Convert native result to our format
        const faces: DetectedFace[] = nativeResult.faces
          .map(face => ({
            boundingBox: face.boundingBox,
            confidence: face.confidence,
            landmarks: face.landmarks || [],
          }))
          .filter(face => {
            console.log(`🔍 NATIVE: Processing detection: confidence=${face.confidence.toFixed(3)}, size=${face.boundingBox.width.toFixed(0)}x${face.boundingBox.height.toFixed(0)}`);
            // Light validation for native detector
            return this.validateBasicFaceLight(face);
          });

        console.log(`✅ NATIVE: ${faces.length} faces passed validation`);

        // Still create canvas for image saving compatibility
        const canvas = await this.bufferToCanvas(imageBuffer);
        return { faces, canvas };
      }

      // Fallback to TensorFlow.js MediaPipe detector
      const canvas = await this.bufferToCanvas(imageBuffer);

      console.log(`⚡ TENSORFLOW: Running MediaPipe on ${canvas.width}x${canvas.height} canvas...`);

      const detections = await this.detector!.estimateFaces(canvas);
      console.log(`📊 TENSORFLOW: MediaPipe found ${detections.length} faces`);

      // Log all raw detections
      detections.forEach((detection, index) => {
        const box = detection.box;
        const confidence = (detection as any).score || 1;
        console.log(`🔍 Raw Face ${index + 1}: confidence=${confidence.toFixed(3)}, size=${box.width.toFixed(0)}x${box.height.toFixed(0)}, pos=(${box.xMin.toFixed(0)},${box.yMin.toFixed(0)})`);
      });

      const faces: DetectedFace[] = detections
        .map(detection => {
          // Add padding to bounding box to ensure full face is captured
          const padding = Math.max(detection.box.width, detection.box.height) * 0.1;
          const x = Math.max(0, detection.box.xMin - padding);
          const y = Math.max(0, detection.box.yMin - padding);
          const width = Math.min(canvas.width - x, detection.box.width + 2 * padding);
          const height = Math.min(canvas.height - y, detection.box.height + 2 * padding);

          return {
            boundingBox: { x, y, width, height },
            confidence: (detection as any).score || 1,
            landmarks: detection.keypoints || [],
          };
        })
        .filter(face => {
          console.log(`🔍 TENSORFLOW: Processing detection: confidence=${face.confidence.toFixed(3)}, size=${face.boundingBox.width.toFixed(0)}x${face.boundingBox.height.toFixed(0)}`);
          return this.validateFace(face, canvas);
        });

      console.log(`✅ TENSORFLOW: ${faces.length} faces passed validation`);
      return { faces, canvas };
    } catch (error) {
      console.error('Face detection failed:', error);
      throw new Error(`Face detection failed: ${error}`);
    }
  }

  /**
   * Process a video frame for face detection and recognition
   */
  public async processVideoFrame(
    frameBuffer: Buffer,
    cameraId: number,
    organizationId: number,
    eventId?: number
  ): Promise<void> {
    try {
      // Detect faces in the frame
      const detection = await this.detectFaces(frameBuffer);

      if (detection.faces.length === 0) {
        return; // No faces detected
      }

      // Use provided eventId or get the active event for this camera
      const currentEventId = eventId || await this.getActiveEventForCamera(cameraId);

      // Only save detection images periodically to avoid too many duplicates
      let imageUrl = '';
      const currentTime = Date.now();
      if (currentTime - this.lastSavedImageTime > this.imageSaveInterval) {
        imageUrl = await this.saveDetectionImage(frameBuffer, detection.faces, detection.canvas);
        this.lastSavedImageTime = currentTime;
        console.log(`📸 DETECTION: Saved detection image with ${detection.faces.length} faces (camera ${cameraId})`);
      }

      // Process each detected face
      for (const face of detection.faces) {
        if (face.confidence >= this.faceThreshold) {
          // Try to recognize the face
          const recognition = await this.recognizeFace(face, organizationId);

          let personFaceId: number;

          if (recognition.isMatch && recognition.personFaceId) {
            // Known person detected
            personFaceId = recognition.personFaceId;
          } else {
            // Unknown person - create a placeholder
            personFaceId = await this.createUnknownPersonFace(face, organizationId);
          }

          // Record the detection
          await this.detectionService.create({
            detectedAt: new Date(),
            confidence: face.confidence,
            status: 'detected',
            imageUrl,
            metadata: JSON.stringify({
              boundingBox: face.boundingBox,
              isKnown: recognition.isMatch,
              recognitionConfidence: recognition.confidence,
            }),
            eventId: currentEventId,
            personFaceId,
            cameraId,
            organizationId,
          });
        }
      }
    } catch (error) {
      console.error('Error processing video frame:', error);
      // Don't throw - we don't want to stop the stream for recognition errors
    }
  }

  /**
   * Get the active event for a specific camera
   */
  private async getActiveEventForCamera(cameraId: number): Promise<number> {
    try {
      // Get all event-camera associations for this camera
      const eventCameras = await this.eventCameraService.findByCameraId(cameraId);

      // Filter for active associations
      const activeEventCameras = eventCameras.filter(ec => ec.isActive);

      if (activeEventCameras.length === 0) {
        throw new Error(`No active events found for camera ${cameraId}`);
      }

      // Get the event details for active associations
      const rightNow = new Date();
      for (const eventCamera of activeEventCameras) {
        const event = await this.eventService.findById(eventCamera.eventId);

        // Check if the event is active and scheduled (if it's a scheduled event)
        if (event.isActive && (event.startTime && event.endTime && rightNow >= new Date(event.startTime) && rightNow <= new Date(event.endTime))) {
          return event.id;
        }
      }

      throw new Error(`No active events found for camera ${cameraId}`);
    } catch (error) {
      console.error(`Error getting active event for camera ${cameraId}:`, error);
      throw error;
    }
  }

  /**
   * Recognize a detected face against known faces
   */
  private async recognizeFace(face: DetectedFace, organizationId: number): Promise<RecognitionResult> {
    try {
      // For now, return unknown - face encoding/matching would require more complex ML
      // This is a placeholder for face recognition logic
      // In a real implementation, you would:
      // 1. Extract face encoding from the detected face
      // 2. Compare against stored face encodings in the database
      // 3. Return the best match if confidence is above threshold

      return {
        confidence: 0,
        isMatch: false,
      };
    } catch (error) {
      console.error('Face recognition failed:', error);
      return {
        confidence: 0,
        isMatch: false,
      };
    }
  }

  /**
   * Create a placeholder PersonFace for unknown detections
   */
  private async createUnknownPersonFace(face: DetectedFace, organizationId: number): Promise<number> {
    try {
      // Create an unknown person entry
      const unknownPerson = await this.personService.create({
        name: `Unknown Person ${Date.now()}`,
        documentNumber: `UNK-${Date.now()}`,
        status: 'unidentified' as any,
        organizationId,
      });

      // Create a face entry for this unknown person
      const personFace = await this.personService.addFace(unknownPerson.id, {
        faceId: `face-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Generate unique faceId
        biometricParameters: JSON.stringify(face.encoding || []),
        reliability: face.confidence,
        status: 'active' as any,
        notes: JSON.stringify({
          source: 'camera_detection',
          boundingBox: face.boundingBox,
        }),
      } as any);

      return personFace.id;
    } catch (error) {
      console.error('Failed to create unknown person face:', error);
      throw error;
    }
  }

  /**
   * Save detection image with bounding boxes
   */
  private async saveDetectionImage(imageBuffer: Buffer, faces: DetectedFace[], detectionCanvas?: any): Promise<string> {
    try {
      const timestamp = Date.now();
      const filename = `detection_${timestamp}.jpg`;
      const detectionDir = path.join(process.cwd(), 'uploads', 'detections');

      // Ensure directory exists
      if (!fs.existsSync(detectionDir)) {
        fs.mkdirSync(detectionDir, { recursive: true });
      }

      const outputPath = path.join(detectionDir, filename);

      // Use the detection canvas if provided, otherwise create a new one
      const canvas = detectionCanvas || await this.bufferToCanvas(imageBuffer);
      const ctx = canvas.getContext('2d');

      // Draw bounding boxes
      faces.forEach((face, index) => {
        const { x, y, width, height } = face.boundingBox;

        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);

        // Add confidence label
        ctx.fillStyle = '#00ff00';
        ctx.font = '16px Arial';
        ctx.fillText(
          `Face ${index + 1}: ${(face.confidence * 100).toFixed(1)}%`,
          x,
          y - 5
        );
      });

      // Convert canvas to buffer and save
      const buffer = canvas.toBuffer('image/jpeg', { quality: 0.8 });
      fs.writeFileSync(outputPath, buffer);

      return `/uploads/detections/${filename}`;
    } catch (error) {
      console.error('Failed to save detection image:', error);
      return '';
    }
  }

  /**
   * Validate a detected face to reduce false positives
   */
  private validateFace(face: DetectedFace, canvas?: Canvas): boolean {
    const { width, height } = face.boundingBox;

    // Basic size validation
    if (width < 8 || height < 8) {
      console.log(`🚫 Face rejected: too small (${width}x${height})`);
      return false;
    }

    if (width > 1000 || height > 1000) {
      console.log(`🚫 Face rejected: too large (${width}x${height})`);
      return false;
    }

    // Aspect ratio validation
    const aspectRatio = width / height;
    if (aspectRatio < 0.15 || aspectRatio > 6.0) {
      console.log(`🚫 Face rejected: extreme aspect ratio (${aspectRatio.toFixed(2)})`);
      return false;
    }

    // Confidence threshold
    if (face.confidence < 0.2) {
      console.log(`🚫 Face rejected: very low confidence (${face.confidence.toFixed(2)})`);
      return false;
    }

    // Advanced validation to filter out printed faces/posters (if enabled)
    if (this.enableAdvancedFiltering && canvas && !this.validateRealFace(face, canvas)) {
      return false;
    }

    console.log(`✅ Face validated: ${width}x${height}, confidence: ${face.confidence.toFixed(2)}`);
    return true;
  }

  /**
   * Light validation for native detector
   */
  private validateBasicFaceLight(face: DetectedFace): boolean {
    const { width, height } = face.boundingBox;

    // Very permissive validation - just basic sanity checks
    if (width < 20 || height < 20) {
      console.log(`🚫 NATIVE: Face rejected: too small (${width}x${height})`);
      return false;
    }

    if (width > 500 || height > 500) {
      console.log(`🚫 NATIVE: Face rejected: too large (${width}x${height})`);
      return false;
    }

    console.log(`✅ NATIVE: Face validated: ${width}x${height}, confidence: ${face.confidence.toFixed(2)}`);
    return true;
  }

  /**
   * Basic validation for native detector (skip expensive canvas operations)
   */
  private validateBasicFace(face: DetectedFace): boolean {
    const { width, height } = face.boundingBox;

    // More balanced validation for native detector
    if (width < 30 || height < 30) {
      console.log(`🚫 NATIVE: Face rejected: too small (${width}x${height})`);
      return false;
    }

    if (width > 500 || height > 500) {
      console.log(`🚫 NATIVE: Face rejected: too large (${width}x${height})`);
      return false;
    }

    // More permissive aspect ratio for faces
    const aspectRatio = width / height;
    if (aspectRatio < 0.5 || aspectRatio > 2.0) {
      console.log(`🚫 NATIVE: Face rejected: bad aspect ratio (${aspectRatio.toFixed(2)})`);
      return false;
    }

    // Balanced confidence threshold for native detector
    if (face.confidence < 0.6) {
      console.log(`🚫 NATIVE: Face rejected: low confidence (${face.confidence.toFixed(2)})`);
      return false;
    }

    console.log(`✅ NATIVE: Face validated: ${width}x${height}, confidence: ${face.confidence.toFixed(2)}`);
    return true;
  }

  /**
   * Advanced validation to distinguish real faces from printed/artwork faces
   */
  private validateRealFace(face: DetectedFace, canvas: Canvas): boolean {
    try {
      const ctx = canvas.getContext('2d');
      const { x, y, width, height } = face.boundingBox;

      // Extract face region
      const faceImageData = ctx.getImageData(x, y, width, height);
      const data = faceImageData.data;

      // Analyze color properties
      const colorAnalysis = this.analyzeFaceColors(data);

      // Check for realistic skin tones
      if (!this.hasRealisticSkinTone(colorAnalysis)) {
        console.log(`🚫 Face rejected: unrealistic skin tone`);
        return false;
      }

      // Check for natural color variation (real faces have more variation than printed ones)
      if (!this.hasNaturalColorVariation(colorAnalysis)) {
        console.log(`🚫 Face rejected: lacks natural color variation (likely printed)`);
        return false;
      }

      // Check for edge characteristics (printed faces often have sharper, more uniform edges)
      if (this.hasArtificialEdges(data, width, height)) {
        console.log(`🚫 Face rejected: artificial edge characteristics (likely printed)`);
        return false;
      }

      return true;
    } catch (error) {
      console.log(`⚠️ Face validation error, accepting by default: ${error instanceof Error ? error.message : String(error)}`);
      return true; // Accept if validation fails
    }
  }

  private analyzeFaceColors(data: Uint8ClampedArray) {
    let totalR = 0, totalG = 0, totalB = 0;
    let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
    let pixelCount = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      totalR += r; totalG += g; totalB += b;
      minR = Math.min(minR, r); maxR = Math.max(maxR, r);
      minG = Math.min(minG, g); maxG = Math.max(maxG, g);
      minB = Math.min(minB, b); maxB = Math.max(maxB, b);
      pixelCount++;
    }

    return {
      avgR: totalR / pixelCount,
      avgG: totalG / pixelCount,
      avgB: totalB / pixelCount,
      variationR: maxR - minR,
      variationG: maxG - minG,
      variationB: maxB - minB,
    };
  }

  private hasRealisticSkinTone(colorAnalysis: any): boolean {
    const { avgR, avgG, avgB } = colorAnalysis;

    // Very permissive skin tone validation - mainly reject extreme non-skin colors
    // Allow wide range to account for different ethnicities, lighting, and camera settings
    if (avgR < 30 || avgR > 255) return false;
    if (avgG < 20 || avgG > 255) return false;
    if (avgB < 10 || avgB > 255) return false;

    // Reject obviously non-skin colors (pure blue, green, etc.)
    if (avgB > avgR + 50 && avgB > avgG + 50) return false; // Too blue
    if (avgG > avgR + 50 && avgG > avgB + 50) return false; // Too green

    return true;
  }

  private hasNaturalColorVariation(colorAnalysis: any): boolean {
    const { variationR, variationG, variationB } = colorAnalysis;

    // More permissive variation check - mainly reject completely flat colors
    const totalVariation = variationR + variationG + variationB;

    // Only reject if colors are extremely uniform (likely solid color blocks)
    if (totalVariation < 20) {
      return false;
    }

    // Allow much higher variation for noisy/textured images
    if (totalVariation > 600) {
      return false;
    }

    return true;
  }

  private hasArtificialEdges(data: Uint8ClampedArray, width: number, height: number): boolean {
    // More permissive edge detection - only reject extremely artificial patterns
    let sharpEdgeCount = 0;
    let totalEdges = 0;

    // Sample fewer pixels for performance and less strict checking
    for (let y = 2; y < height - 2; y += 2) {
      for (let x = 2; x < width - 2; x += 2) {
        const idx = (y * width + x) * 4;

        // Calculate luminance for current pixel
        const currentLum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

        // Check neighboring pixels
        const rightIdx = (y * width + (x + 2)) * 4;
        const bottomIdx = ((y + 2) * width + x) * 4;

        const rightLum = 0.299 * data[rightIdx] + 0.587 * data[rightIdx + 1] + 0.114 * data[rightIdx + 2];
        const bottomLum = 0.299 * data[bottomIdx] + 0.587 * data[bottomIdx + 1] + 0.114 * data[bottomIdx + 2];

        const edgeStrength = Math.abs(currentLum - rightLum) + Math.abs(currentLum - bottomLum);

        if (edgeStrength > 20) {
          totalEdges++;
          if (edgeStrength > 80) {
            sharpEdgeCount++;
          }
        }
      }
    }

    // Only reject if overwhelming majority are sharp edges (very artificial)
    const sharpEdgeRatio = totalEdges > 0 ? sharpEdgeCount / totalEdges : 0;
    return sharpEdgeRatio > 0.7;
  }

  /**
   * Convert image buffer to canvas
   */
  private async bufferToCanvas(buffer: Buffer): Promise<Canvas> {
    try {
      // Higher resolution processing for better face detection
      const processedBuffer = await sharp.default(buffer)
        .resize(1280, 960, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 }) // Higher quality preserves facial features
        .toBuffer();

      const image = await loadImage(processedBuffer);
      const canvas = createCanvas(image.width, image.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);

      return canvas;
    } catch (error) {
      console.error('Failed to convert buffer to canvas:', error);
      throw error;
    }
  }

  /**
   * Get service health and statistics
   */
  public getServiceHealth() {
    const baseHealth = {
      isInitialized: this.isInitialized,
      modelLoaded: this.isInitialized,
      settings: {
        faceThreshold: this.faceThreshold,
        recognitionThreshold: this.recognitionThreshold,
        useNativeDetector: this.useNativeDetector,
        enableAdvancedFiltering: this.enableAdvancedFiltering,
      },
    };

    // Add native detector stats if available
    if (this.useNativeDetector && nativeFaceDetectionService.isAvailable()) {
      return {
        ...baseHealth,
        detector: 'High-Performance C++ OpenCV',
        nativePerformance: nativeFaceDetectionService.getPerformanceStats(),
        expectedSpeedup: '10-50x faster than JavaScript',
      };
    }

    // Fallback TensorFlow.js stats
    return {
      ...baseHealth,
      detector: 'TensorFlow.js MediaPipe FaceDetector',
      backend: tf.getBackend(),
      memoryInfo: tf.memory(),
    };
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    if (this.detector) {
      this.detector.dispose();
      this.detector = null;
    }
    this.isInitialized = false;
    console.log('🔄 DISPOSE: MediaPipe detector disposed for re-initialization');
  }
}

// Export singleton instance
export const faceRecognitionService = new FaceRecognitionService();