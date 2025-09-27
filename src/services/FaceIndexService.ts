import { HierarchicalNSW } from 'hnswlib-node';
import { PersonFaceRepository } from '../repositories';
import { PersonFace } from '../entities';

interface IndexedFace {
  id: number;
  personId: number;
  personName: string;
  embedding: Float32Array;
  reliability: number;
}

export class FaceIndexService {
  private index: HierarchicalNSW | null = null;
  private indexedFaces: Map<number, IndexedFace> = new Map();
  private personFaceRepository: PersonFaceRepository;
  private isInitialized = false;
  private EMBEDDING_DIMENSION = 512; // Face embedding dimension (FaceNet/ArcFace)
  private SIMILARITY_THRESHOLD = 0.75; // Higher threshold to prevent false positives

  constructor() {
    this.personFaceRepository = new PersonFaceRepository();
  }

  /**
   * Initialize the ANN index by loading all person faces from database
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔍 Initializing Face Recognition ANN Index...');

      // Load all person faces with their person information
      const personFaces = await this.personFaceRepository.getRepository()
        .createQueryBuilder('personFace')
        .leftJoinAndSelect('personFace.person', 'person')
        .where('person.status = :status', { status: 'active' })
        .andWhere('personFace.embedding IS NOT NULL')
        .getMany();

      console.log(`📊 Found ${personFaces.length} active person faces with embeddings`);

      if (personFaces.length === 0) {
        console.log('⚠️ No person faces with embeddings found - index will be empty');
        this.isInitialized = true;
        return;
      }

      // Determine embedding dimension from the first valid embedding
      let embeddingDim = this.EMBEDDING_DIMENSION;
      for (const face of personFaces) {
        if (face.embedding && face.embedding.length > 0) {
          // Convert buffer to Float32Array to get dimension
          const floatArray = new Float32Array(face.embedding.buffer);
          embeddingDim = floatArray.length;
          console.log(`📏 Detected embedding dimension: ${embeddingDim}`);

          // Update the instance dimension to match data
          if (embeddingDim !== this.EMBEDDING_DIMENSION) {
            console.log(`🔧 Updating EMBEDDING_DIMENSION from ${this.EMBEDDING_DIMENSION} to ${embeddingDim}`);
            this.EMBEDDING_DIMENSION = embeddingDim;
          }
          break;
        }
      }

      // Initialize HNSW index with correct parameters
      // HierarchicalNSW(space, dimension)
      this.index = new HierarchicalNSW('cosine', embeddingDim);
      const initialCapacity = Math.max(personFaces.length * 2, 100); // Reasonable initial capacity
      // initIndex(capacity, M = 16, efConstruction = 200, randomSeed = 100)
      this.index.initIndex(initialCapacity, 16, 200);
      console.log(`📊 Initialized HNSW index with capacity: ${initialCapacity}`);

      let validFaceCount = 0;

      // Add faces to index
      for (const face of personFaces) {
        try {
          if (!face.embedding || face.embedding.length === 0) {
            console.warn(`⚠️ PersonFace ${face.id} has no embedding data - skipping`);
            continue;
          }

          // Convert Buffer to Float32Array
          const embedding = new Float32Array(face.embedding.buffer);

          if (embedding.length !== embeddingDim) {
            console.warn(`⚠️ PersonFace ${face.id} has wrong embedding dimension (${embedding.length} vs ${embeddingDim}) - skipping`);
            continue;
          }

          // Store indexed face data
          const indexedFace: IndexedFace = {
            id: face.id,
            personId: face.personId,
            personName: face.person?.name || 'Unknown',
            embedding: embedding,
            reliability: face.reliability || 0.5,
          };

          // Add to HNSW index - convert Float32Array to number[]
          this.index.addPoint(Array.from(embedding), face.id);
          this.indexedFaces.set(face.id, indexedFace);

          validFaceCount++;
        } catch (error) {
          console.error(`❌ Error processing PersonFace ${face.id}:`, error);
        }
      }

      console.log(`✅ Successfully indexed ${validFaceCount} faces in ANN index`);
      console.log(`🎯 Using similarity threshold: ${this.SIMILARITY_THRESHOLD}`);

      this.isInitialized = true;
    } catch (error) {
      console.error('❌ Error initializing Face Recognition ANN Index:', error);
      throw error;
    }
  }

  /**
   * Search for similar faces in the index
   */
  async searchSimilarFaces(queryEmbedding: Float32Array, k: number = 5) {
  if (!this.isInitialized || !this.index || this.indexedFaces.size === 0) {
    console.warn('⚠️ Face index not initialized or empty');
    return [];
  }

  try {
    // Validate embedding dimension
    if (queryEmbedding.length !== this.EMBEDDING_DIMENSION) {
      console.error(`❌ Query embedding dimension mismatch: expected ${this.EMBEDDING_DIMENSION}, got ${queryEmbedding.length}`);
      console.warn('🔄 Rebuilding index due to dimension mismatch...');
      await this.rebuild();

      // Try search again after rebuild
      if (!this.index || this.indexedFaces.size === 0) {
        console.warn('⚠️ Index still empty after rebuild');
        return [];
      }
    }

    // Search top-k with error handling for dimension mismatch
    const results = this.index.searchKnn(Array.from(queryEmbedding), Math.min(k, this.indexedFaces.size));

    const matches = [];
    for (let i = 0; i < results.neighbors.length; i++) {
      const faceId = results.neighbors[i];
      const distance = results.distances[i];

      const indexedFace = this.indexedFaces.get(faceId);
      if (!indexedFace) continue;

      // Improved similarity calculation for ArcFace/FaceNet
      // For normalized embeddings (ArcFace), cosine distance ∈ [0,2]
      // Convert to similarity: similarity = 1 - (distance / 2)
      // For ArcFace: values closer to 1.0 indicate higher similarity
      const similarity = Math.max(0, Math.min(1, 1 - distance / 2));

      // Dynamic threshold based on embedding quality
      const isMatch = similarity >= this.SIMILARITY_THRESHOLD;

      matches.push({
        personFaceId: indexedFace.id,
        personId: indexedFace.personId,
        personName: indexedFace.personName,
        similarity,
        reliability: indexedFace.reliability,
        isMatch,
      });
    }

    // Sort by similarity
    matches.sort((a, b) => b.similarity - a.similarity);

    if (matches.length > 0) {
      const best = matches[0];
      const modelType = best.similarity >= 0.9 ? 'ArcFace-like' : 'FaceNet-like';
      console.log(`🔍 Found ${matches.length} candidates. Best: ${best.personName} ${(best.similarity * 100).toFixed(1)}% ${best.isMatch ? '✅' : '❌'} (${modelType})`);
      console.log(`🎯 Current threshold: ${(this.SIMILARITY_THRESHOLD * 100).toFixed(1)}%`);

      // Debug info for all matches to see the similarity distribution
      matches.forEach((match, idx) => {
        const status = match.isMatch ? '✅' : '❌';
        console.log(`   ${idx + 1}. ${match.personName}: ${(match.similarity * 100).toFixed(1)}% ${status}`);
      });

      // Show if we're close to threshold
      if (!best.isMatch && best.similarity >= 0.5) {
        console.log(`💡 Best match is ${(best.similarity * 100).toFixed(1)}% - consider lowering threshold if this should match`);
      }
    } else {
      console.log(`🔍 No candidates found in index`);
    }

    return matches;
  } catch (error: any) {
    // Handle dimension mismatch errors by rebuilding the index
    if (error.message && error.message.includes('Invalid the given array length')) {
      console.error('❌ HNSW index has wrong dimensions - forcing rebuild...');
      console.log(`🔧 Expected: ${this.EMBEDDING_DIMENSION}, Index was created with wrong dimensions`);

      try {
        await this.rebuild();
        console.log('✅ Index rebuilt successfully, retrying search...');

        // Retry search after rebuild
        if (this.index && this.indexedFaces.size > 0) {
          const retryResults = this.index.searchKnn(Array.from(queryEmbedding), Math.min(k, this.indexedFaces.size));
          const retryMatches = [];

          for (let i = 0; i < retryResults.neighbors.length; i++) {
            const faceId = retryResults.neighbors[i];
            const distance = retryResults.distances[i];
            const indexedFace = this.indexedFaces.get(faceId);
            if (!indexedFace) continue;

            const similarity = Math.max(0, Math.min(1, 1 - distance / 2));
            const isMatch = similarity >= this.SIMILARITY_THRESHOLD;

            retryMatches.push({
              personFaceId: indexedFace.id,
              personId: indexedFace.personId,
              personName: indexedFace.personName,
              similarity,
              reliability: indexedFace.reliability,
              isMatch,
            });
          }

          retryMatches.sort((a, b) => b.similarity - a.similarity);
          return retryMatches;
        }
      } catch (rebuildError) {
        console.error('❌ Failed to rebuild index:', rebuildError);
      }
    }

    console.error('❌ Error searching similar faces:', error);
    return [];
  }
}


  /**
   * Add a new face to the index
   */
  async addFace(personFace: PersonFace): Promise<boolean> {
    if (!this.isInitialized || !this.index) {
      console.warn('⚠️ Cannot add face - index not initialized');
      return false;
    }

    try {
      if (!personFace.embedding || personFace.embedding.length === 0) {
        console.warn(`⚠️ Cannot add PersonFace ${personFace.id} - no embedding data`);
        return false;
      }

      // Convert Buffer to Float32Array
      const embedding = new Float32Array(personFace.embedding.buffer);

      // Load person information
      const personFaceWithPerson = await this.personFaceRepository.getRepository()
        .findOne({
          where: { id: personFace.id },
          relations: ['person']
        });

      if (!personFaceWithPerson) {
        console.warn(`⚠️ Cannot find PersonFace ${personFace.id} with person relation`);
        return false;
      }

      const indexedFace: IndexedFace = {
        id: personFace.id,
        personId: personFace.personId,
        personName: personFaceWithPerson.person?.name || 'Unknown',
        embedding: embedding,
        reliability: personFace.reliability || 0.5,
      };

      // Add to HNSW index - convert Float32Array to number[]
      try {
        this.index.addPoint(Array.from(embedding), personFace.id);
        this.indexedFaces.set(personFace.id, indexedFace);

        console.log(`✅ Added PersonFace ${personFace.id} (${indexedFace.personName}) to ANN index`);
        return true;
      } catch (indexError: any) {
        // If we hit capacity limit, rebuild the index with more capacity
        if (indexError.message && indexError.message.includes('exceeds the specified limit')) {
          console.warn(`⚠️ HNSW index capacity exceeded. Rebuilding with larger capacity...`);
          await this.rebuild();

          // Try adding the face again after rebuild
          try {
            this.index!.addPoint(Array.from(embedding), personFace.id);
            this.indexedFaces.set(personFace.id, indexedFace);
            console.log(`✅ Added PersonFace ${personFace.id} (${indexedFace.personName}) to rebuilt ANN index`);
            return true;
          } catch (retryError) {
            console.error(`❌ Failed to add face ${personFace.id} even after rebuild:`, retryError);
            return false;
          }
        } else {
          throw indexError; // Re-throw other errors
        }
      }
    } catch (error) {
      console.error(`❌ Error adding face ${personFace.id} to index:`, error);
      return false;
    }
  }

  /**
   * Remove a face from the index
   */
  removeFace(personFaceId: number): boolean {
    if (!this.isInitialized || !this.index) {
      return false;
    }

    try {
      // Note: hnswlib-node doesn't support removing points,
      // so we just remove from our cache
      const removed = this.indexedFaces.delete(personFaceId);

      if (removed) {
        console.log(`🗑️ Removed PersonFace ${personFaceId} from index cache`);
      }

      return removed;
    } catch (error) {
      console.error(`❌ Error removing face ${personFaceId} from index:`, error);
      return false;
    }
  }

  /**
   * Get index statistics
   */
  getStats(): {
    isInitialized: boolean;
    totalFaces: number;
    embeddingDimension: number;
    similarityThreshold: number;
    modelOptimized: string;
  } {
    return {
      isInitialized: this.isInitialized,
      totalFaces: this.indexedFaces.size,
      embeddingDimension: this.EMBEDDING_DIMENSION,
      similarityThreshold: this.SIMILARITY_THRESHOLD,
      modelOptimized: this.SIMILARITY_THRESHOLD <= 0.75 ? 'ArcFace' : 'FaceNet',
    };
  }

  /**
   * Auto-configure for model type
   */
  configureForModel(modelType: 'arcface' | 'facenet') {
    if (modelType === 'arcface') {
      this.SIMILARITY_THRESHOLD = 0.75; // More conservative threshold to prevent false positives
      console.log('🎯 Configured for ArcFace model (threshold: 0.75)');
    } else {
      this.SIMILARITY_THRESHOLD = 0.85; // FaceNet needs higher threshold
      console.log('🎯 Configured for FaceNet model (threshold: 0.85)');
    }
  }

  /**
   * Update similarity threshold for recognition
   */
  updateSimilarityThreshold(newThreshold: number): void {
    if (newThreshold < 0 || newThreshold > 1) {
      throw new Error('Similarity threshold must be between 0 and 1');
    }

    const oldThreshold = this.SIMILARITY_THRESHOLD;
    this.SIMILARITY_THRESHOLD = newThreshold;
    console.log(`🎯 Updated similarity threshold: ${oldThreshold} → ${newThreshold} (${(newThreshold * 100).toFixed(1)}%)`);
  }

  /**
   * Rebuild the index (useful after bulk operations)
   */
  async rebuild(): Promise<void> {
    console.log('🔄 Rebuilding Face Recognition ANN Index...');
    this.isInitialized = false;
    this.index = null;
    this.indexedFaces.clear();
    await this.initialize();
  }
}

// Export singleton instance
export const faceIndexService = new FaceIndexService();