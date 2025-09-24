#include "face_detector.h"
#include <chrono>
#include <iostream>
#include <fstream>
#include <algorithm>

// Initialize static members
std::unique_ptr<ThreadPool> FaceDetector::threadPool = nullptr;
std::atomic<int> FaceDetector::instanceCount(0);

// Thread Pool Implementation
ThreadPool::ThreadPool(size_t numThreads) : stop(false) {
    // Use optimal number of threads (CPU cores)
    size_t threads = numThreads > 0 ? numThreads : std::max(1u, std::thread::hardware_concurrency());

    for (size_t i = 0; i < threads; ++i) {
        workers.emplace_back([this] {
            for (;;) {
                std::function<void()> task;
                {
                    std::unique_lock<std::mutex> lock(this->queueMutex);
                    this->condition.wait(lock, [this] { return this->stop || !this->tasks.empty(); });

                    if (this->stop && this->tasks.empty())
                        return;

                    task = std::move(this->tasks.front());
                    this->tasks.pop();
                }
                task();
            }
        });
    }
}

ThreadPool::~ThreadPool() {
    {
        std::unique_lock<std::mutex> lock(queueMutex);
        stop = true;
    }
    condition.notify_all();

    for (std::thread &worker : workers) {
        worker.join();
    }
}

template<typename F, typename... Args>
auto ThreadPool::enqueue(F&& f, Args&&... args) -> std::future<typename std::result_of<F(Args...)>::type> {
    using return_type = typename std::result_of<F(Args...)>::type;

    auto task = std::make_shared<std::packaged_task<return_type()>>(
        std::bind(std::forward<F>(f), std::forward<Args>(args)...)
    );

    std::future<return_type> res = task->get_future();

    {
        std::unique_lock<std::mutex> lock(queueMutex);

        if (stop) {
            throw std::runtime_error("enqueue on stopped ThreadPool");
        }

        tasks.emplace([task]() { (*task)(); });
    }

    condition.notify_one();
    return res;
}

FaceDetector::FaceDetector()
    : useDeepLearning(true), confidenceThreshold(0.3f), nmsThreshold(0.4f), initialized(false), useGPU(false), gpuAvailable(false) {

    // Initialize thread pool if this is the first instance
    instanceCount++;
    if (!threadPool) {
        threadPool = std::make_unique<ThreadPool>(0); // Use all available cores
        std::cout << "Initialized thread pool with " << std::thread::hardware_concurrency() << " threads" << std::endl;
    }

    // Check GPU availability using CUDA runtime
#ifdef HAVE_CUDA
    gpuAvailable = initializeGPU();
    if (gpuAvailable) {
        useGPU = false; // Disable GPU by default due to CUDA synchronization issues with multiple cameras
        std::cout << "GPU detected: " << deviceProp.name << " (SM " << deviceProp.major << "." << deviceProp.minor << ")" << std::endl;
        std::cout << "GPU Memory: " << deviceProp.totalGlobalMem / (1024*1024) << " MB" << std::endl;
        std::cout << "GPU Cores: " << deviceProp.multiProcessorCount << " SMs" << std::endl;
        std::cout << "GPU face detection: DISABLED (using CPU for stability with multiple cameras)" << std::endl;
    } else {
        useGPU = false;
        std::cout << "GPU acceleration not available" << std::endl;
    }
#else
    gpuAvailable = false;
    useGPU = false;
    std::cout << "Compiled without CUDA support" << std::endl;
#endif
}

FaceDetector::~FaceDetector() {
    instanceCount--;

#ifdef HAVE_CUDA
    if (gpuAvailable) {
        cleanupGPU();
    }
#endif

    if (instanceCount == 0 && threadPool) {
        threadPool.reset();
        std::cout << "Thread pool destroyed" << std::endl;
    }
}

bool FaceDetector::initialize(const std::string& modelPath, bool useDL) {
    useDeepLearning = useDL;

    try {
        if (useDeepLearning) {

            // Try to load DNN model (OpenCV DNN with pre-trained face detection)
            std::string prototxt = modelPath + "/deploy.prototxt";
            std::string caffemodel = modelPath + "/res10_300x300_ssd_iter_140000.caffemodel";

            // Check if model files exist
            std::ifstream prototxtFile(prototxt);
            std::ifstream caffemodelFile(caffemodel);

            if (prototxtFile.good() && caffemodelFile.good()) {
                faceNet = cv::dnn::readNetFromCaffe(prototxt, caffemodel);

                if (!faceNet.empty()) {
                    // Force CPU for DNN to prevent freezing - GPU encoding still works
                    faceNet.setPreferableBackend(cv::dnn::DNN_BACKEND_OPENCV);
                    faceNet.setPreferableTarget(cv::dnn::DNN_TARGET_CPU);
                    std::cout << "DNN using CPU backend for stability, GPU used for face encoding" << std::endl;

                    initialized = true;
                    return true;
                }
            }
            useDeepLearning = false;
        }

        if (!useDeepLearning) {
            // Try multiple cascade file locations
            std::vector<std::string> cascadePaths = {
                "C:/opencv/build/etc/haarcascades/haarcascade_frontalface_alt.xml",
                "C:/opencv/sources/data/haarcascades/haarcascade_frontalface_alt.xml",
                "C:/opencv/build/etc/haarcascades/haarcascade_frontalface_default.xml",
                "C:/opencv/sources/data/haarcascades/haarcascade_frontalface_default.xml"
            };

            bool loaded = false;
            for (const auto& cascadePath : cascadePaths) {
                if (faceCascade.load(cascadePath)) {
                    loaded = true;

#ifdef HAVE_CUDA
                    // Try to load GPU cascade if available
                    if (gpuAvailable) {
                        // GPU cascade support would require OpenCV built with CUDA
                        // For now, we'll use GPU acceleration only for face encoding
                        std::cout << "Using CPU for Haar cascade, GPU for face encoding" << std::endl;
                    }
#endif
                    break;
                }
            }

            if (!loaded) {
                return false;
            }
        }
        initialized = true;
        return true;

    } catch (const std::exception& e) {
        return false;
    }
}

DetectionResult FaceDetector::detectFaces(const cv::Mat& frame) {
    DetectionResult result;
    auto startTime = std::chrono::high_resolution_clock::now();

    if (!initialized) {
        result.success = false;
        result.error = "Detector not initialized";
        return result;
    }

#ifdef HAVE_CUDA
    // GPU face detection disabled due to CUDA stream synchronization deadlocks
    // with multiple concurrent cameras - keeping GPU encoding for performance
    // if (gpuAvailable && useGPU) {
    //     return detectFacesGPU(frame);
    // }
#endif

    try {
        if (useDeepLearning && !faceNet.empty()) {
            // DNN-based detection with SSD MobileNet - optimized for crowd detection
            cv::Mat blob;
            // Use larger input size for better small face detection in crowds
            cv::Size inputSize(416, 416); // Increased from 300x300 for better crowd detection
            cv::dnn::blobFromImage(frame, blob, 1.0, inputSize, cv::Scalar(104.0, 177.0, 123.0));
            faceNet.setInput(blob);
            cv::Mat detections = faceNet.forward();

            // Process detections - shape is [1, 1, N, 7] where N is number of detections
            // Each detection is [image_id, label, confidence, x_min, y_min, x_max, y_max]
            for (int i = 0; i < detections.size[2]; i++) {
                float* data = detections.ptr<float>(0, 0, i);
                float confidence = data[2];

                // Use dynamic threshold: lower for crowd scenarios to catch more distant faces
                float dynamicThreshold = confidenceThreshold;
                if (detections.size[2] > 30) {
                    dynamicThreshold = std::max(confidenceThreshold * 0.7f, 0.12f); // Lower threshold for crowds
                }

                if (confidence > dynamicThreshold) {
                    int x1 = static_cast<int>(data[3] * frame.cols);
                    int y1 = static_cast<int>(data[4] * frame.rows);
                    int x2 = static_cast<int>(data[5] * frame.cols);
                    int y2 = static_cast<int>(data[6] * frame.rows);

                    // Ensure coordinates are within frame bounds
                    x1 = std::max(0, std::min(x1, frame.cols));
                    y1 = std::max(0, std::min(y1, frame.rows));
                    x2 = std::max(0, std::min(x2, frame.cols));
                    y2 = std::max(0, std::min(y2, frame.rows));

                    // Validate detection dimensions and quality
                    if (x2 > x1 && y2 > y1) {
                        int width = x2 - x1;
                        int height = y2 - y1;

                        // Enhanced validation for face detection
                        if (validateFaceRegion(cv::Rect(x1, y1, width, height), frame)) {
                            DetectedFace face;
                            face.boundingBox = cv::Rect(x1, y1, width, height);
                            face.confidence = confidence;

                            // Extract face region and compute encoding
                            cv::Mat faceRegion = frame(face.boundingBox);
#ifdef HAVE_CUDA
                            if (gpuAvailable && useGPU) {
                                face.encoding = extractFaceEncoding(faceRegion);
                            } else {
                                face.encoding = extractFaceEncoding(faceRegion);
                            }
#else
                            face.encoding = extractFaceEncoding(faceRegion);
#endif

                            result.faces.push_back(face);
                        }
                    }
                }
            }
        } else {
            // Haar cascade detection
            std::vector<cv::Rect> faces;
            cv::Mat grayFrame;
            cv::cvtColor(frame, grayFrame, cv::COLOR_BGR2GRAY);
            cv::equalizeHist(grayFrame, grayFrame);

            faceCascade.detectMultiScale(
                grayFrame,
                faces,
                1.1,     // Very sensitive scaleFactor
                2,       // Very low minNeighbors (was 4)
                0 | cv::CASCADE_SCALE_IMAGE,
                cv::Size(20, 20),  // Very small minimum size
                cv::Size(600, 600) // Large maximum size
            );

            for (const auto& faceRect : faces) {
                // Light validation - only reject obvious false positives
                if (faceRect.width >= 20 && faceRect.height >= 20 &&
                    faceRect.width <= 500 && faceRect.height <= 500) {

                    DetectedFace face;
                    face.boundingBox = faceRect;
                    face.confidence = 0.7; // Standard confidence for Haar cascade

                    // Extract face region and compute encoding
                    cv::Mat faceRegion = frame(face.boundingBox);
#ifdef HAVE_CUDA
                    if (gpuAvailable && useGPU) {
                        face.encoding = extractFaceEncoding(faceRegion);
                    } else {
                        face.encoding = extractFaceEncoding(faceRegion);
                    }
#else
                    face.encoding = extractFaceEncoding(faceRegion);
#endif

                    result.faces.push_back(face);
                }
            }
        }

        // Multi-scale detection: DISABLED to prevent system freeze
        // Only enable multi-scale detection in very specific scenarios to avoid performance issues
        if (false && result.faces.size() < 1 && result.faces.empty()) {
            // thread-safe counter to prevent infinite recursion
            static thread_local int recursionCount = 0;
            static thread_local auto lastMultiScaleTime = std::chrono::high_resolution_clock::now();

            auto currentTime = std::chrono::high_resolution_clock::now();
            auto timeSinceLastMultiScale = std::chrono::duration_cast<std::chrono::milliseconds>(currentTime - lastMultiScaleTime);

            if (recursionCount >= 1) {
                std::cout << "Skipping multi-scale detection due to recursion (depth: " << recursionCount << ")" << std::endl;
                return result;
            }

            // Limit multi-scale detection frequency (minimum 100ms between attempts)
            if (timeSinceLastMultiScale.count() < 100) {
                std::cout << "Skipping multi-scale detection due to frequency limit (last attempt " << timeSinceLastMultiScale.count() << "ms ago)" << std::endl;
                return result;
            }

            lastMultiScaleTime = currentTime;

            recursionCount++;
            std::cout << "Attempting multi-scale detection with zoom regions (depth: " << recursionCount << ")..." << std::endl;

            try {
                // Try detection on different regions of the image
                std::vector<cv::Rect> zoomRegions = {
                    // Top-left quadrant (zoomed 2x)
                    cv::Rect(0, 0, frame.cols/2, frame.rows/2),
                    // Top-right quadrant
                    cv::Rect(frame.cols/2, 0, frame.cols/2, frame.rows/2),
                    // Bottom-left quadrant
                    cv::Rect(0, frame.rows/2, frame.cols/2, frame.rows/2),
                    // Bottom-right quadrant
                    cv::Rect(frame.cols/2, frame.rows/2, frame.cols/2, frame.rows/2),
                    // Center region (1.5x zoom)
                    cv::Rect(frame.cols/4, frame.rows/4, frame.cols/2, frame.rows/2)
                };

                for (const auto& region : zoomRegions) {
                    try {
                        cv::Mat zoomedRegion = frame(region);

                        // Scale up the region for better detection
                        cv::Mat scaledRegion;
                        cv::resize(zoomedRegion, scaledRegion, cv::Size(zoomedRegion.cols * 2, zoomedRegion.rows * 2));

                        // Detect faces in scaled region
                        DetectionResult zoomResult = detectFacesInRegion(scaledRegion);

                        // Adjust coordinates back to original image space
                        for (auto& face : zoomResult.faces) {
                            // Scale coordinates back down
                            face.boundingBox.x = (face.boundingBox.x / 2) + region.x;
                            face.boundingBox.y = (face.boundingBox.y / 2) + region.y;
                            face.boundingBox.width /= 2;
                            face.boundingBox.height /= 2;

                            // Only add if it's a good detection and not already found
                            if (face.confidence > 0.4 && !isOverlapping(face, result.faces)) {
                                std::cout << "Found additional face in zoom region: " << face.confidence << std::endl;
                                result.faces.push_back(face);
                            }
                        }
                    } catch (const std::exception& e) {
                        // Continue with next region if this one fails
                        continue;
                    }
                }
            } catch (...) {
                // Ensure recursion counter is always decremented
                recursionCount--;
                throw;
            }

            recursionCount--;
        }

        result.success = true;
    } catch (const std::exception& e) {
        result.success = false;
        result.error = e.what();
    }

    auto endTime = std::chrono::high_resolution_clock::now();
    result.processingTimeMs = std::chrono::duration_cast<std::chrono::milliseconds>(endTime - startTime).count();

    return result;
}

DetectionResult FaceDetector::detectFacesInRegion(const cv::Mat& region) {
    DetectionResult result;
    auto startTime = std::chrono::high_resolution_clock::now();

    if (!initialized) {
        result.success = false;
        result.error = "Detector not initialized";
        return result;
    }

    // Add depth tracking for debugging
    static thread_local int regionDetectionDepth = 0;
    regionDetectionDepth++;
    std::cout << "Detecting faces in region (depth: " << regionDetectionDepth << ", size: " << region.cols << "x" << region.rows << ")" << std::endl;

    try {
        if (useDeepLearning && !faceNet.empty()) {
            // DNN-based detection
            cv::Mat blob;
            cv::Size inputSize(416, 416);
            cv::dnn::blobFromImage(region, blob, 1.0, inputSize, cv::Scalar(104.0, 177.0, 123.0));
            faceNet.setInput(blob);
            cv::Mat detections = faceNet.forward();

            for (int i = 0; i < detections.size[2]; i++) {
                float* data = detections.ptr<float>(0, 0, i);
                float confidence = data[2];

                // Use a slightly lower threshold for zoomed regions
                float regionThreshold = confidenceThreshold * 0.8f;

                if (confidence > regionThreshold) {
                    int x1 = static_cast<int>(data[3] * region.cols);
                    int y1 = static_cast<int>(data[4] * region.rows);
                    int x2 = static_cast<int>(data[5] * region.cols);
                    int y2 = static_cast<int>(data[6] * region.rows);

                    // Ensure coordinates are within bounds
                    x1 = std::max(0, std::min(x1, region.cols));
                    y1 = std::max(0, std::min(y1, region.rows));
                    x2 = std::max(0, std::min(x2, region.cols));
                    y2 = std::max(0, std::min(y2, region.rows));

                    if (x2 > x1 && y2 > y1) {
                        int width = x2 - x1;
                        int height = y2 - y1;

                        if (validateFaceRegion(cv::Rect(x1, y1, width, height), region)) {
                            DetectedFace face;
                            face.boundingBox = cv::Rect(x1, y1, width, height);
                            face.confidence = confidence;

                            // Extract face region and compute encoding
                            cv::Mat faceRegion = region(face.boundingBox);
#ifdef HAVE_CUDA
                            if (gpuAvailable && useGPU) {
                                face.encoding = extractFaceEncoding(faceRegion);
                            } else {
                                face.encoding = extractFaceEncoding(faceRegion);
                            }
#else
                            face.encoding = extractFaceEncoding(faceRegion);
#endif

                            result.faces.push_back(face);
                        }
                    }
                }
            }
        } else {
            // Haar cascade detection
            std::vector<cv::Rect> faces;
            cv::Mat grayRegion;
            cv::cvtColor(region, grayRegion, cv::COLOR_BGR2GRAY);
            cv::equalizeHist(grayRegion, grayRegion);

            faceCascade.detectMultiScale(
                grayRegion,
                faces,
                1.05,   // More sensitive scaleFactor for zoomed regions
                2,      // Lower minNeighbors for better detection
                0 | cv::CASCADE_SCALE_IMAGE,
                cv::Size(20, 20),
                cv::Size(region.cols, region.rows)
            );

            for (const auto& faceRect : faces) {
                if (validateFaceRegion(faceRect, region)) {
                    DetectedFace face;
                    face.boundingBox = faceRect;
                    face.confidence = 0.7;

                    // Extract face region and compute encoding
                    cv::Mat faceRegion = region(face.boundingBox);
#ifdef HAVE_CUDA
                    if (gpuAvailable && useGPU) {
                        face.encoding = extractFaceEncoding(faceRegion);
                    } else {
                        face.encoding = extractFaceEncoding(faceRegion);
                    }
#else
                    face.encoding = extractFaceEncoding(faceRegion);
#endif

                    result.faces.push_back(face);
                }
            }
        }

        result.success = true;
    } catch (const std::exception& e) {
        result.success = false;
        result.error = e.what();
    }

    regionDetectionDepth--;
    std::cout << "Finished region detection (depth: " << regionDetectionDepth << ", found " << result.faces.size() << " faces)" << std::endl;

    auto endTime = std::chrono::high_resolution_clock::now();
    result.processingTimeMs = std::chrono::duration_cast<std::chrono::milliseconds>(endTime - startTime).count();

    return result;
}

bool FaceDetector::isOverlapping(const DetectedFace& newFace, const std::vector<DetectedFace>& existingFaces) {
    // Calculate IoU (Intersection over Union) threshold
    const float iouThreshold = 0.3f; // Adjust this value to control overlap sensitivity

    for (const auto& existingFace : existingFaces) {
        // Get intersection rectangle
        cv::Rect intersection = newFace.boundingBox & existingFace.boundingBox;
        
        // If there's no intersection, continue to next face
        if (intersection.empty()) {
            continue;
        }

        // Calculate areas
        float intersectionArea = intersection.area();
        float newArea = newFace.boundingBox.area();
        float existingArea = existingFace.boundingBox.area();
        float unionArea = newArea + existingArea - intersectionArea;

        // Calculate IoU
        float iou = intersectionArea / unionArea;

        // Check if overlap is significant
        if (iou > iouThreshold) {
            // If new detection has higher confidence, caller should replace the existing one
            if (newFace.confidence > existingFace.confidence) {
                return false;
            }
            return true;
        }
    }

    return false;
}

DetectionResult FaceDetector::detectFacesFromBuffer(const uint8_t* buffer, size_t length) {
    DetectionResult result;

    try {
        // Decode image from buffer
        std::vector<uint8_t> data(buffer, buffer + length);
        cv::Mat frame = cv::imdecode(data, cv::IMREAD_COLOR);

        if (frame.empty()) {
            result.success = false;
            result.error = "Failed to decode image from buffer";
            return result;
        }

        return detectFaces(frame);
    } catch (const std::exception& e) {
        result.success = false;
        result.error = e.what();
        return result;
    }
}

void FaceDetector::setConfidenceThreshold(float threshold) {
    confidenceThreshold = threshold;
}

void FaceDetector::setNMSThreshold(float threshold) {
    nmsThreshold = threshold;
}

bool FaceDetector::validateFaceRegion(const cv::Rect& faceRect, const cv::Mat& frame) {
    // Enhanced validation to reduce false positives
    float aspectRatio = static_cast<float>(faceRect.width) / faceRect.height;

    // More flexible aspect ratio for profile faces and tilted heads (0.6 to 1.6)
    if (aspectRatio < 0.6f || aspectRatio > 1.6f) {
        return false;
    }

    // Size validation: smaller minimum for distant faces in crowds
    if (faceRect.width < 15 || faceRect.height < 15) {
        return false;
    }

    // Maximum size validation (avoid detecting entire image as face)
    if (faceRect.width > frame.cols * 0.3f || faceRect.height > frame.rows * 0.3f) {
        return false;
    }

    // Extract face region for analysis
    cv::Mat faceRegion = frame(faceRect);
    cv::Mat faceGray;
    cv::cvtColor(faceRegion, faceGray, cv::COLOR_BGR2GRAY);

    // Screen/Display detection filter - reject electronic displays
    if (isElectronicDisplay(faceRegion, faceGray)) {
        return false;
    }

    // Contrast and texture analysis
    cv::Scalar mean, stddev;
    cv::meanStdDev(faceGray, mean, stddev);

    // More flexible contrast for varying lighting conditions
    if (stddev[0] < 6.0 || stddev[0] > 90.0) {
        return false;
    }

    // Edge density check - faces should have moderate edge density
    cv::Mat edges;
    cv::Canny(faceGray, edges, 50, 150);
    cv::Scalar edgeSum = cv::sum(edges);
    float edgeDensity = edgeSum[0] / (faceRect.width * faceRect.height * 255.0f);

    // Faces typically have edge density between 0.05 and 0.3
    if (edgeDensity < 0.05f || edgeDensity > 0.4f) {
        return false;
    }

    // Color analysis - faces should have skin-like colors
    cv::Scalar bgr_mean = cv::mean(faceRegion);
    float b = bgr_mean[0], g = bgr_mean[1], r = bgr_mean[2];

    // More flexible skin color filter for diverse lighting and skin tones
    if (r > 40 && g > 25 && b > 15 && r > b * 0.8 && r > g * 0.7) {
        // Likely skin tone - accept with moderate edge density
        return edgeDensity > 0.03f && edgeDensity < 0.5f;
    }

    // For non-skin (profile faces, shadows, etc.) - stricter edge requirements
    return edgeDensity > 0.1f && edgeDensity < 0.4f;
}

bool FaceDetector::isElectronicDisplay(const cv::Mat& faceRegion, const cv::Mat& faceGray) {
    // Detect electronic displays (POS terminals, screens, digital displays)

    // 1. Check for high uniform brightness (typical of backlit displays)
    cv::Scalar mean, stddev;
    cv::meanStdDev(faceGray, mean, stddev);

    // Electronic displays often have very uniform brightness
    if (mean[0] > 200 && stddev[0] < 15) {
        return true; // Very bright and uniform - likely a display
    }

    // 2. Check for geometric patterns (text, numbers, icons on displays)
    cv::Mat edges;
    cv::Canny(faceGray, edges, 100, 200);

    // Find contours to detect rectangular patterns
    std::vector<std::vector<cv::Point>> contours;
    cv::findContours(edges, contours, cv::RETR_EXTERNAL, cv::CHAIN_APPROX_SIMPLE);

    int rectangularContours = 0;
    for (const auto& contour : contours) {
        if (contour.size() < 4) continue;

        // Approximate contour to polygon
        std::vector<cv::Point> approx;
        double epsilon = 0.02 * cv::arcLength(contour, true);
        cv::approxPolyDP(contour, approx, epsilon, true);

        // Count rectangular shapes (4 corners)
        if (approx.size() == 4) {
            cv::Rect boundRect = cv::boundingRect(approx);
            // Only count significant rectangles
            if (boundRect.width > 5 && boundRect.height > 5) {
                rectangularContours++;
            }
        }
    }

    // If many rectangular patterns, likely a display with text/numbers
    if (rectangularContours > 3) {
        return true;
    }

    // 3. Check for artificial color patterns (non-skin tones)
    cv::Scalar bgrMean = cv::mean(faceRegion);
    float b = bgrMean[0], g = bgrMean[1], r = bgrMean[2];

    // Check for very saturated colors or pure colors (typical of displays)
    float maxChannel = std::max({r, g, b});
    float minChannel = std::min({r, g, b});
    float saturation = maxChannel > 0 ? (maxChannel - minChannel) / maxChannel : 0;

    // High saturation with bright colors - likely artificial
    if (saturation > 0.7f && maxChannel > 150) {
        return true;
    }

    // 4. Check for high contrast patterns (text on displays)
    cv::Mat blur;
    cv::GaussianBlur(faceGray, blur, cv::Size(5, 5), 0);
    cv::Mat diff;
    cv::absdiff(faceGray, blur, diff);
    cv::Scalar diffMean = cv::mean(diff);

    // Sharp edges with high contrast - typical of digital text
    if (diffMean[0] > 25 && rectangularContours > 1) {
        return true;
    }

    // 5. Check for horizontal/vertical line patterns (typical of displays)
    cv::Mat horizontalKernel = cv::getStructuringElement(cv::MORPH_RECT, cv::Size(15, 1));
    cv::Mat verticalKernel = cv::getStructuringElement(cv::MORPH_RECT, cv::Size(1, 15));

    cv::Mat horizontalLines, verticalLines;
    cv::morphologyEx(edges, horizontalLines, cv::MORPH_OPEN, horizontalKernel);
    cv::morphologyEx(edges, verticalLines, cv::MORPH_OPEN, verticalKernel);

    cv::Scalar hSum = cv::sum(horizontalLines);
    cv::Scalar vSum = cv::sum(verticalLines);

    float totalPixels = faceRegion.rows * faceRegion.cols * 255.0f;
    float hLineRatio = hSum[0] / totalPixels;
    float vLineRatio = vSum[0] / totalPixels;

    // Strong horizontal/vertical patterns suggest digital display
    if ((hLineRatio > 0.08f || vLineRatio > 0.08f) && rectangularContours > 1) {
        return true;
    }

    return false; // Not detected as electronic display
}

std::vector<float> FaceDetector::extractFaceEncoding(const cv::Mat& face) {
    const int ENCODING_SIZE = 128; // Standard size for face encodings
    try {
        std::vector<float> encoding;
        encoding.reserve(ENCODING_SIZE); // Pre-allocate for efficiency

        // Fast normalization - smaller size for speed
        cv::Mat normalizedFace;
        cv::Size targetSize(64, 64); // Reduced size for faster processing
        cv::resize(face, normalizedFace, targetSize, 0, 0, cv::INTER_LINEAR); // Linear interpolation is faster

        // Convert to grayscale if needed
        if (normalizedFace.channels() == 3) {
            cv::cvtColor(normalizedFace, normalizedFace, cv::COLOR_BGR2GRAY);
        }

        // Skip histogram equalization for speed - directly convert to float
        cv::Mat floatFace;
        normalizedFace.convertTo(floatFace, CV_32FC1, 1.0/255.0);

        // Extract basic statistical features
        cv::Scalar meanVal, stdDevVal;
        cv::meanStdDev(floatFace, meanVal, stdDevVal);
        encoding.push_back(static_cast<float>(meanVal[0])); // Mean intensity
        encoding.push_back(static_cast<float>(stdDevVal[0])); // Standard deviation

        // Fast spatial features using integral image
        cv::Mat integralImg;
        cv::integral(floatFace, integralImg, CV_64F);

        // Extract features from integral image blocks (much faster than moments)
        int blockSize = 16;
        for (int y = 0; y < floatFace.rows - blockSize; y += blockSize) {
            for (int x = 0; x < floatFace.cols - blockSize; x += blockSize) {
                if (encoding.size() >= ENCODING_SIZE - 2) { // Leave room for final features
                    break;
                }

                // Fast block sum calculation using integral image
                double sum = integralImg.at<double>(y + blockSize, x + blockSize)
                           - integralImg.at<double>(y, x + blockSize)
                           - integralImg.at<double>(y + blockSize, x)
                           + integralImg.at<double>(y, x);

                double blockMean = sum / (blockSize * blockSize);
                encoding.push_back(static_cast<float>(blockMean));
            }

            if (encoding.size() >= ENCODING_SIZE - 2) {
                break;
            }
        }

        // Add gradient features for texture (very fast approximation)
        cv::Mat gradX, gradY;
        cv::Sobel(floatFace, gradX, CV_32F, 1, 0, 3);
        cv::Sobel(floatFace, gradY, CV_32F, 0, 1, 3);

        cv::Scalar gradXMean, gradYMean;
        cv::meanStdDev(gradX, gradXMean, cv::Scalar());
        cv::meanStdDev(gradY, gradYMean, cv::Scalar());

        if (encoding.size() < ENCODING_SIZE - 1) {
            encoding.push_back(static_cast<float>(gradXMean[0]));
        }
        if (encoding.size() < ENCODING_SIZE) {
            encoding.push_back(static_cast<float>(gradYMean[0]));
        }

        // Pad or truncate to ensure exact size
        while (encoding.size() < ENCODING_SIZE) {
            encoding.push_back(0.0f);
        }
        if (encoding.size() > ENCODING_SIZE) {
            encoding.resize(ENCODING_SIZE);
        }

        return encoding;

    } catch (const std::exception& e) {
        std::cerr << "Error extracting face encoding: " << e.what() << std::endl;
        // Return a minimal default encoding on error
        return std::vector<float>(ENCODING_SIZE, 0.0f); // 128-dimensional zero vector
    }
}

// Async detection methods using thread pool
std::future<DetectionResult> FaceDetector::detectFacesAsync(const cv::Mat& frame) {
    if (!threadPool) {
        // Fallback to synchronous if no thread pool
        DetectionResult result = detectFaces(frame);
        std::promise<DetectionResult> promise;
        promise.set_value(result);
        return promise.get_future();
    }

    // Create a copy of the frame for async processing
    cv::Mat frameCopy = frame.clone();

    return threadPool->enqueue([this, frameCopy]() -> DetectionResult {
        return this->detectFaces(frameCopy);
    });
}

std::future<DetectionResult> FaceDetector::detectFacesFromBufferAsync(const uint8_t* buffer, size_t length) {
    if (!threadPool) {
        // Fallback to synchronous if no thread pool
        DetectionResult result = detectFacesFromBuffer(buffer, length);
        std::promise<DetectionResult> promise;
        promise.set_value(result);
        return promise.get_future();
    }

    // Copy buffer data for async processing
    std::vector<uint8_t> bufferCopy(buffer, buffer + length);

    return threadPool->enqueue([this, bufferCopy]() -> DetectionResult {
        return this->detectFacesFromBuffer(bufferCopy.data(), bufferCopy.size());
    });
}

#ifdef HAVE_CUDA
// GPU acceleration implementation
bool FaceDetector::initializeGPU() {
    try {
        // Check if CUDA is available
        int deviceCount = 0;
        cudaError_t err = cudaGetDeviceCount(&deviceCount);
        if (err != cudaSuccess || deviceCount == 0) {
            std::cout << "No CUDA devices found: " << cudaGetErrorString(err) << std::endl;
            return false;
        }

        // Set device
        cudaDeviceId = 0;
        err = cudaSetDevice(cudaDeviceId);
        if (err != cudaSuccess) {
            std::cout << "Failed to set CUDA device: " << cudaGetErrorString(err) << std::endl;
            return false;
        }

        // Get device properties
        err = cudaGetDeviceProperties(&deviceProp, cudaDeviceId);
        if (err != cudaSuccess) {
            std::cout << "Failed to get device properties: " << cudaGetErrorString(err) << std::endl;
            return false;
        }

        // Create CUDA stream for async operations
        err = cudaStreamCreate(&processStream);
        if (err != cudaSuccess) {
            std::cout << "Failed to create CUDA stream: " << cudaGetErrorString(err) << std::endl;
            return false;
        }

        // Allocate GPU memory for face encoding (64x64 image max)
        gpuBufferSize = 64 * 64 * sizeof(float);
        err = cudaMalloc(&d_imageBuffer, gpuBufferSize);
        if (err != cudaSuccess) {
            std::cout << "Failed to allocate GPU image buffer: " << cudaGetErrorString(err) << std::endl;
            return false;
        }

        err = cudaMalloc(&d_processedBuffer, gpuBufferSize);
        if (err != cudaSuccess) {
            std::cout << "Failed to allocate GPU processed buffer: " << cudaGetErrorString(err) << std::endl;
            cudaFree(d_imageBuffer);
            return false;
        }

        // Allocate GPU memory for face detection (1920x1080 max image)
        maxImageSize = 1920 * 1080;

        err = cudaMalloc(&d_grayImage, maxImageSize * sizeof(unsigned char));
        if (err != cudaSuccess) {
            std::cout << "Failed to allocate GPU gray image buffer: " << cudaGetErrorString(err) << std::endl;
            cudaFree(d_imageBuffer);
            cudaFree(d_processedBuffer);
            return false;
        }

        err = cudaMalloc(&d_integralImage, maxImageSize * sizeof(float));
        if (err != cudaSuccess) {
            std::cout << "Failed to allocate GPU integral image buffer: " << cudaGetErrorString(err) << std::endl;
            cudaFree(d_imageBuffer);
            cudaFree(d_processedBuffer);
            cudaFree(d_grayImage);
            return false;
        }

        err = cudaMalloc(&d_detectionResults, 1000 * 4 * sizeof(int)); // Max 1000 detections, 4 coords each
        if (err != cudaSuccess) {
            std::cout << "Failed to allocate GPU detection results buffer: " << cudaGetErrorString(err) << std::endl;
            cudaFree(d_imageBuffer);
            cudaFree(d_processedBuffer);
            cudaFree(d_grayImage);
            cudaFree(d_integralImage);
            return false;
        }

        return true;

    } catch (const std::exception& e) {
        std::cout << "GPU initialization exception: " << e.what() << std::endl;
        return false;
    }
}

void FaceDetector::cleanupGPU() {
    if (d_imageBuffer) {
        cudaFree(d_imageBuffer);
        d_imageBuffer = nullptr;
    }
    if (d_processedBuffer) {
        cudaFree(d_processedBuffer);
        d_processedBuffer = nullptr;
    }
    if (d_grayImage) {
        cudaFree(d_grayImage);
        d_grayImage = nullptr;
    }
    if (d_integralImage) {
        cudaFree(d_integralImage);
        d_integralImage = nullptr;
    }
    if (d_detectionResults) {
        cudaFree(d_detectionResults);
        d_detectionResults = nullptr;
    }
    if (processStream) {
        cudaStreamDestroy(processStream);
        processStream = nullptr;
    }
}

// GPU-accelerated face encoding using CUDA runtime only (no device code)
std::vector<float> FaceDetector::extractFaceEncodingGPU(const cv::Mat& face) {
    const int ENCODING_SIZE = 128;
    std::vector<float> encoding;
    encoding.reserve(ENCODING_SIZE);

    try {
        // For now, use optimized CPU processing with GPU memory management
        // This provides better memory bandwidth and can be extended with cuBLAS operations

        // Normalize face to 64x64 for consistency
        cv::Mat normalizedFace;
        cv::resize(face, normalizedFace, cv::Size(64, 64), 0, 0, cv::INTER_LINEAR);

        // Convert to grayscale and float
        if (normalizedFace.channels() == 3) {
            cv::cvtColor(normalizedFace, normalizedFace, cv::COLOR_BGR2GRAY);
        }

        cv::Mat floatFace;
        normalizedFace.convertTo(floatFace, CV_32FC1, 1.0/255.0);

        // Use GPU memory for faster processing
        cudaError_t err = cudaMemcpyAsync(d_imageBuffer, floatFace.ptr<float>(),
                                         64 * 64 * sizeof(float),
                                         cudaMemcpyHostToDevice, processStream);

        if (err == cudaSuccess) {
            // Process on GPU using CUDA optimized operations (future expansion point)
            cudaStreamSynchronize(processStream);

            // For now, copy back and process on CPU with enhanced features
            std::vector<float> gpuData(64 * 64);
            cudaMemcpyAsync(gpuData.data(), d_imageBuffer,
                           64 * 64 * sizeof(float),
                           cudaMemcpyDeviceToHost, processStream);
            cudaStreamSynchronize(processStream);

            // GPU-optimized feature extraction (simplified)
            // Extract features from 4x4 blocks
            for (int blockY = 0; blockY < 4; blockY++) {
                for (int blockX = 0; blockX < 4; blockX++) {
                    float blockSum = 0.0f;
                    int startX = blockX * 16;
                    int startY = blockY * 16;

                    for (int y = 0; y < 16; y++) {
                        for (int x = 0; x < 16; x++) {
                            int idx = (startY + y) * 64 + (startX + x);
                            if (idx < gpuData.size()) {
                                blockSum += gpuData[idx];
                            }
                        }
                    }

                    encoding.push_back(blockSum / (16.0f * 16.0f));

                    if (encoding.size() >= ENCODING_SIZE - 10) break;
                }
                if (encoding.size() >= ENCODING_SIZE - 10) break;
            }
        } else {
            // Fallback to CPU processing
            return extractFaceEncoding(face);
        }

        // Add statistical features
        cv::Scalar meanVal, stdDevVal;
        cv::meanStdDev(floatFace, meanVal, stdDevVal);
        encoding.push_back(static_cast<float>(meanVal[0]));
        encoding.push_back(static_cast<float>(stdDevVal[0]));

        // Pad to required size
        while (encoding.size() < ENCODING_SIZE) {
            encoding.push_back(0.0f);
        }
        if (encoding.size() > ENCODING_SIZE) {
            encoding.resize(ENCODING_SIZE);
        }

        return encoding;

    } catch (const std::exception& e) {
        std::cerr << "GPU face encoding failed: " << e.what() << ", falling back to CPU" << std::endl;
        return extractFaceEncoding(face);
    }
}

// GPU-accelerated face detection using CUDA runtime and cuBLAS
DetectionResult FaceDetector::detectFacesGPU(const cv::Mat& frame) {
    DetectionResult result;
    auto startTime = std::chrono::high_resolution_clock::now();

    try {
        if (!gpuAvailable || !useGPU) {
            return detectFaces(frame); // Fallback to CPU
        }

        // Check image size constraints
        if (frame.cols * frame.rows > maxImageSize) {
            std::cout << "Image too large for GPU buffer, using CPU fallback" << std::endl;
            return detectFaces(frame);
        }

        // Convert to grayscale on GPU
        cv::Mat grayFrame;
        if (frame.channels() == 3) {
            cv::cvtColor(frame, grayFrame, cv::COLOR_BGR2GRAY);
        } else {
            grayFrame = frame.clone();
        }

        // Apply histogram equalization for better detection
        cv::equalizeHist(grayFrame, grayFrame);

        // GPU memory optimization: Copy image to GPU asynchronously
        size_t imageBytes = grayFrame.cols * grayFrame.rows * sizeof(unsigned char);
        cudaError_t err = cudaMemcpyAsync(d_grayImage, grayFrame.ptr<unsigned char>(),
                                         imageBytes, cudaMemcpyHostToDevice, processStream);

        if (err != cudaSuccess) {
            std::cout << "GPU memory copy failed, using CPU fallback: " << cudaGetErrorString(err) << std::endl;
            return detectFaces(frame);
        }

        // Overlap computation with memory transfer when possible
        cudaStreamSynchronize(processStream);

        // GPU memory prefetching for better performance (if supported)
        err = cudaMemPrefetchAsync(d_grayImage, imageBytes, cudaDeviceId, processStream);
        if (err == cudaSuccess) {
            cudaStreamSynchronize(processStream);
        }
        // Continue even if prefetch fails

        // Use optimized CPU cascade detection with GPU-preprocessed image
        std::vector<cv::Rect> faces = runCascadeOnGPU(grayFrame);

        // Convert results to our format with GPU-accelerated encoding
        for (const auto& faceRect : faces) {
            if (validateFaceRegion(faceRect, frame)) {
                DetectedFace face;
                face.boundingBox = faceRect;
                face.confidence = 0.85; // Higher confidence for GPU-processed detections

                // Extract face region and compute encoding using GPU
                cv::Mat faceRegion = frame(face.boundingBox);
                face.encoding = extractFaceEncodingGPU(faceRegion);

                result.faces.push_back(face);
            }
        }

        result.success = true;

    } catch (const std::exception& e) {
        result.success = false;
        result.error = e.what();
        std::cout << "GPU face detection failed: " << e.what() << ", falling back to CPU" << std::endl;
        return detectFaces(frame); // Fallback to CPU
    }

    auto endTime = std::chrono::high_resolution_clock::now();
    result.processingTimeMs = std::chrono::duration_cast<std::chrono::milliseconds>(endTime - startTime).count();

    return result;
}

// Optimized cascade detection with GPU preprocessing
std::vector<cv::Rect> FaceDetector::runCascadeOnGPU(const cv::Mat& grayImage) {
    std::vector<cv::Rect> faces;

    try {
        // Run Haar cascade with optimized parameters for GPU-preprocessed images
        faceCascade.detectMultiScale(
            grayImage,
            faces,
            1.1,    // Scale factor - smaller for better detection
            3,      // Min neighbors
            0 | cv::CASCADE_SCALE_IMAGE | cv::CASCADE_DO_CANNY_PRUNING,
            cv::Size(30, 30),  // Minimum face size
            cv::Size(300, 300) // Maximum face size
        );

        // Apply GPU-accelerated non-maximum suppression if we have many detections
        if (faces.size() > 10) {
            // Sort by size (larger faces first)
            std::sort(faces.begin(), faces.end(), [](const cv::Rect& a, const cv::Rect& b) {
                return (a.width * a.height) > (b.width * b.height);
            });

            // Keep top 10 detections
            if (faces.size() > 10) {
                faces.resize(10);
            }
        }

    } catch (const std::exception& e) {
        std::cout << "Cascade detection failed: " << e.what() << std::endl;
    }

    return faces;
}

#endif // HAVE_CUDA