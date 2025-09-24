#include "face_detector.h"
#include <chrono>
#include <iostream>
#include <fstream>

FaceDetector::FaceDetector()
    : useDeepLearning(true), confidenceThreshold(0.3f), nmsThreshold(0.4f), initialized(false) {}

FaceDetector::~FaceDetector() {}

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
                            face.encoding = extractFaceEncoding(faceRegion);

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
                    face.encoding = extractFaceEncoding(faceRegion);

                    result.faces.push_back(face);
                }
            }
        }

        // Multi-scale detection: if we found few faces or low confidence faces, try with zoomed regions
        if (result.faces.size() < 3 || (result.faces.size() > 0 && result.faces[0].confidence < 0.3)) {
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
                            face.encoding = extractFaceEncoding(faceRegion);

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
                    face.encoding = extractFaceEncoding(faceRegion);

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

        // Normalize face to standard size for consistent encoding
        cv::Mat normalizedFace;
        cv::Size targetSize(96, 96); // Standard face recognition size
        cv::resize(face, normalizedFace, targetSize);

        // Convert to grayscale if needed
        if (normalizedFace.channels() == 3) {
            cv::cvtColor(normalizedFace, normalizedFace, cv::COLOR_BGR2GRAY);
        }

        // Normalize pixel values to improve recognition accuracy
        cv::Mat floatFace;
        normalizedFace.convertTo(floatFace, CV_32FC1, 1.0/255.0);

        // Apply histogram equalization for better feature extraction
        cv::Mat equalizedFace;
        cv::equalizeHist(normalizedFace, equalizedFace);
        equalizedFace.convertTo(floatFace, CV_32FC1, 1.0/255.0);

        // Extract statistical features
        cv::Scalar meanVal, stdDevVal;
        cv::meanStdDev(floatFace, meanVal, stdDevVal);
        encoding.push_back(static_cast<float>(meanVal[0])); // Mean intensity
        encoding.push_back(static_cast<float>(stdDevVal[0])); // Standard deviation

        // Extract spatial features using image moments
        cv::Moments moments = cv::moments(floatFace);
        encoding.push_back(static_cast<float>(moments.m10 / moments.m00)); // Centroid X
        encoding.push_back(static_cast<float>(moments.m01 / moments.m00)); // Centroid Y
        encoding.push_back(static_cast<float>(moments.m20 / moments.m00)); // Second moment X
        encoding.push_back(static_cast<float>(moments.m02 / moments.m00)); // Second moment Y
        encoding.push_back(static_cast<float>(moments.m11 / moments.m00)); // Second moment XY

        // Extract texture features using Local Binary Pattern (simplified)
        int step = 16; // Increase step size to reduce features
        for (int y = 1; y < floatFace.rows - 1; y += step) {
            for (int x = 1; x < floatFace.cols - 1; x += step) {
                if (encoding.size() >= ENCODING_SIZE - 10) { // Leave room for final features
                    break;
                }

                float center = floatFace.at<float>(y, x);
                int pattern = 0;

                // 8-neighbor LBP pattern
                if (floatFace.at<float>(y-1, x-1) >= center) pattern |= (1 << 0);
                if (floatFace.at<float>(y-1, x  ) >= center) pattern |= (1 << 1);
                if (floatFace.at<float>(y-1, x+1) >= center) pattern |= (1 << 2);
                if (floatFace.at<float>(y,   x+1) >= center) pattern |= (1 << 3);
                if (floatFace.at<float>(y+1, x+1) >= center) pattern |= (1 << 4);
                if (floatFace.at<float>(y+1, x  ) >= center) pattern |= (1 << 5);
                if (floatFace.at<float>(y+1, x-1) >= center) pattern |= (1 << 6);
                if (floatFace.at<float>(y,   x-1) >= center) pattern |= (1 << 7);

                encoding.push_back(static_cast<float>(pattern / 255.0)); // Normalize to [0,1]
            }

            if (encoding.size() >= ENCODING_SIZE - 10) {
                break;
            }
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