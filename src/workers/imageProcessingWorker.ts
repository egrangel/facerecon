import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { createCanvas, loadImage } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';

interface ImageProcessingTask {
  type: 'cropFace' | 'saveDetectionImage';
  imageBuffer: Buffer;
  data: any;
  taskId: string;
}

interface ImageProcessingResult {
  taskId: string;
  success: boolean;
  result?: string;
  error?: string;
}

// Main thread - Worker pool management
class ImageProcessingWorkerPool {
  private workers: Worker[] = [];
  private taskQueue: ImageProcessingTask[] = [];
  private activeTasks = new Map<string, { resolve: Function; reject: Function }>();
  private readonly maxWorkers = 4; // Limit workers to prevent resource exhaustion
  private readonly maxQueueSize = 100; // Prevent memory issues
  private workerIndex = 0;

  constructor() {
    if (isMainThread) {
      this.initializeWorkers();
    }
  }

  private initializeWorkers(): void {
    for (let i = 0; i < this.maxWorkers; i++) {
      this.createWorker();
    }
  }

  private createWorker(): void {
    const worker = new Worker(__filename);

    worker.on('message', (result: ImageProcessingResult) => {
      const task = this.activeTasks.get(result.taskId);
      if (task) {
        this.activeTasks.delete(result.taskId);
        if (result.success) {
          task.resolve(result.result);
        } else {
          task.reject(new Error(result.error));
        }
      }
    });

    worker.on('error', (error) => {
      console.error('Image processing worker error:', error);
      // Restart worker
      this.restartWorker(worker);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Image processing worker exited with code ${code}`);
        this.restartWorker(worker);
      }
    });

    this.workers.push(worker);
  }

  private restartWorker(failedWorker: Worker): void {
    const index = this.workers.indexOf(failedWorker);
    if (index !== -1) {
      this.workers.splice(index, 1);
      this.createWorker();
    }
  }

  public async processImage(
    type: 'cropFace' | 'saveDetectionImage',
    imageBuffer: Buffer,
    data: any
  ): Promise<string> {
    if (!isMainThread) {
      throw new Error('Worker pool can only be used in main thread');
    }

    // Check queue size to prevent memory issues
    if (this.taskQueue.length >= this.maxQueueSize) {
      throw new Error('Image processing queue full, dropping request');
    }

    const taskId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const task: ImageProcessingTask = {
      type,
      imageBuffer,
      data,
      taskId
    };

    return new Promise((resolve, reject) => {
      this.activeTasks.set(taskId, { resolve, reject });

      // Use round-robin to distribute tasks
      const worker = this.workers[this.workerIndex];
      this.workerIndex = (this.workerIndex + 1) % this.workers.length;

      worker.postMessage(task);

      // Set timeout for worker tasks
      setTimeout(() => {
        if (this.activeTasks.has(taskId)) {
          this.activeTasks.delete(taskId);
          reject(new Error('Image processing timeout'));
        }
      }, 30000); // 30 second timeout
    });
  }

  public getStats() {
    return {
      totalWorkers: this.workers.length,
      activeTasks: this.activeTasks.size,
      queueLength: this.taskQueue.length,
      maxQueueSize: this.maxQueueSize,
    };
  }

  public async terminate(): Promise<void> {
    await Promise.all(this.workers.map(worker => worker.terminate()));
    this.workers = [];
    this.activeTasks.clear();
  }
}

// Export singleton - only create if in main thread
export const imageProcessingPool = isMainThread ? new ImageProcessingWorkerPool() : null as any;
export { ImageProcessingWorkerPool };

// Worker thread - Image processing
if (!isMainThread) {
  parentPort?.on('message', async (task: ImageProcessingTask) => {
    try {
      let result: string;

      switch (task.type) {
        case 'cropFace':
          result = await cropFaceInWorker(task.imageBuffer, task.data);
          break;
        case 'saveDetectionImage':
          result = await saveDetectionImageInWorker(task.imageBuffer, task.data);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      parentPort?.postMessage({
        taskId: task.taskId,
        success: true,
        result
      } as ImageProcessingResult);

    } catch (error) {
      parentPort?.postMessage({
        taskId: task.taskId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      } as ImageProcessingResult);
    }
  });

  async function cropFaceInWorker(imageBuffer: Buffer, data: any): Promise<string> {
    const { face, index } = data;
    const timestamp = Date.now();
    const filename = `face_${timestamp}_${index}.jpg`;
    const faceDir = path.join(process.cwd(), 'uploads', 'faces');

    // Ensure directory exists
    if (!fs.existsSync(faceDir)) {
      await fs.promises.mkdir(faceDir, { recursive: true });
    }

    const outputPath = path.join(faceDir, filename);

    // Load image
    const image = await loadImage(imageBuffer);

    // Extract bounding box with padding
    const padding = 0.15;
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
      cropX, cropY, cropWidth, cropHeight,
      0, 0, cropWidth, cropHeight
    );

    // Convert canvas to buffer and save
    const buffer = canvas.toBuffer('image/jpeg', { quality: 0.9 });
    await fs.promises.writeFile(outputPath, buffer);

    return `/uploads/faces/${filename}`;
  }

  async function saveDetectionImageInWorker(imageBuffer: Buffer, data: any): Promise<string> {
    const { faces } = data;
    const timestamp = Date.now();
    const filename = `detection_${timestamp}.jpg`;
    const detectionDir = path.join(process.cwd(), 'uploads', 'detections');

    // Ensure directory exists
    if (!fs.existsSync(detectionDir)) {
      await fs.promises.mkdir(detectionDir, { recursive: true });
    }

    const outputPath = path.join(detectionDir, filename);

    if (faces.length === 0) {
      // No faces detected, save original image
      await fs.promises.writeFile(outputPath, imageBuffer);
    } else {
      // Load image and draw bounding boxes
      const image = await loadImage(imageBuffer);
      const canvas = createCanvas(image.width, image.height);
      const ctx = canvas.getContext('2d');

      // Draw the original image
      ctx.drawImage(image, 0, 0);

      // Draw bounding boxes for each detected face
      faces.forEach((face: any, index: number) => {
        const { x, y, width, height } = face.boundingBox;

        // Draw bounding box
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);

        // Draw confidence label
        ctx.fillStyle = '#00ff00';
        ctx.font = '16px Arial';
        ctx.fillRect(x, y - 25, width, 25);
        ctx.fillStyle = '#000000';
        ctx.fillText(
          `Face ${index + 1}: ${(face.confidence * 100).toFixed(1)}%`,
          x + 5,
          y - 8
        );
      });

      // Convert canvas to buffer and save
      const buffer = canvas.toBuffer('image/jpeg', { quality: 0.8 });
      await fs.promises.writeFile(outputPath, buffer);
    }

    return `/uploads/detections/${filename}`;
  }
}