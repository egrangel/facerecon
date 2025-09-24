#pragma once
#include <opencv2/opencv.hpp>
#include <opencv2/dnn.hpp>
#include <vector>
#include <string>
#include <thread>
#include <future>
#include <queue>
#include <functional>
#include <condition_variable>
#include <atomic>

// Try to include CUDA support if available
#ifdef HAVE_CUDA
#include <opencv2/imgproc/imgproc.hpp>
#include <cuda_runtime.h>
#include <cuda.h>
#include <cublas_v2.h>
#include <curand.h>
// Basic CUDA runtime support without full OpenCV CUDA integration
#endif

struct DetectedFace {
    cv::Rect boundingBox;
    double confidence;
    std::vector<cv::Point2f> landmarks;
    std::vector<float> encoding; // Face encoding for recognition
};

struct DetectionResult {
    std::vector<DetectedFace> faces;
    bool success;
    std::string error;
    int processingTimeMs;
};

// Thread Pool for parallel face detection
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

class FaceDetector {
private:
    cv::dnn::Net faceNet;
    cv::CascadeClassifier faceCascade;
    bool useDeepLearning;
    float confidenceThreshold;
    float nmsThreshold;
    bool initialized;

    // Thread pool for parallel processing
    static std::unique_ptr<ThreadPool> threadPool;
    static std::atomic<int> instanceCount;

    // GPU acceleration support
    bool useGPU;
    bool gpuAvailable;

#ifdef HAVE_CUDA
    // Basic CUDA runtime support
    cudaDeviceProp deviceProp;
    int cudaDeviceId;

    // CUDA streams for async operations
    cudaStream_t processStream;

    // GPU memory management
    float* d_imageBuffer;
    float* d_processedBuffer;
    size_t gpuBufferSize;

    // GPU face detection buffers
    unsigned char* d_grayImage;
    float* d_integralImage;
    int* d_detectionResults;
    size_t maxImageSize;
#endif

public:
    FaceDetector();
    ~FaceDetector();

    bool initialize(const std::string& modelPath = "", bool useDL = true);
    DetectionResult detectFaces(const cv::Mat& frame);
    DetectionResult detectFacesFromBuffer(const uint8_t* buffer, size_t length);

    // Async detection using thread pool
    std::future<DetectionResult> detectFacesAsync(const cv::Mat& frame);
    std::future<DetectionResult> detectFacesFromBufferAsync(const uint8_t* buffer, size_t length);
    void setConfidenceThreshold(float threshold);
    void setNMSThreshold(float threshold);
    bool isInitialized() const { return initialized; }
    std::vector<float> extractFaceEncoding(const cv::Mat& face);

    // GPU acceleration methods
    bool initializeGPU();
    void cleanupGPU();
    std::vector<float> extractFaceEncodingGPU(const cv::Mat& face);

    // GPU face detection methods
    DetectionResult detectFacesGPU(const cv::Mat& frame);
    std::vector<cv::Rect> runCascadeOnGPU(const cv::Mat& image);

private:
    bool validateFaceRegion(const cv::Rect& faceRect, const cv::Mat& frame);
    bool isElectronicDisplay(const cv::Mat& faceRegion, const cv::Mat& faceGray);
     bool isOverlapping(const DetectedFace& newFace, const std::vector<DetectedFace>& existingFaces);
    DetectionResult detectFacesInRegion(const cv::Mat& region);
};