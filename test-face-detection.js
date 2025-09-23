const { faceRecognitionService } = require('./dist/services/FaceRecognitionService');
const fs = require('fs');
const path = require('path');

async function testFaceDetection() {
  try {
    console.log('🚀 Testing improved face detection...');

    // Initialize the service
    await faceRecognitionService.initialize();
    console.log('✅ Service initialized');

    // Test with a sample image (you would replace this with your actual image)
    const testImagePath = process.argv[2];
    if (!testImagePath || !fs.existsSync(testImagePath)) {
      console.log('❌ Please provide a valid image path as argument');
      console.log('Usage: node test-face-detection.js <image-path>');
      return;
    }

    const imageBuffer = fs.readFileSync(testImagePath);
    console.log(`📸 Processing image: ${testImagePath}`);

    const result = await faceRecognitionService.detectFaces(imageBuffer);
    console.log(`🎯 Detected ${result.faces.length} faces:`);

    result.faces.forEach((face, index) => {
      const { x, y, width, height } = face.boundingBox;
      console.log(`  Face ${index + 1}: confidence=${(face.confidence * 100).toFixed(1)}%, box=(${Math.round(x)},${Math.round(y)},${Math.round(width)}x${Math.round(height)})`);
    });

    console.log('✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFaceDetection();