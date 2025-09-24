import * as path from 'path';
import * as fs from 'fs';
import { createCanvas, loadImage } from 'canvas';
import { PersonService, DetectionService, EventService, EventCameraService } from './index';
import { nativeFaceDetectionService } from './NativeFaceDetectionService';

export interface FaceDetectionResult {
  faces: DetectedFace[];
  processedImagePath?: string;
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
  private isInitialized = false;
  private personService: PersonService;
  private detectionService: DetectionService;
  private eventService: EventService;
  private eventCameraService: EventCameraService;
  private readonly faceThreshold = 0.8; // Higher threshold to reduce false positives
  private readonly recognitionThreshold = 0.8; // Minimum confidence for face recognition
  private lastSavedImageTime = 0; // Track when we last saved a detection image
  private readonly imageSaveInterval = 1000; // Save detection images max every 1000ms for crowd monitoring

  constructor() {
    this.personService = new PersonService();
    this.detectionService = new DetectionService();
    this.eventService = new EventService();
    this.eventCameraService = new EventCameraService();
  }

  /**
   * Initialize the native face detection model
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('🔄 INIT: Forcing face detection re-initialization...');
      this.dispose(); // Force re-initialization with new config
    }

    try {
      console.log('🚀 INIT: Initializing native C++ face detector...');
      const nativeSuccess = await nativeFaceDetectionService.initialize();

      if (nativeSuccess) {
        this.isInitialized = true;
        console.log('🎉 INIT: Native C++ face detector ready!');
        console.log('⚡ NATIVE: High-performance OpenCV face detection active');
        return;
      } else {
        throw new Error('Native detector initialization failed');
      }
    } catch (error) {
      console.error('❌ CRITICAL: Failed to initialize native face detection:', error);
      throw new Error(`Native face detection initialization failed: ${error}`);
    }
  }

  /**
   * Detect faces in an image buffer using native detector
   */
  public async detectFaces(imageBuffer: Buffer): Promise<FaceDetectionResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const startTime = Date.now();
      const nativeResult = await nativeFaceDetectionService.detectFacesAsync(imageBuffer);
      const totalTime = Date.now() - startTime;

      console.log(`🚀 NATIVE: Detected ${nativeResult.faces.length} faces in ${nativeResult.processingTimeMs}ms (total: ${totalTime}ms)`);

      // Convert native result to our format
      const candidateFaces: DetectedFace[] = nativeResult.faces
        .map(face => ({
          boundingBox: face.boundingBox,
          confidence: face.confidence,
          landmarks: face.landmarks || [],
        }))
        .filter(face => {
          console.log(`🔍 NATIVE: Processing detection: confidence=${face.confidence.toFixed(3)}, size=${face.boundingBox.width.toFixed(0)}x${face.boundingBox.height.toFixed(0)}`);
          // Basic validation for native detector
          return this.validateBasicFace(face);
        });

      console.log(`🔍 FILTER: ${candidateFaces.length} faces passed basic validation`);

      // Apply advanced filtering to remove false positives
      const faces = this.applyAdvancedFiltering(candidateFaces);

      console.log(`✅ FINAL: ${faces.length} faces passed all validation (${candidateFaces.length - faces.length} filtered out)`);

      return { faces };
    } catch (error) {
      console.error('Native face detection failed:', error);
      throw new Error(`Native face detection failed: ${error}`);
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
        imageUrl = await this.saveDetectionImage(frameBuffer, detection.faces);
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
   * Save detection image with bounding boxes drawn
   */
  private async saveDetectionImage(imageBuffer: Buffer, faces: DetectedFace[]): Promise<string> {
    try {
      const timestamp = Date.now();
      const filename = `detection_${timestamp}.jpg`;
      const detectionDir = path.join(process.cwd(), 'uploads', 'detections');

      // Ensure directory exists
      if (!fs.existsSync(detectionDir)) {
        fs.mkdirSync(detectionDir, { recursive: true });
      }

      const outputPath = path.join(detectionDir, filename);

      if (faces.length === 0) {
        // No faces detected, save original image
        fs.writeFileSync(outputPath, imageBuffer);
      } else {
        // Load image and draw bounding boxes
        const image = await loadImage(imageBuffer);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');

        // Draw the original image
        ctx.drawImage(image, 0, 0);

        // Draw bounding boxes for each detected face
        faces.forEach((face, index) => {
          const { x, y, width, height } = face.boundingBox;

          // Draw bounding box
          ctx.strokeStyle = '#00ff00'; // Green color
          ctx.lineWidth = 3;
          ctx.strokeRect(x, y, width, height);

          // Draw confidence label
          ctx.fillStyle = '#00ff00';
          ctx.font = '16px Arial';
          ctx.fillRect(x, y - 25, width, 25); // Background for text
          ctx.fillStyle = '#000000'; // Black text
          ctx.fillText(
            `Face ${index + 1}: ${(face.confidence * 100).toFixed(1)}%`,
            x + 5,
            y - 8
          );
        });

        // Convert canvas to buffer and save
        const buffer = canvas.toBuffer('image/jpeg', { quality: 0.8 });
        fs.writeFileSync(outputPath, buffer);
      }

      return `/uploads/detections/${filename}`;
    } catch (error) {
      console.error('Failed to save detection image:', error);
      // Fallback to saving original image
      try {
        const fallbackPath = path.join(process.cwd(), 'uploads', 'detections', `detection_${Date.now()}.jpg`);
        fs.writeFileSync(fallbackPath, imageBuffer);
        return `/uploads/detections/${path.basename(fallbackPath)}`;
      } catch (fallbackError) {
        console.error('Failed to save fallback image:', fallbackError);
        return '';
      }
    }
  }

  /**
   * Apply advanced filtering to remove false positives
   */
  private applyAdvancedFiltering(faces: DetectedFace[]): DetectedFace[] {
    if (faces.length === 0) return faces;

    console.log(`🔍 ADVANCED: Starting with ${faces.length} candidate faces`);

    // Step 1: Non-Maximum Suppression to remove overlapping detections
    let filteredFaces = this.nonMaximumSuppression(faces, 0.3);
    console.log(`🔍 NMS: ${filteredFaces.length} faces after overlap removal`);

    // Step 2: Remove faces in UI overlay areas (timestamps, camera info, etc.)
    filteredFaces = this.removeUIOverlayFaces(filteredFaces);
    console.log(`🔍 UI: ${filteredFaces.length} faces after UI overlay filtering`);

    // Step 3: Remove faces that are too densely packed (likely false positives)
    filteredFaces = this.removeDenselyPackedFaces(filteredFaces);
    console.log(`🔍 DENSITY: ${filteredFaces.length} faces after density filtering`);

    // Step 4: Keep only the highest confidence faces (top 20% or max 10 faces)
    filteredFaces = this.keepTopConfidenceFaces(filteredFaces, 10);
    console.log(`🔍 TOP: ${filteredFaces.length} faces after confidence ranking`);

    return filteredFaces;
  }

  /**
   * Non-Maximum Suppression to remove overlapping bounding boxes
   */
  private nonMaximumSuppression(faces: DetectedFace[], overlapThreshold: number): DetectedFace[] {
    if (faces.length === 0) return faces;

    // Sort by confidence (highest first)
    const sortedFaces = [...faces].sort((a, b) => b.confidence - a.confidence);
    const keep: DetectedFace[] = [];

    for (const face of sortedFaces) {
      let shouldKeep = true;

      for (const keptFace of keep) {
        const overlap = this.calculateOverlap(face.boundingBox, keptFace.boundingBox);
        if (overlap > overlapThreshold) {
          shouldKeep = false;
          break;
        }
      }

      if (shouldKeep) {
        keep.push(face);
      }
    }

    return keep;
  }

  /**
   * Calculate overlap ratio between two bounding boxes
   */
  private calculateOverlap(box1: any, box2: any): number {
    const x1 = Math.max(box1.x, box2.x);
    const y1 = Math.max(box1.y, box2.y);
    const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
    const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

    if (x2 <= x1 || y2 <= y1) return 0;

    const intersectionArea = (x2 - x1) * (y2 - y1);
    const box1Area = box1.width * box1.height;
    const box2Area = box2.width * box2.height;
    const unionArea = box1Area + box2Area - intersectionArea;

    return intersectionArea / unionArea;
  }

  /**
   * Remove faces that are too densely packed (likely false positives on textures)
   */
  private removeDenselyPackedFaces(faces: DetectedFace[]): DetectedFace[] {
    if (faces.length <= 3) return faces; // Keep if few faces

    const filtered: DetectedFace[] = [];

    for (const face of faces) {
      let nearbyCount = 0;
      const searchRadius = Math.max(face.boundingBox.width, face.boundingBox.height) * 2;

      for (const otherFace of faces) {
        if (face === otherFace) continue;

        const distance = this.calculateDistance(
          face.boundingBox.x + face.boundingBox.width / 2,
          face.boundingBox.y + face.boundingBox.height / 2,
          otherFace.boundingBox.x + otherFace.boundingBox.width / 2,
          otherFace.boundingBox.y + otherFace.boundingBox.height / 2
        );

        if (distance < searchRadius) {
          nearbyCount++;
        }
      }

      // Keep face if it's not too densely packed (max 2 nearby faces)
      if (nearbyCount <= 2) {
        filtered.push(face);
      } else {
        console.log(`🚫 DENSITY: Rejected face with ${nearbyCount} nearby faces (too dense)`);
      }
    }

    return filtered;
  }

  /**
   * Calculate Euclidean distance between two points
   */
  private calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }

  /**
   * Remove faces detected in UI overlay areas (timestamps, camera info, etc.)
   */
  private removeUIOverlayFaces(faces: DetectedFace[]): DetectedFace[] {
    const filtered: DetectedFace[] = [];

    for (const face of faces) {
      const { x, y, width, height } = face.boundingBox;

      // Define UI overlay exclusion zones (typically where timestamps/text appear)
      const isInTopLeftCorner = x < 200 && y < 100; // Top-left corner (timestamp area)
      const isInTopRightCorner = x > (1920 - 200) && y < 100; // Top-right corner
      const isInBottomLeftCorner = x < 200 && y > (1080 - 100); // Bottom-left corner
      const isInBottomRightCorner = x > (1920 - 200) && y > (1080 - 100); // Bottom-right corner

      // Additional checks for small detections in corner areas (likely text/numbers)
      const isSmallInCorner = (width < 50 || height < 50) &&
        (x < 300 || x > (1920 - 300) || y < 150 || y > (1080 - 150));

      // Check if detection is very thin/wide (likely text)
      const aspectRatio = width / height;
      const isTextLike = aspectRatio > 3.0 || aspectRatio < 0.3;

      if (isInTopLeftCorner || isInTopRightCorner || isInBottomLeftCorner ||
          isInBottomRightCorner || isSmallInCorner || isTextLike) {
        console.log(`🚫 UI: Rejected face in overlay area: ${x},${y} ${width}x${height} (aspect: ${aspectRatio.toFixed(2)})`);
      } else {
        filtered.push(face);
      }
    }

    return filtered;
  }

  /**
   * Keep only the top N highest confidence faces
   */
  private keepTopConfidenceFaces(faces: DetectedFace[], maxFaces: number): DetectedFace[] {
    if (faces.length <= maxFaces) return faces;

    return faces
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxFaces);
  }

  /**
   * Strict validation for detected faces to reduce false positives
   */
  private validateBasicFace(face: DetectedFace): boolean {
    const { width, height } = face.boundingBox;

    // Much stricter confidence threshold - faces should be very clear
    if (face.confidence < 0.85) {
      console.log(`🚫 Face rejected: confidence too low (${face.confidence.toFixed(2)})`);
      return false;
    }

    // Stricter size validation for realistic face sizes
    if (width < 30 || height < 30) {
      console.log(`🚫 Face rejected: too small (${width}x${height})`);
      return false;
    }

    if (width > 300 || height > 300) {
      console.log(`🚫 Face rejected: too large (${width}x${height})`);
      return false;
    }

    // Much stricter aspect ratio for realistic faces
    const aspectRatio = width / height;
    if (aspectRatio < 0.7 || aspectRatio > 1.5) {
      console.log(`🚫 Face rejected: unrealistic aspect ratio (${aspectRatio.toFixed(2)})`);
      return false;
    }

    // Minimum size requirements for reasonable face detection
    const faceArea = width * height;
    if (faceArea < 1000) { // Minimum 1000 pixels area
      console.log(`🚫 Face rejected: area too small (${faceArea}px²)`);
      return false;
    }

    console.log(`✅ Face validated: ${width}x${height}, confidence: ${face.confidence.toFixed(2)}, area: ${faceArea}px²`);
    return true;
  }



  /**
   * Get service health and statistics
   */
  public getServiceHealth() {
    return {
      isInitialized: this.isInitialized,
      modelLoaded: this.isInitialized,
      detector: 'Native C++ OpenCV',
      settings: {
        faceThreshold: this.faceThreshold,
        recognitionThreshold: this.recognitionThreshold,
      },
      nativePerformance: nativeFaceDetectionService.getPerformanceStats(),
      performance: 'High-performance native implementation',
    };
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.isInitialized = false;
    nativeFaceDetectionService.dispose();
    console.log('🔄 DISPOSE: Native face detector disposed for re-initialization');
  }
}

// Export singleton instance
export const faceRecognitionService = new FaceRecognitionService();