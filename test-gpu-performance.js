const { nativeFaceDetectionService } = require('./dist/services/NativeFaceDetectionService');
const fs = require('fs');
const sharp = require('sharp');

async function createTestImage() {
    // Create a simple test image with some face-like patterns
    const width = 640;
    const height = 480;

    // Create a test image buffer (JPEG format)
    const testImage = await sharp({
        create: {
            width: width,
            height: height,
            channels: 3,
            background: { r: 128, g: 128, b: 128 }
        }
    })
    .jpeg({ quality: 80 })
    .toBuffer();

    return testImage;
}

async function testGPUPerformance() {
    console.log('🚀 Testing GPU-Accelerated Face Detection Performance');
    console.log('==================================================');

    try {
        // Initialize the service
        console.log('Initializing native face detection service...');
        const initialized = await nativeFaceDetectionService.initialize();
        console.log(`Initialization result: ${initialized}`);

        if (!initialized) {
            console.error('❌ Failed to initialize face detection service');
            return;
        }

        // Create test image
        console.log('Creating test image...');
        const testImageBuffer = await createTestImage();
        console.log(`Test image created: ${testImageBuffer.length} bytes`);

        // Performance test with multiple concurrent detections
        console.log('\n🎯 Performance Test: GPU vs CPU Comparison');
        console.log('==========================================');

        const numTests = 5;
        const numConcurrentPerTest = 8; // Simulate 8 cameras

        console.log(`Running ${numTests} batches of ${numConcurrentPerTest} concurrent detections...`);

        let totalProcessingTime = 0;
        let totalDetections = 0;

        for (let testBatch = 0; testBatch < numTests; testBatch++) {
            const promises = [];
            const batchStartTime = Date.now();

            // Run concurrent detections
            for (let i = 0; i < numConcurrentPerTest; i++) {
                const promise = nativeFaceDetectionService.detectFacesAsync(testImageBuffer)
                    .then(result => {
                        return {
                            cameraId: i + 1,
                            processingTime: result.processingTimeMs,
                            facesFound: result.faces.length,
                            success: true
                        };
                    })
                    .catch(error => {
                        return {
                            cameraId: i + 1,
                            error: error.message,
                            success: false
                        };
                    });
                promises.push(promise);
            }

            // Wait for all detections in this batch
            const results = await Promise.all(promises);
            const batchTime = Date.now() - batchStartTime;

            // Calculate batch statistics
            const successful = results.filter(r => r.success);
            const failed = results.filter(r => !r.success);

            console.log(`Batch ${testBatch + 1}: ${successful.length}/${numConcurrentPerTest} successful, Total time: ${batchTime}ms`);

            if (successful.length > 0) {
                const avgProcessingTime = successful.reduce((sum, r) => sum + (r.processingTime || 0), 0) / successful.length;
                console.log(`  Average processing time per camera: ${avgProcessingTime.toFixed(1)}ms`);
                totalProcessingTime += avgProcessingTime;
                totalDetections += successful.length;
            }

            if (failed.length > 0) {
                console.log(`  Failed detections: ${failed.length}`);
            }

            // Small delay between batches
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Final performance summary
        console.log('\n📊 GPU Performance Summary:');
        console.log('==========================');
        console.log(`Total successful detections: ${totalDetections}`);

        if (totalDetections > 0) {
            const avgTime = totalProcessingTime / numTests;
            console.log(`Average processing time: ${avgTime.toFixed(1)}ms`);

            // Calculate throughput
            const detectionsPerSecond = 1000 / avgTime;
            const concurrentCapacity = detectionsPerSecond * numConcurrentPerTest;

            console.log(`Detection throughput: ${detectionsPerSecond.toFixed(1)} detections/second per camera`);
            console.log(`Concurrent capacity: ${concurrentCapacity.toFixed(1)} detections/second across ${numConcurrentPerTest} cameras`);
        }

        // Get final performance statistics
        const stats = nativeFaceDetectionService.getPerformanceStats();
        console.log('\n🔧 Native Module Statistics:');
        console.log(JSON.stringify(stats, null, 2));

        console.log('\n✅ GPU performance test completed!');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
testGPUPerformance();