const { nativeFaceDetectionService } = require('./dist/services/NativeFaceDetectionService');
const fs = require('fs');
const path = require('path');

async function testConcurrentDetection() {
  console.log('Testing concurrent face detection...');

  // Get test images
  const testDir = path.join(process.cwd(), 'temp', 'test');
  const imageFiles = fs.readdirSync(testDir).filter(file =>
    file.toLowerCase().endsWith('.jpg') || file.toLowerCase().endsWith('.png')
  );

  if (imageFiles.length < 2) {
    console.log('Need at least 2 test images for concurrent testing');
    return;
  }

  // Initialize detector once
  console.log('Initializing native detector...');
  const success = await nativeFaceDetectionService.initialize();
  if (!success) {
    console.log('Failed to initialize detector');
    return;
  }

  // Test sequential processing first
  console.log('\n=== SEQUENTIAL PROCESSING ===');
  const sequentialStart = Date.now();
  for (let i = 0; i < Math.min(3, imageFiles.length); i++) {
    const imagePath = path.join(testDir, imageFiles[i]);
    const imageBuffer = fs.readFileSync(imagePath);

    const startTime = Date.now();
    const result = await nativeFaceDetectionService.detectFacesAsync(imageBuffer);
    const endTime = Date.now();

    console.log(`${imageFiles[i]}: ${result.faces.length} faces, ${endTime - startTime}ms`);
  }
  const sequentialTotal = Date.now() - sequentialStart;
  console.log(`Sequential total: ${sequentialTotal}ms`);

  // Test concurrent processing
  console.log('\n=== CONCURRENT PROCESSING ===');
  const concurrentStart = Date.now();

  const promises = [];
  for (let i = 0; i < Math.min(3, imageFiles.length); i++) {
    const imagePath = path.join(testDir, imageFiles[i]);
    const imageBuffer = fs.readFileSync(imagePath);

    const promise = (async () => {
      const startTime = Date.now();
      try {
        const result = await nativeFaceDetectionService.detectFacesAsync(imageBuffer);
        const endTime = Date.now();
        return {
          file: imageFiles[i],
          faces: result.faces.length,
          time: endTime - startTime,
          success: true
        };
      } catch (error) {
        const endTime = Date.now();
        return {
          file: imageFiles[i],
          faces: 0,
          time: endTime - startTime,
          success: false,
          error: error.message
        };
      }
    })();

    promises.push(promise);
  }

  const results = await Promise.all(promises);
  const concurrentTotal = Date.now() - concurrentStart;

  results.forEach(result => {
    if (result.success) {
      console.log(`${result.file}: ${result.faces} faces, ${result.time}ms ✅`);
    } else {
      console.log(`${result.file}: FAILED (${result.error}), ${result.time}ms ❌`);
    }
  });

  console.log(`Concurrent total: ${concurrentTotal}ms`);
  console.log(`\nSpeedup: ${(sequentialTotal / concurrentTotal).toFixed(2)}x`);

  // Check for failures
  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    console.log(`\n⚠️  ${failures.length} concurrent operations failed!`);
    console.log('This confirms resource contention in concurrent camera processing.');
  } else {
    console.log('\n✅ All concurrent operations succeeded');
  }
}

testConcurrentDetection().catch(console.error);