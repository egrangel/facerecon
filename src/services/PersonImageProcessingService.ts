import * as fs from 'fs';
import * as path from 'path';
import { PersonImageService, PersonService } from './index';
import { PersonFaceRepository } from '../repositories';
import { PersonImage, PersonFace } from '../entities';
import { nativeFaceDetectionService } from './NativeFaceDetectionService';
import { faceIndexService } from './FaceIndexService';

export interface ImageProcessingResult {
  success: boolean;
  personImageId: number;
  facesDetected: number;
  personFacesCreated: PersonFace[];
  error?: string;
  processingTimeMs: number;
}

export class PersonImageProcessingService {
  private personImageService: PersonImageService;
  private personService: PersonService;
  private personFaceRepository: PersonFaceRepository;

  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB max file size
  private readonly supportedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  private readonly faceConfidenceThreshold = 0.7; // Minimum confidence for face detection
  private readonly maxFacesPerImage = 10; // Maximum faces to process per image

  constructor() {
    this.personImageService = new PersonImageService();
    this.personService = new PersonService();
    this.personFaceRepository = new PersonFaceRepository();
  }

  /**
   * Process a single PersonImage for face detection
   */
  async processPersonImage(personImageId: number): Promise<ImageProcessingResult> {
    const startTime = Date.now();

    try {
      console.log(`🔍 Starting face detection processing for PersonImage ${personImageId}`);

      // Update status to processing
      await this.personImageService.updateProcessingStatus(personImageId, 'processing');

      // Load the PersonImage
      const personImage = await this.personImageService.findById(personImageId);

      // Validate the image
      const validationResult = this.validatePersonImage(personImage);
      if (!validationResult.isValid) {
        await this.personImageService.updateProcessingStatus(
          personImageId,
          'failed',
          validationResult.error
        );
        return {
          success: false,
          personImageId,
          facesDetected: 0,
          personFacesCreated: [],
          error: validationResult.error,
          processingTimeMs: Date.now() - startTime,
        };
      }

      // Check if file exists
      if (!fs.existsSync(personImage.filePath)) {
        const error = `Image file not found: ${personImage.filePath}`;
        await this.personImageService.updateProcessingStatus(personImageId, 'failed', error);
        return {
          success: false,
          personImageId,
          facesDetected: 0,
          personFacesCreated: [],
          error,
          processingTimeMs: Date.now() - startTime,
        };
      }

      // Read the image file
      const imageBuffer = fs.readFileSync(personImage.filePath);

      // Detect faces using the native face detection service
      let detectionResult;
      try {
        detectionResult = await nativeFaceDetectionService.detectFaces(imageBuffer);
      } catch (detectionError: any) {
        const error = detectionError.message || 'Face detection failed';
        await this.personImageService.updateProcessingStatus(personImageId, 'failed', error);
        return {
          success: false,
          personImageId,
          facesDetected: 0,
          personFacesCreated: [],
          error,
          processingTimeMs: Date.now() - startTime,
        };
      }

      // Filter faces by confidence threshold
      const validFaces = detectionResult.faces.filter(
        face => face.confidence >= this.faceConfidenceThreshold
      ).slice(0, this.maxFacesPerImage); // Limit number of faces

      console.log(`📊 Detected ${detectionResult.faces.length} faces, ${validFaces.length} above confidence threshold`);

      // Create PersonFace entities for each detected face
      const personFacesCreated: PersonFace[] = [];

      for (let i = 0; i < validFaces.length; i++) {
        const face = validFaces[i];

        try {
          // Check if face has encoding
          if (!face.encoding || face.encoding.length === 0) {
            console.warn(`⚠️ Face ${i} has no encoding data - skipping`);
            continue;
          }

          // Convert face encoding to buffer
          const embeddingBuffer = Buffer.from(new Float32Array(face.encoding).buffer);

          // Create biometric parameters JSON
          const biometricParameters = JSON.stringify({
            boundingBox: face.boundingBox,
            confidence: face.confidence,
            detectionSource: 'person_image',
            sourceImageId: personImageId,
            faceIndex: i,
          });

          // Create PersonFace entity
          const personFaceData = {
            personId: personImage.personId,
            embedding: embeddingBuffer,
            reliability: face.confidence,
            biometricParameters,
            status: 'active',
            notes: `Extracted from PersonImage ${personImageId} (face ${i + 1}/${validFaces.length})`,
          };

          const personFace = await this.personFaceRepository.create(personFaceData);
          personFacesCreated.push(personFace);

          // Add to face index for recognition
          try {
            const addedToIndex = await faceIndexService.addFace(personFace);
            if (addedToIndex) {
              console.log(`✅ Added PersonFace ${personFace.id} to ANN index`);
            } else {
              console.warn(`⚠️ Failed to add PersonFace ${personFace.id} to ANN index`);
            }
          } catch (indexError) {
            console.error(`❌ Error adding PersonFace ${personFace.id} to index:`, indexError);
          }

        } catch (faceError) {
          console.error(`❌ Error creating PersonFace for face ${i}:`, faceError);
        }
      }

      // Update PersonImage processing status to completed
      await this.personImageService.updateProcessingStatus(personImageId, 'completed');

      const processingTimeMs = Date.now() - startTime;
      console.log(`✅ Completed processing PersonImage ${personImageId}: ${personFacesCreated.length} faces created in ${processingTimeMs}ms`);

      return {
        success: true,
        personImageId,
        facesDetected: validFaces.length,
        personFacesCreated,
        processingTimeMs,
      };

    } catch (error: any) {
      console.error(`❌ Error processing PersonImage ${personImageId}:`, error);

      try {
        await this.personImageService.updateProcessingStatus(
          personImageId,
          'failed',
          error.message || 'Unknown processing error'
        );
      } catch (updateError) {
        console.error(`❌ Error updating processing status:`, updateError);
      }

      return {
        success: false,
        personImageId,
        facesDetected: 0,
        personFacesCreated: [],
        error: error.message || 'Unknown processing error',
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Process all pending PersonImages
   */
  async processPendingImages(): Promise<ImageProcessingResult[]> {
    console.log('🔄 Starting batch processing of pending PersonImages');

    const pendingImages = await this.personImageService.findPendingForProcessing();
    console.log(`📝 Found ${pendingImages.length} pending PersonImages to process`);

    if (pendingImages.length === 0) {
      return [];
    }

    const results: ImageProcessingResult[] = [];

    // Process images sequentially to avoid overwhelming the system
    for (const personImage of pendingImages) {
      try {
        const result = await this.processPersonImage(personImage.id);
        results.push(result);

        // Add a small delay between processing to prevent resource exhaustion
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Error processing PersonImage ${personImage.id}:`, error);
        results.push({
          success: false,
          personImageId: personImage.id,
          facesDetected: 0,
          personFacesCreated: [],
          error: error instanceof Error ? error.message : 'Unknown error',
          processingTimeMs: 0,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalFaces = results.reduce((sum, r) => sum + r.facesDetected, 0);

    console.log(`✅ Batch processing completed: ${successCount}/${results.length} images processed successfully, ${totalFaces} total faces detected`);

    return results;
  }

  /**
   * Validate PersonImage before processing
   */
  private validatePersonImage(personImage: PersonImage): { isValid: boolean; error?: string } {
    // Check if image should be processed
    if (!personImage.shouldProcess) {
      return { isValid: false, error: 'Image is marked as should not process' };
    }

    // Check processing status
    if (personImage.processingStatus === 'completed') {
      return { isValid: false, error: 'Image has already been processed' };
    }

    if (personImage.processingStatus === 'processing') {
      return { isValid: false, error: 'Image is currently being processed' };
    }

    // Check file size
    if (personImage.fileSize > this.maxFileSize) {
      return { isValid: false, error: `File size ${personImage.fileSize} exceeds maximum ${this.maxFileSize}` };
    }

    // Check MIME type
    if (!this.supportedMimeTypes.includes(personImage.mimeType)) {
      return { isValid: false, error: `Unsupported MIME type: ${personImage.mimeType}` };
    }

    // Check if file path exists
    if (!personImage.filePath || personImage.filePath.trim() === '') {
      return { isValid: false, error: 'File path is empty' };
    }

    return { isValid: true };
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(): Promise<{
    totalImages: number;
    pendingImages: number;
    processingImages: number;
    completedImages: number;
    failedImages: number;
  }> {
    const [pending, processing, completed, failed] = await Promise.all([
      this.personImageService.findByProcessingStatus('pending'),
      this.personImageService.findByProcessingStatus('processing'),
      this.personImageService.findByProcessingStatus('completed'),
      this.personImageService.findByProcessingStatus('failed'),
    ]);

    return {
      totalImages: pending.length + processing.length + completed.length + failed.length,
      pendingImages: pending.length,
      processingImages: processing.length,
      completedImages: completed.length,
      failedImages: failed.length,
    };
  }

  /**
   * Re-process failed images
   */
  async reprocessFailedImages(): Promise<ImageProcessingResult[]> {
    console.log('🔄 Starting reprocessing of failed PersonImages');

    const failedImages = await this.personImageService.findByProcessingStatus('failed');
    console.log(`📝 Found ${failedImages.length} failed PersonImages to reprocess`);

    if (failedImages.length === 0) {
      return [];
    }

    const results: ImageProcessingResult[] = [];

    // Reset status to pending and reprocess
    for (const personImage of failedImages) {
      try {
        await this.personImageService.updateProcessingStatus(personImage.id, 'pending');
        const result = await this.processPersonImage(personImage.id);
        results.push(result);

        // Add a small delay between processing
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Error reprocessing PersonImage ${personImage.id}:`, error);
        results.push({
          success: false,
          personImageId: personImage.id,
          facesDetected: 0,
          personFacesCreated: [],
          error: error instanceof Error ? error.message : 'Unknown error',
          processingTimeMs: 0,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`✅ Reprocessing completed: ${successCount}/${results.length} images processed successfully`);

    return results;
  }
}

// Export singleton instance
export const personImageProcessingService = new PersonImageProcessingService();