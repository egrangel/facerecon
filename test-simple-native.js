const { nativeFaceDetectionService } = require('./dist/services/NativeFaceDetectionService');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

async function testSimpleNative() {
  // Check if a specific image path is provided
  const providedPath = process.argv[2];

  if (providedPath) {
    // Test single image
    await testSingleImage(providedPath);
    return;
  }

  // Test all images in /temp/test folder
  const testDir = path.join(process.cwd(), 'temp', 'test');

  if (!fs.existsSync(testDir)) {
    console.log(`Test directory not found: ${testDir}`);
    console.log('Usage: node test-simple-native.js [image-path]');
    console.log('Or create temp/test/ directory and place test images there');
    return;
  }

  // Get all image files
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.bmp'];
  const files = fs.readdirSync(testDir).filter(file =>
    imageExtensions.some(ext => file.toLowerCase().endsWith(ext))
  );

  if (files.length === 0) {
    console.log(`No image files found in ${testDir}`);
    return;
  }

  console.log(`Found ${files.length} images in test directory`);
  console.log('='.repeat(50));

  // Initialize native detector once
  const success = await nativeFaceDetectionService.initialize();
  if (!success) {
    console.log('Native detector initialization failed');
    return;
  }

  // Test each image
  for (const file of files) {
    const imagePath = path.join(testDir, file);
    await testSingleImage(imagePath, false); // false = don't re-initialize
    console.log('-'.repeat(30));
  }
}

async function testSingleImage(imagePath, shouldInitialize = true) {
  if (!fs.existsSync(imagePath)) {
    console.log(`Image not found: ${imagePath}`);
    return;
  }

  try {
    console.log(`Testing: ${path.basename(imagePath)}`);
    const imageBuffer = fs.readFileSync(imagePath);

    // Initialize native detector if needed
    if (shouldInitialize) {
      const success = await nativeFaceDetectionService.initialize();
      if (!success) {
        console.log('Native detector initialization failed');
        return;
      }
    }

    // Set optimized confidence threshold for crowd detection
    nativeFaceDetectionService.setConfidenceThreshold(0.12);

    // Test detection
    const startTime = Date.now();
    const result = await nativeFaceDetectionService.detectFacesAsync(imageBuffer);
    const endTime = Date.now();

    console.log(`Detected ${result.faces.length} faces in ${endTime - startTime}ms`);

    if (result.faces.length > 0) {
      // Save output image with bounding boxes
      await saveImageWithBoundingBoxes(imagePath, result.faces);
    } else {
      console.log('No faces detected');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function saveImageWithBoundingBoxes(imagePath, faces) {
  try {
    // Load the original image
    const image = await loadImage(imagePath);

    // Create canvas with same dimensions
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');

    // Draw the original image
    ctx.drawImage(image, 0, 0);

    // Draw bounding boxes for each face
    faces.forEach((face, i) => {
      const { x, y, width, height } = face.boundingBox;
      const confidence = face.confidence;

      // Set bounding box style
      ctx.strokeStyle = '#00FF00'; // Green color
      ctx.lineWidth = 3;
      ctx.font = '16px Arial';
      ctx.fillStyle = '#00FF00';

      // Draw rectangle
      ctx.strokeRect(x, y, width, height);

      // Draw confidence label
      const label = `${(confidence * 100).toFixed(1)}%`;
      const labelY = y > 20 ? y - 5 : y + height + 20;
      ctx.fillText(label, x, labelY);
    });

    // Save the output image
    const inputFileName = path.basename(imagePath, path.extname(imagePath));
    const outputPath = `temp/${inputFileName}_detections.jpg`;

    // Ensure temp directory exists
    if (!fs.existsSync('temp')) {
      fs.mkdirSync('temp', { recursive: true });
    }

    // Save as JPEG
    const buffer = canvas.toBuffer('image/jpeg', { quality: 0.8 });
    fs.writeFileSync(outputPath, buffer);

    console.log(`Output saved: ${outputPath}`);

  } catch (error) {
    console.error('Error saving output image:', error.message);
  }
}

testSimpleNative();