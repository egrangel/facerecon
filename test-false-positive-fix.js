const { nativeFaceDetectionService } = require('./dist/services/NativeFaceDetectionService');
const fs = require('fs');

async function testFalsePositiveFiltering() {
  console.log('🔍 Testing false positive filtering...');

  try {
    // Initialize the native detector
    const success = await nativeFaceDetectionService.initialize();
    if (!success) {
      console.log('❌ Native detector initialization failed');
      return;
    }

    console.log('✅ Native detector initialized with stricter validation');

    // Create a test image buffer (solid color - should not detect faces)
    const testImageSize = 640 * 480 * 3; // RGB image
    const solidColorBuffer = Buffer.alloc(testImageSize);

    // Fill with gray color (typical background that might trigger false positives)
    for (let i = 0; i < testImageSize; i += 3) {
      solidColorBuffer[i] = 128;     // Blue
      solidColorBuffer[i + 1] = 128; // Green
      solidColorBuffer[i + 2] = 128; // Red
    }

    console.log('📸 Testing with solid gray image (should detect 0 faces)...');

    const result = await nativeFaceDetectionService.detectFacesAsync(solidColorBuffer);

    console.log(`🎯 Detection result: ${result.faces.length} faces detected`);
    console.log(`⏱️  Processing time: ${result.processingTimeMs}ms`);

    if (result.faces.length === 0) {
      console.log('✅ SUCCESS: No false positives detected on solid color image');
    } else {
      console.log('⚠️  WARNING: Still detecting false positives:');
      result.faces.forEach((face, index) => {
        console.log(`  Face ${index + 1}: ${face.boundingBox.width}x${face.boundingBox.height}, confidence: ${face.confidence}`);
      });
    }

    // Get performance stats
    const stats = nativeFaceDetectionService.getPerformanceStats();
    console.log('📊 Performance stats:', stats);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFalsePositiveFiltering();