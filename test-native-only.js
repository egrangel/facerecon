const { nativeFaceDetectionService } = require('./dist/services/NativeFaceDetectionService');
const fs = require('fs');
const path = require('path');

console.log('🚀 Testing native face detection with real image...');
console.log('⏱️  This should not freeze the application');

async function testNativeInit() {
  try {
    console.log('📡 Starting async initialization...');

    const startTime = Date.now();
    const success = await nativeFaceDetectionService.initialize();
    const endTime = Date.now();

    console.log(`⚡ Initialization completed in ${endTime - startTime}ms`);

    if (success) {
      console.log('✅ Native C++ detector ready!');

      // Test with a real image file
      const imagePath = process.argv[2];
      if (imagePath && fs.existsSync(imagePath)) {
        console.log(`📸 Testing face detection on: ${imagePath}`);

        const imageBuffer = fs.readFileSync(imagePath);
        const detectionStart = Date.now();
        const result = await nativeFaceDetectionService.detectFacesAsync(imageBuffer);
        const detectionTime = Date.now() - detectionStart;

        console.log(`🎯 Detection completed in ${detectionTime}ms`);
        console.log(`👥 Found ${result.faces.length} faces:`);

        result.faces.forEach((face, index) => {
          const { x, y, width, height } = face.boundingBox;
          console.log(`  Face ${index + 1}: ${width}x${height} at (${Math.round(x)},${Math.round(y)}) - confidence: ${(face.confidence * 100).toFixed(1)}%`);
        });

      } else {
        console.log('ℹ️  No image provided. Usage: node test-native-only.js <image-path>');
      }

      console.log('📊 Performance stats:', nativeFaceDetectionService.getPerformanceStats());
    } else {
      console.log('❌ Native initialization failed (falling back to TensorFlow.js)');
    }

  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

// Test that the event loop is not blocked
const intervalId = setInterval(() => {
  console.log('🔄 Event loop is responsive...');
}, 1000);

testNativeInit().then(() => {
  clearInterval(intervalId);
  console.log('🎯 Test completed!');
}).catch(error => {
  clearInterval(intervalId);
  console.error('❌ Test failed:', error);
});