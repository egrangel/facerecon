import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-cpu';
import * as faceDetection from '@tensorflow-models/face-detection';
import { createCanvas, loadImage, Canvas, CanvasRenderingContext2D } from 'canvas';
import * as sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';
import { PersonService, DetectionService } from './index';

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
  private detector: faceDetection.FaceDetector | null = null;
  private isInitialized = false;
  private personService: PersonService;
  private detectionService: DetectionService;
  private readonly faceThreshold = 0.8; // Minimum confidence for face detection
  private readonly recognitionThreshold = 0.8; // Minimum confidence for face recognition

  constructor() {
    this.personService = new PersonService();
    this.detectionService = new DetectionService();
  }

  /**
   * Initialize the face detection model
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('Initializing TensorFlow.js face detection...');

      // Set TensorFlow backend to CPU
      await tf.setBackend('cpu');
      await tf.ready();
      console.log('TensorFlow.js backend:', tf.getBackend());

      // Create face detector
      const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
      const detectorConfig = {
        runtime: 'tfjs' as const,
        modelType: 'full' as const,
        maxFaces: 10,
        minDetectionConfidence: this.faceThreshold,
      };

      this.detector = await faceDetection.createDetector(model, detectorConfig);
      this.isInitialized = true;
      console.log('✅ Face detection model initialized successfully');
    } catch (error) {
      console.error('❌ CRITICAL: Failed to initialize face detection:', error);
      console.error('💥 APPLICATION MUST EXIT - TensorFlow.js cannot be initialized');
      throw new Error(`Face detection initialization failed: ${error}`);
    }
  }

  /**
   * Detect faces in an image buffer
   */
  public async detectFaces(imageBuffer: Buffer): Promise<FaceDetectionResult> {
    if (!this.isInitialized || !this.detector) {
      await this.initialize();
    }

    try {
      // Convert buffer to canvas
      const canvas = await this.bufferToCanvas(imageBuffer);

      // Detect faces
      const predictions = await this.detector!.estimateFaces(canvas);

      const faces: DetectedFace[] = predictions.map(prediction => ({
        boundingBox: {
          x: prediction.box.xMin,
          y: prediction.box.yMin,
          width: prediction.box.width,
          height: prediction.box.height,
        },
        confidence: (prediction as any).score || 0,
        landmarks: prediction.keypoints,
      }));

      console.log(`Detected ${faces.length} faces`);

      return { faces };
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
    organizationId: number
  ): Promise<void> {
    try {
      // Detect faces in the frame
      const detection = await this.detectFaces(frameBuffer);

      if (detection.faces.length === 0) {
        return; // No faces detected
      }

      // Save the frame with detected faces
      const imageUrl = await this.saveDetectionImage(frameBuffer, detection.faces);

      // Process each detected face
      for (const face of detection.faces) {
        if (face.confidence >= this.faceThreshold) {
          // Try to recognize the face
          const recognition = await this.recognizeFace(face, organizationId);

          let personFaceId: number;

          if (recognition.isMatch && recognition.personFaceId) {
            // Known person detected
            personFaceId = recognition.personFaceId;
            console.log(`Known person detected: ${recognition.personName} (confidence: ${recognition.confidence})`);
          } else {
            // Unknown person - create a placeholder
            personFaceId = await this.createUnknownPersonFace(face, organizationId);
            console.log(`Unknown person detected (confidence: ${face.confidence})`);
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
            eventId: event.id,
            personFaceId,
            cameraId,
          });
        }
      }

      console.log(`Processed frame: ${detection.faces.length} faces detected from camera ${cameraId}`);
    } catch (error) {
      console.error('Error processing video frame:', error);
      // Don't throw - we don't want to stop the stream for recognition errors
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
        encoding: JSON.stringify(face.encoding || []),
        confidence: face.confidence,
        status: 'active' as any,
        metadata: JSON.stringify({
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

      // Draw bounding boxes on the image
      const canvas = await this.bufferToCanvas(imageBuffer);
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
   * Convert image buffer to canvas
   */
  private async bufferToCanvas(buffer: Buffer): Promise<Canvas> {
    try {
      // Resize image for processing (optimize performance)
      const processedBuffer = await sharp.default(buffer)
        .resize(1280, 720, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
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
   * Extract frame from video stream (placeholder for integration with StreamService)
   */
  public async extractFrameFromStream(streamPath: string): Promise<Buffer | null> {
    try {
      // This would integrate with FFmpeg to extract frames from the HLS stream
      // For now, return null - this needs to be implemented based on your stream setup
      return null;
    } catch (error) {
      console.error('Failed to extract frame from stream:', error);
      return null;
    }
  }

  /**
   * Get service health and statistics
   */
  public getServiceHealth() {
    return {
      isInitialized: this.isInitialized,
      modelLoaded: this.detector !== null,
      backend: tf.getBackend(),
      memoryInfo: tf.memory(),
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
      // TensorFlow.js models don't have a dispose method, but we can clear the reference
      this.detector = null;
    }
    this.isInitialized = false;
  }
}

// Export singleton instance
export const faceRecognitionService = new FaceRecognitionService();