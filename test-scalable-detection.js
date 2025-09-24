const { nativeFaceDetectionService } = require('./dist/services/NativeFaceDetectionService');
const fs = require('fs');
const path = require('path');

async function testScalableDetection() {
    console.log('🚀 Testing Scalable Face Detection System');
    console.log('=========================================');

    try {
        // Initialize the service
        console.log('Initializing native face detection service...');
        const initialized = await nativeFaceDetectionService.initialize();
        console.log(`Initialization result: ${initialized}`);

        if (!initialized) {
            console.error('❌ Failed to initialize face detection service');
            return;
        }

        // Load test image
        const testImagePath = path.join(__dirname, 'test-images', 'test-face.jpg');
        if (!fs.existsSync(testImagePath)) {
            console.log('⚠️ Test image not found, using sample buffer');

            // Create a simple test buffer (1x1 black image)
            const testBuffer = Buffer.alloc(1024, 0); // 1KB test buffer

            // Test concurrent detections
            console.log('🎯 Testing concurrent face detections...');
            const promises = [];
            const numConcurrentTests = 10; // Simulate 10 cameras

            for (let i = 0; i < numConcurrentTests; i++) {
                const promise = nativeFaceDetectionService.detectFacesAsync(testBuffer)
                    .then(result => {
                        console.log(`✅ Camera ${i + 1}: Detection completed in ${result.processingTimeMs}ms, found ${result.faces.length} faces`);
                        return { cameraId: i + 1, result };
                    })
                    .catch(error => {
                        console.log(`❌ Camera ${i + 1}: Detection failed - ${error.message}`);
                        return { cameraId: i + 1, error: error.message };
                    });
                promises.push(promise);
            }

            // Wait for all detections to complete
            const startTime = Date.now();
            const results = await Promise.all(promises);
            const totalTime = Date.now() - startTime;

            console.log('\n📊 Results Summary:');
            console.log(`Total concurrent detections: ${numConcurrentTests}`);
            console.log(`Total time: ${totalTime}ms`);
            console.log(`Average time per camera: ${(totalTime / numConcurrentTests).toFixed(1)}ms`);

            const successful = results.filter(r => !r.error).length;
            const failed = results.filter(r => r.error).length;
            console.log(`Successful detections: ${successful}`);
            console.log(`Failed detections: ${failed}`);

            // Get performance stats
            const stats = nativeFaceDetectionService.getPerformanceStats();
            console.log('\n📈 Performance Statistics:');
            console.log(JSON.stringify(stats, null, 2));

        } else {
            const imageBuffer = fs.readFileSync(testImagePath);
            console.log(`Loaded test image: ${testImagePath} (${imageBuffer.length} bytes)`);

            // Test with real image
            const result = await nativeFaceDetectionService.detectFacesAsync(imageBuffer);
            console.log(`Detection result: ${result.faces.length} faces found in ${result.processingTimeMs}ms`);
        }

        console.log('\n✅ Scalable detection test completed!');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
testScalableDetection();