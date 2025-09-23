const { nativeFaceDetectionService } = require('./dist/services/NativeFaceDetectionService');
const { faceRecognitionService } = require('./dist/services/FaceRecognitionService');
const fs = require('fs');

async function debugFaceDetection() {
  console.log('🔍 Debug: Testing face detection on camera frame...');

  const imagePath = process.argv[2] || 'D:\\Estudos\\facerecon\\temp\\frames\\event-1-camera-5-1758643697859_003.jpg';

  if (!fs.existsSync(imagePath)) {
    console.log(`❌ Image not found: ${imagePath}`);
    return;
  }

  const imageBuffer = fs.readFileSync(imagePath);
  console.log(`📸 Testing image: ${imagePath}`);
  console.log(`📊 Image size: ${imageBuffer.length} bytes`);

  try {
    // Test 1: Native C++ detector
    console.log('\n🚀 Testing Native C++ Detector...');
    const nativeSuccess = await nativeFaceDetectionService.initialize();

    if (nativeSuccess) {
      const nativeResult = await nativeFaceDetectionService.detectFacesAsync(imageBuffer);
      console.log(`✅ Native: ${nativeResult.faces.length} faces detected in ${nativeResult.processingTimeMs}ms`);

      nativeResult.faces.forEach((face, i) => {
        console.log(`  Face ${i+1}: ${face.boundingBox.width}x${face.boundingBox.height} @ (${face.boundingBox.x},${face.boundingBox.y}) conf:${face.confidence.toFixed(3)}`);
      });
    } else {
      console.log('❌ Native detector failed to initialize');
    }

    // Test 2: TensorFlow.js detector for comparison
    console.log('\n🧠 Testing TensorFlow.js Detector...');
    await faceRecognitionService.initialize();

    const tfResult = await faceRecognitionService.detectFaces(imageBuffer);
    console.log(`✅ TensorFlow: ${tfResult.faces.length} faces detected`);

    tfResult.faces.forEach((face, i) => {
      console.log(`  Face ${i+1}: ${face.boundingBox.width}x${face.boundingBox.height} @ (${face.boundingBox.x},${face.boundingBox.y}) conf:${face.confidence.toFixed(3)}`);
    });

  } catch (error) {
    console.error('💥 Error during testing:', error.message);
  }
}

debugFaceDetection();