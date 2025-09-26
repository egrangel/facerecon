import * as path from 'path';
import * as fs from 'fs';
import { createCanvas, loadImage } from 'canvas';
import { PersonService, DetectionService, EventService, EventCameraService } from './index';
import { nativeFaceDetectionService } from './NativeFaceDetectionService';
import { faceIndexService } from './FaceIndexService';

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
  personId?: number;
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
  private readonly processingTimeoutMs = 10000; // 10 second timeout for face detection
  private readonly performanceStats = {
    totalProcessingTime: 0,
    totalDetections: 0,
    averageProcessingTime: 0,
    activeDetections: 0,
    lastResetTime: Date.now(),
  };

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
      this.dispose(); // Force re-initialization with new config
    }

    try {
      const nativeSuccess = await nativeFaceDetectionService.initialize();

      if (nativeSuccess) {
        this.isInitialized = true;
        return;
      } else {
        throw new Error('Native detector initialization failed');
      }
    } catch (error) {
      throw new Error(`Native face detection initialization failed: ${error}`);
    }
  }

  /**
   * Detect faces in an image buffer using native detector with timeout protection
   */
  public async detectFaces(imageBuffer: Buffer): Promise<FaceDetectionResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Wrap detection with timeout to prevent freezing
      const nativeResult: any = await Promise.race([
        nativeFaceDetectionService.detectFacesAsync(imageBuffer),
        this.createTimeoutPromise(this.processingTimeoutMs, 'Face detection timeout')
      ]);

      // Convert native result to our format
      const candidateFaces: DetectedFace[] = nativeResult.faces
        .map((face: any) => ({
          boundingBox: face.boundingBox,
          confidence: face.confidence,
          landmarks: face.landmarks || [],
          encoding: face.encoding || [], // Include face encoding from C++
        }))
        .filter((face: any) => {
          // Basic validation for native detector
          return this.validateBasicFace(face);
        });

      // Apply advanced filtering to remove false positives
      const faces = this.applyAdvancedFiltering(candidateFaces);

      return { faces };
    } catch (error: any) {
      if (error.message && error.message.includes('timeout')) {
        console.warn('⚠️ Face detection timed out, disposing detector for re-initialization');
        this.dispose(); // Force re-initialization on timeout
        return { faces: [] }; // Return empty result on timeout
      }
      throw new Error(`Native face detection failed: ${error}`);
    }
  }

  /**
   * Create a timeout promise that rejects after specified milliseconds
   */
  private createTimeoutPromise<T>(ms: number, message: string): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  /**
   * Process a video frame for face detection and recognition with camera-level throttling
   */
  public async processVideoFrame(
    frameBuffer: Buffer,
    cameraId: number,
    organizationId: number,
    eventId?: number
  ): Promise<void> {
    try {
      // Start performance tracking
      const startTime = Date.now();
      this.performanceStats.activeDetections++;

      console.log(`🎯 Camera ${cameraId}: Starting detection (${this.performanceStats.activeDetections} active globally)`);

      // Detect faces in the frame with timeout protection - no throttling, full concurrency
      const detection = await this.detectFaces(frameBuffer);
      const processingTime = Date.now() - startTime;

      // Update performance statistics
      this.performanceStats.totalDetections++;
      this.performanceStats.totalProcessingTime += processingTime;
      this.performanceStats.averageProcessingTime = this.performanceStats.totalProcessingTime / this.performanceStats.totalDetections;

      console.log(`✅ Camera ${cameraId}: Detection completed in ${processingTime}ms, found ${detection.faces.length} faces (avg: ${this.performanceStats.averageProcessingTime.toFixed(1)}ms)`);

      if (detection.faces.length === 0) {
        this.performanceStats.activeDetections--;
        return; // No faces detected
      }

      // Use provided eventId or get the active event for this camera
      let currentEventId = eventId;
      if (!currentEventId) {
        try {
          currentEventId = await this.getActiveEventForCamera(cameraId);
        } catch (error) {
          console.log(`No active event for camera ${cameraId}, skipping detection recording (faces detected but not saved)`);
          this.performanceStats.activeDetections--;
          return; // Skip detection recording when no active event
        }
      }

      // Only save detection images periodically to avoid too many duplicates
      let imageUrl = '';
      const currentTime = Date.now();
      if (currentTime - this.lastSavedImageTime > this.imageSaveInterval) {
        imageUrl = await this.saveDetectionImage(frameBuffer, detection.faces);
        this.lastSavedImageTime = currentTime;
      }

      // Process each detected face
      for (let index = 0; index < detection.faces.length; index++) {
        const face = detection.faces[index];
        if (face.confidence >= this.faceThreshold) {
          // Try to recognize the face
          const recognition = await this.recognizeFace(face, organizationId);

          let personFaceId: number | undefined;

          if (recognition.isMatch && recognition.personId) {
            // Known person detected - use existing PersonFace ID
            personFaceId = recognition.personId;
            console.log(`✅ Known person detected: PersonFace ID ${personFaceId}`);
          } else {
            // Unknown person - store embedding in detection without creating person record
            personFaceId = undefined; // No person association for unknown faces
            console.log(`❓ Unknown face detected - storing biometric data in detection without creating person record`);
          }

          // Save individual face crop
          const faceImageUrl = await this.saveFaceCrop(frameBuffer, face, index);

          // Convert face encoding to Buffer for database storage
          let embeddingBuffer: Buffer | undefined;
          if (face.encoding && face.encoding.length > 0) {
            const float32Array = new Float32Array(face.encoding);
            embeddingBuffer = Buffer.from(float32Array.buffer);
          }

          // Determine detection status based on recognition result and confidence
          let detectionStatus = 'detectada'; // Default for unknown faces
          if (recognition.isMatch) {
            // For recognized faces, auto-confirm if confidence is 100%, otherwise set to 'reconhecida'
            detectionStatus = recognition.confidence === 1.0 ? 'confirmada' : 'reconhecida';
          }

          // Record the detection with enhanced metadata
          await this.detectionService.create({
            detectedAt: new Date(),
            confidence: face.confidence,
            status: detectionStatus,
            imageUrl: faceImageUrl, // Use face crop URL instead of full detection image
            embedding: embeddingBuffer, // Store the face embedding for future recognition
            metadata: JSON.stringify({
              boundingBox: face.boundingBox,
              isKnown: recognition.isMatch,
              recognitionConfidence: recognition.confidence,
              personName: recognition.personName || null, // null instead of 'Unknown'
              encodingLength: face.encoding?.length || 0,
              faceDetectionConfidence: face.confidence,
              processingTimestamp: new Date().toISOString(),
              fullDetectionImageUrl: imageUrl, // Store full image URL in metadata
              faceIndex: index,
              autoConfirmed: recognition.isMatch && recognition.confidence === 1.0, // Flag for auto-confirmation
            }),
            eventId: currentEventId,
            personFaceId: personFaceId, // This will be undefined for unknown faces
            cameraId,
            organizationId,
          });
        }
      }

      // Mark processing complete
      this.performanceStats.activeDetections--;

    } catch (error) {
      console.error('Error processing video frame:', error);

      // Ensure processing counter is decremented on error
      if (this.performanceStats.activeDetections > 0) {
        this.performanceStats.activeDetections--;
      }

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
      // Check if we have encoding data for the detected face
      if (!face.encoding || face.encoding.length === 0) {
        console.warn(`⚠️ FACE RECOGNITION: Cannot recognize face - no encoding data available (encoding: ${face.encoding ? 'empty array' : 'null/undefined'})`);
        return {
          confidence: 0,
          isMatch: false,
        };
      }

      console.log(`🔍 FACE RECOGNITION: Starting ANN-based recognition with ${face.encoding.length}-dimensional encoding`);

      // Convert encoding to Float32Array for ANN search
      const queryEmbedding = new Float32Array(face.encoding);

      // Use ANN index to find similar faces (search top 5 candidates)
      const similarFaces = await faceIndexService.searchSimilarFaces(queryEmbedding, 5);

      if (similarFaces.length === 0) {
        console.log('❓ RECOGNITION: No similar faces found in ANN index');
        return {
          confidence: 0,
          isMatch: false,
        };
      }

      // Get the best match
      const bestMatch = similarFaces[0];

      if (bestMatch.isMatch) {
        console.log(`✅ RECOGNITION: ANN Match found! Person: ${bestMatch.personName}, similarity: ${(bestMatch.similarity * 100).toFixed(1)}% (PersonFace ID: ${bestMatch.personFaceId})`);

        // Log additional candidates for debugging
        if (similarFaces.length > 1) {
          const otherCandidates = similarFaces.slice(1, 3).map(c => `${c.personName}: ${(c.similarity * 100).toFixed(1)}%`).join(', ');
          console.log(`🔍 Other candidates: ${otherCandidates}`);
        }

        return {
          personId: bestMatch.personFaceId, // Return PersonFace ID for database consistency
          personName: bestMatch.personName,
          confidence: bestMatch.similarity,
          isMatch: true,
        };
      } else {
        const bestSimilarity = (bestMatch.similarity * 100).toFixed(1);
        console.log(`❓ RECOGNITION: Best match below threshold - ${bestMatch.personName}: ${bestSimilarity}% (threshold: ${(faceIndexService.getStats().similarityThreshold * 100).toFixed(0)}%)`);

        return {
          confidence: bestMatch.similarity,
          isMatch: false,
        };
      }
    } catch (error) {
      console.error('ANN-based face recognition failed:', error);
      return {
        confidence: 0,
        isMatch: false,
      };
    }
  }

  /**
   * Create an unknown person entry
   */
  private async createUnknownPerson(organizationId: number): Promise<number> {
    try {
      console.log(`🆕 Creating unknown person for organization ${organizationId}`);

      const unknownPerson = await this.personService.create({
        name: `Pessoa não cadastrada ${Date.now()}`,
        status: 'unidentified' as any,
        organizationId,
      });

      console.log(`✅ Created unknown person: ${unknownPerson.name} (ID: ${unknownPerson.id})`);
      return unknownPerson.id;
    } catch (error) {
      console.error('❌ Failed to create unknown person:', error);
      throw error;
    }
  }

  /**
   * Insert PersonFace for any person (unknown or known)
   */
  private async insertPersonFace(personId: number, face: DetectedFace, personName: string): Promise<number> {
    try {
      const encodingData = face.encoding || [];
      console.log(`🔍 Adding PersonFace for ${personName} (Person ID: ${personId}) with encoding length: ${encodingData.length}`);

      const personFace = await this.personService.addFace(personId, {
        biometricParameters: JSON.stringify(face.boundingBox ? { boundingBox: face.boundingBox } : {}),
        embedding: encodingData.length > 0 ? Buffer.from(new Float32Array(encodingData).buffer) : undefined,
        reliability: face.confidence,
        status: 'active' as any,
        notes: JSON.stringify({
          source: 'camera_detection',
          boundingBox: face.boundingBox,
          encodingLength: encodingData.length,
        }),
      } as any);

      console.log(`✅ Created PersonFace: ID ${personFace.id} for person ${personName}`);

      // Add the new face to the ANN index for future recognition
      if (encodingData.length > 0) {
        await faceIndexService.addFace(personFace);
        console.log(`📊 Added PersonFace to ANN index: ${personName} (PersonFace ID: ${personFace.id})`);
      }

      return personFace.id;
    } catch (error) {
      console.error(`❌ Failed to create PersonFace for ${personName}:`, error);
      throw error;
    }
  }

  /**
   * Save individual face crop from detection
   */
  private async saveFaceCrop(imageBuffer: Buffer, face: DetectedFace, index: number = 0): Promise<string> {
    try {
      const timestamp = Date.now();
      const filename = `face_${timestamp}_${index}.jpg`;
      const faceDir = path.join(process.cwd(), 'uploads', 'faces');

      // Ensure directory exists
      if (!fs.existsSync(faceDir)) {
        fs.mkdirSync(faceDir, { recursive: true });
      }

      const outputPath = path.join(faceDir, filename);

      // Load image
      const image = await loadImage(imageBuffer);

      // Extract bounding box with padding
      const padding = 0.15; // Add 15% padding around the face
      const { x, y, width, height } = face.boundingBox;

      // Calculate padded coordinates
      const paddedWidth = width * (1 + 2 * padding);
      const paddedHeight = height * (1 + 2 * padding);
      const paddedX = Math.max(0, x - width * padding);
      const paddedY = Math.max(0, y - height * padding);

      // Ensure we don't go beyond image boundaries
      const cropX = Math.max(0, Math.min(paddedX, image.width - paddedWidth));
      const cropY = Math.max(0, Math.min(paddedY, image.height - paddedHeight));
      const cropWidth = Math.min(paddedWidth, image.width - cropX);
      const cropHeight = Math.min(paddedHeight, image.height - cropY);

      // Create canvas for the face crop
      const canvas = createCanvas(cropWidth, cropHeight);
      const ctx = canvas.getContext('2d');

      // Draw the cropped face region
      ctx.drawImage(
        image,
        cropX, cropY, cropWidth, cropHeight,  // Source rectangle
        0, 0, cropWidth, cropHeight           // Destination rectangle
      );

      // Convert canvas to buffer and save
      const buffer = canvas.toBuffer('image/jpeg', { quality: 0.9 });
      fs.writeFileSync(outputPath, buffer);

      return `/uploads/faces/${filename}`;
    } catch (error) {
      console.error('Failed to save face crop:', error);
      return '';
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

    // Step 1: Non-Maximum Suppression to remove overlapping detections
    let filteredFaces = this.nonMaximumSuppression(faces, 0.3);

    // Step 2: Remove faces in UI overlay areas (timestamps, camera info, etc.)
    filteredFaces = this.removeUIOverlayFaces(filteredFaces);

    // Step 3: Remove faces that are too densely packed (likely false positives)
    filteredFaces = this.removeDenselyPackedFaces(filteredFaces);

    // Step 4: Keep only the highest confidence faces (top 20% or max 10 faces)
    filteredFaces = this.keepTopConfidenceFaces(filteredFaces, 10);

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
    if (face.confidence < 0.18) {
      console.log(`🚫 Face rejected: confidence too low (${face.confidence.toFixed(2)})`);
      return false;
    }

    // Stricter size validation for realistic face sizes
    if (width < 30 || height < 30) {
      console.log(`🚫 Face rejected: too small (${width}x${height})`);
      return false;
    }

    // if (width > 300 || height > 300) {
    //   console.log(`🚫 Face rejected: too large (${width}x${height})`);
    //   return false;
    // }

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
   * Compute similarity between two face encodings using cosine similarity
   */
  private computeFaceSimilarity(encoding1: number[], encoding2: number[]): number {
    try {
      // Ensure encodings have the same length
      if (encoding1.length !== encoding2.length) {
        console.warn(`Encoding length mismatch: ${encoding1.length} vs ${encoding2.length}`);
        return 0;
      }

      if (encoding1.length === 0 || encoding2.length === 0) {
        return 0;
      }

      // Compute cosine similarity
      let dotProduct = 0;
      let magnitude1 = 0;
      let magnitude2 = 0;

      for (let i = 0; i < encoding1.length; i++) {
        dotProduct += encoding1[i] * encoding2[i];
        magnitude1 += encoding1[i] * encoding1[i];
        magnitude2 += encoding2[i] * encoding2[i];
      }

      magnitude1 = Math.sqrt(magnitude1);
      magnitude2 = Math.sqrt(magnitude2);

      if (magnitude1 === 0 || magnitude2 === 0) {
        return 0;
      }

      // Cosine similarity ranges from -1 to 1
      // Convert to 0-1 range where 1 is perfect match
      const cosineSimilarity = dotProduct / (magnitude1 * magnitude2);
      const normalizedSimilarity = (cosineSimilarity + 1) / 2;

      return normalizedSimilarity;
    } catch (error) {
      console.error('Error computing face similarity:', error);
      return 0;
    }
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