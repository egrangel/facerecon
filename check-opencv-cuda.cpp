#include <opencv2/opencv.hpp>
#include <iostream>

int main() {
    std::cout << "OpenCV version: " << cv::getBuildInformation() << std::endl;
    std::cout << "\nCUDA devices: " << cv::cuda::getCudaEnabledDeviceCount() << std::endl;

    // Check DNN backends
    auto backends = cv::dnn::getAvailableBackends();

    std::cout << "\nAvailable DNN backends:\n";
    for (const auto& backend : backends) {
        std::cout << "Backend: " << backend.first << ", Target: " << backend.second << std::endl;
    }

    return 0;
}