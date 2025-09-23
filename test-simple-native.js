const { nativeFaceDetectionService } = require('./dist/services/NativeFaceDetectionService');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

async function testSimpleNative() {
  const imagePath = process.argv[2] || 'D:\\Estudos\\facerecon\\temp\\frames\\event-1-camera-5-1758643697859_003.jpg';

  if (!fs.existsSync(imagePath)) {
    console.log(`Image not found: ${imagePath}`);
    console.log('Usage: node test-simple-native.js <image-path>');
    return;
  }

  try {
    console.log(`Testing: ${imagePath}`);
    const imageBuffer = fs.readFileSync(imagePath);

    // Initialize native detector
    const success = await nativeFaceDetectionService.initialize();

    if (!success) {
      console.log('Native detector initialization failed');
      return;
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