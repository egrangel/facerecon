#ifndef FACE_DETECTOR_H
#define FACE_DETECTOR_H

#include <opencv2/opencv.hpp>
#include <opencv2/dnn.hpp>
#include <opencv2/objdetect.hpp>
#include <memory>
#include <thread>
#include <mutex>
#include <condition_variable>
#include <queue>
#include <future>
#include <atomic>

// Forward declaration of ThreadPool
class ThreadPool;

struct DetectedFace {
    cv::Rect boundingBox;
    float confidence;
    std::vector<cv::Point2f> landmarks;
    std::vector<float> encoding; // Face embedding/encoding for recognition
    // You can add more features here, e.g., facial emotions, etc.
};

struct DetectionResult {
    bool success;
    std::string error;
    std::vector<DetectedFace> faces;
    long long processingTimeMs;
};

class FaceDetector {
public:
    FaceDetector();
    ~FaceDetector();

    /**
     * @brief Initializes the face detector with the specified models.
     * @param modelPath The path to the directory containing the model files (e.g., /path/to/models).
     * @param useDL Set to true to use deep learning models (YuNet/SSD), false for Haar Cascade.
     * @return True if a model was loaded successfully, false otherwise.
     */
    bool initialize(const std::string& modelPath, bool useDL = true);

    /**
     * @brief Detects faces in a given frame.
     * @param frame The input image frame.
     * @return A DetectionResult struct containing the detected faces and processing information.
     */
    DetectionResult detectFaces(const cv::Mat& frame);

    /**
     * @brief Detects faces asynchronously using a thread pool.
     * @param frame The input image frame.
     * @return A future object that will hold the DetectionResult.
     */
    std::future<DetectionResult> detectFacesAsync(const cv::Mat& frame);

    /**
     * @brief Detects faces from a raw image buffer asynchronously.
     * @param buffer The pointer to the image data buffer.
     * @param length The size of the buffer.
     * @return A future object that will hold the DetectionResult.
     */
    std::future<DetectionResult> detectFacesFromBufferAsync(const uint8_t* buffer, size_t length);

    /**
     * @brief Detects faces from a raw image buffer.
     * @param buffer The pointer to the image data buffer.
     * @param length The size of the buffer.
     * @return A DetectionResult struct containing the detected faces and processing information.
     */
    DetectionResult detectFacesFromBuffer(const uint8_t* buffer, size_t length);

    // Getters and setters
    void setConfidenceThreshold(float threshold);
    void setNMSThreshold(float threshold);
    float getConfidenceThreshold() const { return confidenceThreshold; }
    float getNMSThreshold() const { return nmsThreshold; }
    bool isInitialized() const { return initialized; }

private:
    cv::Ptr<cv::FaceDetectorYN> yunetDetector;
    cv::dnn::Net faceNet; // For face detection (UltraFace)
    cv::dnn::Net faceRecognitionNet; // For face recognition (ArcFace/FaceNet)
    cv::CascadeClassifier faceCascade;

    bool useDeepLearning;
    bool useYuNet;
    bool initialized;
    bool useUltraFace;
    bool faceRecognitionInitialized;
    bool useArcFace; // Flag to track which model is loaded

    float confidenceThreshold;
    float nmsThreshold;

    // Thread pool for async operations
    static std::unique_ptr<ThreadPool> threadPool;
    static std::atomic<int> instanceCount;

    // Helper function for simplified face region validation
    bool validateFaceRegion(const cv::Rect& faceRect, const cv::Mat& frame);

    // Helper function to extract face encodings using FaceNet
    std::vector<float> extractFaceEncoding(const cv::Mat& frame, const cv::Rect& faceRect);
};

#endif // FACE_DETECTOR_H