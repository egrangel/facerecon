import * as path from 'path';
import * as fs from 'fs';
import { PersonService, EventService, DetectionService } from './index';

export interface SimpleFaceDetectionResult {
  faces: SimpleDetectedFace[];
  processedImagePath?: string;
}

export interface SimpleDetectedFace {
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
}

export class SimpleFaceDetectionService {
  private personService: PersonService;
  private eventService: EventService;
  private detectionService: DetectionService;
  private readonly faceThreshold = 0.7;

  constructor() {
    this.personService = new PersonService();
    this.eventService = new EventService();
    this.detectionService = new DetectionService();
  }

  /**
   * Simple mock face detection for testing purposes
   */
  public async detectFaces(imageBuffer: Buffer): Promise<SimpleFaceDetectionResult> {
    try {
      // Mock detection - in a real implementation this would use computer vision
      // For testing, we'll randomly detect 0-2 faces
      const numFaces = Math.floor(Math.random() * 3); // 0, 1, or 2 faces

      const faces: SimpleDetectedFace[] = [];
      for (let i = 0; i < numFaces; i++) {
        faces.push({
          boundingBox: {
            x: Math.floor(Math.random() * 300),
            y: Math.floor(Math.random() * 200),
            width: 100 + Math.floor(Math.random() * 100),
            height: 120 + Math.floor(Math.random() * 80),
          },
          confidence: 0.7 + Math.random() * 0.3, // 0.7 to 1.0
        });
      }

      console.log(`Mock face detection: found ${faces.length} faces`);
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
        console.log(`No faces detected in frame from camera ${cameraId}`);
        return;
      }

      // Save the frame with detected faces
      const imageUrl = await this.saveDetectionImage(frameBuffer, detection.faces);

      // Create an event for this detection session
      const event = await this.eventService.create({
        name: `Face Detection - Camera ${cameraId}`,
        description: `Automatic face detection from camera stream`,
        type: 'detection',
        occurredAt: new Date(),
        status: 'active',
        organizationId,
        coordinates: JSON.stringify(detection.faces.map(f => f.boundingBox)),
      });

      // Process each detected face
      for (const face of detection.faces) {
        if (face.confidence >= this.faceThreshold) {
          // Create unknown person for now (face recognition would go here)
          const personFaceId = await this.createUnknownPersonFace(face, organizationId);

          // Record the detection
          await this.detectionService.create({
            detectedAt: new Date(),
            confidence: face.confidence,
            status: 'detected',
            imageUrl,
            metadata: JSON.stringify({
              boundingBox: face.boundingBox,
              isKnown: false,
              recognitionConfidence: 0,
            }),
            eventId: event.id,
            personFaceId,
            cameraId,
          });

          console.log(`Unknown person detected with confidence: ${face.confidence}`);
        }
      }

      console.log(`Processed frame: ${detection.faces.length} faces detected from camera ${cameraId}`);
    } catch (error) {
      console.error('Error processing video frame:', error);
      // Don't throw - we don't want to stop the stream for recognition errors
    }
  }

  /**
   * Create a placeholder PersonFace for unknown detections
   */
  private async createUnknownPersonFace(face: SimpleDetectedFace, organizationId: number): Promise<number> {
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
        encoding: JSON.stringify([]),
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
   * Save detection image (simplified version without drawing boxes)
   */
  private async saveDetectionImage(imageBuffer: Buffer, faces: SimpleDetectedFace[]): Promise<string> {
    try {
      const timestamp = Date.now();
      const filename = `detection_${timestamp}.jpg`;
      const detectionDir = path.join(process.cwd(), 'uploads', 'detections');

      // Ensure directory exists
      if (!fs.existsSync(detectionDir)) {
        fs.mkdirSync(detectionDir, { recursive: true });
      }

      const outputPath = path.join(detectionDir, filename);

      // For now, just save the original image
      // In the future, you could add box drawing here
      fs.writeFileSync(outputPath, imageBuffer);

      return `/uploads/detections/${filename}`;
    } catch (error) {
      console.error('Failed to save detection image:', error);
      return '';
    }
  }

  /**
   * Get service health
   */
  public getServiceHealth() {
    return {
      isInitialized: true,
      modelLoaded: true,
      backend: 'simple-mock',
      settings: {
        faceThreshold: this.faceThreshold,
      },
    };
  }
}

// Export singleton instance
export const simpleFaceDetectionService = new SimpleFaceDetectionService();