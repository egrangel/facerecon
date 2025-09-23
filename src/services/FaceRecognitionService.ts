import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-cpu';
import * as faceDetection from '@tensorflow-models/face-detection';
import { createCanvas, loadImage, Canvas } from 'canvas';
import * as sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';
import { PersonService, DetectionService, EventService, EventCameraService } from './index';

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
  private readonly faceThreshold = 0.3; // Very low threshold for better detection
  private readonly recognitionThreshold = 0.8; // Minimum confidence for face recognition
  private readonly minFaceSize = 15; // Very small minimum face size
  private readonly maxFaceSize = 1000; // Large maximum face size for distant cameras

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
      console.log('🔄 INIT: Forcing MediaPipe re-initialization for crowd detection...');
      this.dispose(); // Force re-initialization with new config
    }

    try {
      console.log('🚀 INIT: Starting ultra-fast MediaPipe initialization...');

      // Set TensorFlow backend to CPU for faster startup
      await tf.setBackend('cpu');
      await tf.ready();
      console.log(`✅ INIT: TensorFlow.js backend ready: ${tf.getBackend()}`);

      // Create MediaPipe detector optimized for mass attendance (many faces)
      const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
      const detectorConfig = {
        runtime: 'tfjs' as const,
        modelType: 'short' as const, // Fastest model
        maxFaces: 30, // High limit for crowd detection in mass
        minDetectionConfidence: 0.3, // Very low for mass attendance detection
        minSuppressionThreshold: 0.1, // Very low to allow overlapping faces in crowds
      };

      console.log(`⚡ INIT: Ultra-fast MediaPipe config: ${JSON.stringify(detectorConfig)}`);

      this.detector = await faceDetection.createDetector(model, detectorConfig);
      this.isInitialized = true;
      console.log('🎉 INIT: Ultra-fast MediaPipe initialization completed!');
    } catch (error) {
      console.error('❌ CRITICAL: Failed to initialize MediaPipe:', error);
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
      // Convert buffer to canvas
      const canvas = await this.bufferToCanvas(imageBuffer);

      // Detect faces using ultra-fast MediaPipe
      console.log(`⚡ FACE DETECTION: Running ultra-fast MediaPipe on ${canvas.width}x${canvas.height} canvas...`);

      const detections = await this.detector!.estimateFaces(canvas);
      console.log(`📊 FACE DETECTION: MediaPipe found ${detections.length} faces in milliseconds!`);

      // Log all raw detections
      detections.forEach((detection, index) => {
        const box = detection.box;
        const confidence = detection.probability ? detection.probability[0] : 1;
        console.log(`🔍 Raw Face ${index + 1}: confidence=${confidence.toFixed(3)}, size=${box.width.toFixed(0)}x${box.height.toFixed(0)}, pos=(${box.xMin.toFixed(0)},${box.yMin.toFixed(0)})`);
      });

      const faces: DetectedFace[] = detections
        .map(detection => ({
          boundingBox: {
            x: detection.box.xMin,
            y: detection.box.yMin,
            width: detection.box.width,
            height: detection.box.height,
          },
          confidence: detection.probability ? detection.probability[0] : 1,
          landmarks: detection.keypoints || [],
        }))
        .filter(face => {
          console.log(`🔍 Processing detection: confidence=${face.confidence.toFixed(3)}, size=${face.boundingBox.width.toFixed(0)}x${face.boundingBox.height.toFixed(0)}`);
          return this.validateFace(face);
        });

      console.log(`✅ FACE DETECTION: ${faces.length} faces passed validation`);
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

      // Save the frame with detected faces using the detection canvas for accurate coordinates
      const imageUrl = await this.saveDetectionImage(frameBuffer, detection.faces, detection.canvas);

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
  private validateFace(face: DetectedFace): boolean {
    const { width, height } = face.boundingBox;

    // Very permissive size validation for mass attendance
    if (width < 10 || height < 10) {
      console.log(`🚫 Face rejected: too small (${width}x${height})`);
      return false;
    }

    if (width > 1000 || height > 1000) {
      console.log(`🚫 Face rejected: too large (${width}x${height})`);
      return false;
    }

    // Very permissive aspect ratio validation
    const aspectRatio = width / height;
    if (aspectRatio < 0.2 || aspectRatio > 5.0) {
      console.log(`🚫 Face rejected: extreme aspect ratio (${aspectRatio.toFixed(2)})`);
      return false;
    }

    // Very permissive confidence threshold for mass attendance
    if (face.confidence < 0.3) {
      console.log(`🚫 Face rejected: very low confidence (${face.confidence.toFixed(2)})`);
      return false;
    }

    console.log(`✅ Face validated: ${width}x${height}, confidence: ${face.confidence.toFixed(2)}`);
    return true;
  }

  /**
   * Convert image buffer to canvas
   */
  private async bufferToCanvas(buffer: Buffer): Promise<Canvas> {
    try {
      // Balanced processing - larger size for better face detection in crowds
      const processedBuffer = await sharp.default(buffer)
        .resize(640, 480, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 60 }) // Higher quality for better face detection
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
    return {
      isInitialized: this.isInitialized,
      modelLoaded: this.isInitialized,
      backend: tf.getBackend(),
      memoryInfo: tf.memory(),
      model: 'Ultra-Fast MediaPipe FaceDetector',
      settings: {
        faceThreshold: this.faceThreshold,
        recognitionThreshold: this.recognitionThreshold,
      },
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