const { nativeFaceDetectionService } = require('./dist/services/NativeFaceDetectionService');
const fs = require('fs');
const path = require('path');

async function testFrameDetection() {
  console.log('Testing frame detection with live application settings...');

  // Initialize detector
  const success = await nativeFaceDetectionService.initialize();
  if (!success) {
    console.log('Failed to initialize detector');
    return;
  }

  // Test a frame from the application
  const framePath = 'temp/frames/event-1-camera-1-1758664374109_015.jpg';

  if (!fs.existsSync(framePath)) {
    console.log(`Frame not found: ${framePath}`);
    return;
  }

  const frameBuffer = fs.readFileSync(framePath);
  console.log(`Frame size: ${frameBuffer.length} bytes`);

  // Test with different confidence thresholds
  const thresholds = [0.7, 0.5, 0.3, 0.15, 0.12];

  for (const threshold of thresholds) {
    nativeFaceDetectionService.setConfidenceThreshold(threshold);

    const startTime = Date.now();
    const result = await nativeFaceDetectionService.detectFacesAsync(frameBuffer);
    const endTime = Date.now();

    console.log(`Threshold ${threshold}: ${result.faces.length} faces detected in ${endTime - startTime}ms`);
  }
}

testFrameDetection().catch(console.error);