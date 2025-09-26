#include "face_detector.h"
#include <chrono>
#include <iostream>
#include <fstream>
#include <algorithm>
#include <thread>
#include <future>
#include <atomic>
#include <vector>

// Forward declarations for helper functions
bool is_file_exist(const std::string& path);

// Thread Pool Implementation
class ThreadPool {
public:
    ThreadPool(size_t numThreads);
    ~ThreadPool();

    template<typename F, typename... Args>
    auto enqueue(F&& f, Args&&... args) -> std::future<typename std::result_of<F(Args...)>::type>;

private:
    std::vector<std::thread> workers;
    std::queue<std::function<void()>> tasks;
    std::mutex queueMutex;
    std::condition_variable condition;
    bool stop;
};

ThreadPool::ThreadPool(size_t numThreads) : stop(false) {
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
    for (std::thread& worker : workers) {
        if (worker.joinable()) {
            worker.join();
        }
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

// Initialize static members
std::unique_ptr<ThreadPool> FaceDetector::threadPool = nullptr;
std::atomic<int> FaceDetector::instanceCount(0);

// Helper function to check file existence
bool is_file_exist(const std::string& path) {
    std::ifstream f(path.c_str());
    return f.good();
}

FaceDetector::FaceDetector()
    : useDeepLearning(true), useUltraFace(false), confidenceThreshold(0.6f), nmsThreshold(0.3f), initialized(false), faceRecognitionInitialized(false) {

    // Safely initialize the thread pool
    instanceCount++;
    if (!threadPool) {
        static std::once_flag onceFlag;
        std::call_once(onceFlag, []() {
            threadPool = std::make_unique<ThreadPool>(0);
            std::cout << "Initialized thread pool with " << std::thread::hardware_concurrency() << " threads" << std::endl;
        });
    }
}

FaceDetector::~FaceDetector() {
    instanceCount--;
    if (instanceCount == 0 && threadPool) {
        threadPool.reset();
        std::cout << "Thread pool destroyed" << std::endl;
    }
}

bool FaceDetector::initialize(const std::string& modelPath, bool useDL) {
    useDeepLearning = useDL;
    initialized = false;

    // Reset detectors
    faceNet = cv::dnn::Net(); // Reset by assignment
    faceRecognitionNet = cv::dnn::Net(); // Reset face recognition net
    faceRecognitionInitialized = false;

    std::cout << "Initializing face detector..." << std::endl;

    // --- FaceNet Model for Recognition ---
    std::string faceNetModel = modelPath + "/facenet/facenet.onnx";
    std::cout << "Checking for FaceNet model at: " << faceNetModel << std::endl;
    if (is_file_exist(faceNetModel)) {
        try {
            std::cout << "Attempting to load FaceNet model..." << std::endl;
            faceRecognitionNet = cv::dnn::readNetFromONNX(faceNetModel);
            if (!faceRecognitionNet.empty()) {
                faceRecognitionNet.setPreferableBackend(cv::dnn::DNN_BACKEND_OPENCV);
                faceRecognitionNet.setPreferableTarget(cv::dnn::DNN_TARGET_CPU);
                std::cout << "FaceNet model loaded successfully for face recognition." << std::endl;
                faceRecognitionInitialized = true;
            }
        } catch (const std::exception& e) {
            std::cerr << "FaceNet model loading failed: " << e.what() << std::endl;
        }
    } else {
        std::cout << "FaceNet model file not found - face recognition will be disabled." << std::endl;
    }

    if (useDeepLearning) {
        // --- UltraFace Model ---
        std::string ultraFaceModel = modelPath + "/retinaface/version-RFB-320.onnx";
        std::cout << "Checking for UltraFace model at: " << ultraFaceModel << std::endl;
        if (is_file_exist(ultraFaceModel)) {
            try {
                std::cout << "Attempting to load UltraFace model..." << std::endl;
                faceNet = cv::dnn::readNetFromONNX(ultraFaceModel);
                if (!faceNet.empty()) {
                    faceNet.setPreferableBackend(cv::dnn::DNN_BACKEND_OPENCV);
                    faceNet.setPreferableTarget(cv::dnn::DNN_TARGET_CPU);
                    std::cout << "UltraFace model loaded successfully." << std::endl;
                    useUltraFace = true;
                    initialized = true;
                    return true;
                }
            } catch (const std::exception& e) {
                std::cerr << "UltraFace model loading failed: " << e.what() << std::endl;
            }
        } else {
            std::cout << "UltraFace model file not found." << std::endl;
        }
    }

    // --- Haar Cascade Fallback ---
    std::cout << "Attempting to load Haar Cascade..." << std::endl;
    std::vector<std::string> cascadePaths = {
        "C:/opencv/build/etc/haarcascades/haarcascade_frontalface_alt.xml",
        "C:/opencv/sources/data/haarcascades/haarcascade_frontalface_alt.xml",
        "C:/opencv/build/etc/haarcascades/haarcascade_frontalface_default.xml",
        "C:/opencv/sources/data/haarcascades/haarcascade_frontalface_default.xml"
    };
    for (const auto& cascadePath : cascadePaths) {
        if (faceCascade.load(cascadePath)) {
            std::cout << "Haar Cascade loaded from: " << cascadePath << std::endl;
            useDeepLearning = false;
            initialized = true;
            return true;
        }
    }

    std::cerr << "Failed to load any face detection model." << std::endl;
    return false;
}

DetectionResult FaceDetector::detectFaces(const cv::Mat& frame) {
    DetectionResult result;
    auto startTime = std::chrono::high_resolution_clock::now();

    if (!initialized || frame.empty()) {
        std::cerr << "Face detector not initialized or frame is empty!" << std::endl;
        result.success = false;
        result.error = "Detector not initialized or empty frame";
        return result;
    }

    std::cout << "Face detection starting, frame size: " << frame.cols << "x" << frame.rows << std::endl;

    try {
        if (useDeepLearning && useUltraFace) {
            // UltraFace detection
            std::cout << "Using UltraFace detection..." << std::endl;

            // Prepare input blob - UltraFace expects 320x240 input
            cv::Mat blob = cv::dnn::blobFromImage(frame, 1.0 / 128.0, cv::Size(320, 240), cv::Scalar(127, 127, 127), true, false);
            faceNet.setInput(blob);

            // Forward pass
            std::vector<cv::Mat> outputs;
            faceNet.forward(outputs, faceNet.getUnconnectedOutLayersNames());

            // Process outputs - UltraFace has two outputs: boxes and scores
            if (outputs.size() >= 2) {
                cv::Mat boxes = outputs[0]; // Shape: [1, num_anchors, 4]
                cv::Mat scores = outputs[1]; // Shape: [1, num_anchors, 2]

                std::cout << "UltraFace outputs - boxes: " << boxes.size << ", scores: " << scores.size << std::endl;

                // Extract detections
                int numAnchors = boxes.size[1];
                for (int i = 0; i < numAnchors; i++) {
                    // Get face score (class 1, background is class 0)
                    float score = scores.at<float>(0, i, 1);

                    if (score > confidenceThreshold) {
                        // Extract box coordinates (normalized)
                        float x1 = boxes.at<float>(0, i, 0);
                        float y1 = boxes.at<float>(0, i, 1);
                        float x2 = boxes.at<float>(0, i, 2);
                        float y2 = boxes.at<float>(0, i, 3);

                        // Convert to pixel coordinates
                        int px1 = static_cast<int>(x1 * frame.cols);
                        int py1 = static_cast<int>(y1 * frame.rows);
                        int px2 = static_cast<int>(x2 * frame.cols);
                        int py2 = static_cast<int>(y2 * frame.rows);

                        cv::Rect faceRect(px1, py1, px2 - px1, py2 - py1);

                        if (validateFaceRegion(faceRect, frame)) {
                            DetectedFace face;
                            face.boundingBox = faceRect;
                            face.confidence = score;

                            // Extract face encoding using FaceNet
                            face.encoding = extractFaceEncoding(frame, faceRect);

                            result.faces.push_back(face);
                            std::cout << "Added UltraFace detection: conf=" << score << ", rect=" << faceRect.x << "," << faceRect.y << "," << faceRect.width << "," << faceRect.height
                                      << ", encoding_size=" << face.encoding.size() << std::endl;
                        }
                    }
                }
            }
        } else {
            // Haar cascade detection
            std::cout << "Using Haar Cascade detection..." << std::endl;
            std::vector<cv::Rect> faces;
            cv::Mat grayFrame;
            cv::cvtColor(frame, grayFrame, cv::COLOR_BGR2GRAY);
            cv::equalizeHist(grayFrame, grayFrame);
            faceCascade.detectMultiScale(grayFrame, faces, 1.15, 4, 0 | cv::CASCADE_SCALE_IMAGE, cv::Size(30, 30), cv::Size(400, 400));
            for (const auto& faceRect : faces) {
                if (validateFaceRegion(faceRect, frame)) {
                    DetectedFace face;
                    face.boundingBox = faceRect;
                    face.confidence = 0.75;

                    // Extract face encoding using FaceNet
                    face.encoding = extractFaceEncoding(frame, faceRect);

                    result.faces.push_back(face);
                    std::cout << "Added Haar Cascade detection: rect=" << faceRect.x << "," << faceRect.y << "," << faceRect.width << "," << faceRect.height
                              << ", encoding_size=" << face.encoding.size() << std::endl;
                }
            }
        }
        result.success = true;
    } catch (const std::exception& e) {
        result.success = false;
        result.error = e.what();
        std::cerr << "Detection failed: " << e.what() << std::endl;
    }

    auto endTime = std::chrono::high_resolution_clock::now();
    result.processingTimeMs = std::chrono::duration_cast<std::chrono::milliseconds>(endTime - startTime).count();
    std::cout << "Detected " << result.faces.size() << " faces in " << result.processingTimeMs << "ms." << std::endl;
    return result;
}

// Simplified and reliable face region validation
bool FaceDetector::validateFaceRegion(const cv::Rect& faceRect, const cv::Mat& frame) {
    if (faceRect.width <= 0 || faceRect.height <= 0 || faceRect.x < 0 || faceRect.y < 0) return false;
    if (faceRect.x + faceRect.width > frame.cols || faceRect.y + faceRect.height > frame.rows) return false;

    float aspectRatio = static_cast<float>(faceRect.width) / faceRect.height;
    if (aspectRatio < 0.6f || aspectRatio > 1.4f) return false;
    if (faceRect.width < 30 || faceRect.height < 30) return false;

    cv::Mat faceRegion = frame(faceRect);
    if (faceRegion.empty()) return false;

    // Check for extreme brightness
    cv::Mat grayRegion;
    cv::cvtColor(faceRegion, grayRegion, cv::COLOR_BGR2GRAY);
    cv::Scalar mean, stddev;
    cv::meanStdDev(grayRegion, mean, stddev);
    if (mean[0] < 20 || mean[0] > 230) return false;

    return true;
}

DetectionResult FaceDetector::detectFacesFromBuffer(const uint8_t* buffer, size_t length) {
    DetectionResult result;
    try {
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

// Async detection methods using thread pool
std::future<DetectionResult> FaceDetector::detectFacesAsync(const cv::Mat& frame) {
    if (!threadPool) {
        std::promise<DetectionResult> promise;
        promise.set_value(detectFaces(frame));
        return promise.get_future();
    }
    cv::Mat frameCopy = frame.clone();
    return threadPool->enqueue([this, frameCopy]() -> DetectionResult {
        return this->detectFaces(frameCopy);
    });
}

std::future<DetectionResult> FaceDetector::detectFacesFromBufferAsync(const uint8_t* buffer, size_t length) {
    if (!threadPool) {
        std::promise<DetectionResult> promise;
        promise.set_value(detectFacesFromBuffer(buffer, length));
        return promise.get_future();
    }
    std::vector<uint8_t> bufferCopy(buffer, buffer + length);
    return threadPool->enqueue([this, bufferCopy]() -> DetectionResult {
        return this->detectFacesFromBuffer(bufferCopy.data(), bufferCopy.size());
    });
}

void FaceDetector::setConfidenceThreshold(float threshold) {
    confidenceThreshold = threshold;
}

void FaceDetector::setNMSThreshold(float threshold) {
    nmsThreshold = threshold;
}

std::vector<float> FaceDetector::extractFaceEncoding(const cv::Mat& frame, const cv::Rect& faceRect) {
    std::vector<float> encoding;

    if (!faceRecognitionInitialized || faceRecognitionNet.empty()) {
        std::cout << "FaceNet not initialized - returning empty encoding" << std::endl;
        return encoding;
    }

    try {
        // Extract face region and ensure it's valid
        cv::Rect safeFaceRect = faceRect & cv::Rect(0, 0, frame.cols, frame.rows);
        if (safeFaceRect.width <= 0 || safeFaceRect.height <= 0) {
            std::cout << "Invalid face rectangle - returning empty encoding" << std::endl;
            return encoding;
        }

        cv::Mat faceImage = frame(safeFaceRect);
        if (faceImage.empty()) {
            std::cout << "Empty face image - returning empty encoding" << std::endl;
            return encoding;
        }

        // FaceNet typically expects 160x160 input images
        cv::Mat resizedFace;
        cv::resize(faceImage, resizedFace, cv::Size(160, 160));

        // Create blob from the face image
        // FaceNet usually expects normalized input [0,1] or [-1,1]
        cv::Mat blob = cv::dnn::blobFromImage(resizedFace, 1.0/255.0, cv::Size(160, 160), cv::Scalar(0, 0, 0), true, false);

        // Set input to the network
        faceRecognitionNet.setInput(blob);

        // Forward pass
        cv::Mat output = faceRecognitionNet.forward();

        // Convert output to vector<float>
        if (output.type() == CV_32F && output.total() > 0) {
            float* data = (float*)output.data;
            encoding.assign(data, data + output.total());
            std::cout << "Successfully extracted face encoding with " << encoding.size() << " dimensions" << std::endl;
        } else {
            std::cout << "Invalid FaceNet output format - returning empty encoding" << std::endl;
        }

    } catch (const std::exception& e) {
        std::cerr << "Error extracting face encoding: " << e.what() << std::endl;
    }

    return encoding;
}