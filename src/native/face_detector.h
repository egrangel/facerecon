#pragma once
#include <opencv2/opencv.hpp>
#include <vector>
#include <string>

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

class FaceDetector {
private:
    cv::dnn::Net faceNet;
    cv::CascadeClassifier faceCascade;
    bool useDeepLearning;
    float confidenceThreshold;
    float nmsThreshold;
    bool initialized;

public:
    FaceDetector();
    ~FaceDetector();

    bool initialize(const std::string& modelPath = "", bool useDL = true);
    DetectionResult detectFaces(const cv::Mat& frame);
    DetectionResult detectFacesFromBuffer(const uint8_t* buffer, size_t length);
    void setConfidenceThreshold(float threshold);
    void setNMSThreshold(float threshold);
    bool isInitialized() const { return initialized; }
    std::vector<float> extractFaceEncoding(const cv::Mat& face);

private:
    bool validateFaceRegion(const cv::Rect& faceRect, const cv::Mat& frame);
    bool isElectronicDisplay(const cv::Mat& faceRegion, const cv::Mat& faceGray);
};