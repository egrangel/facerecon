# Build OpenCV with CUDA support
# Run this script as Administrator

Write-Host "Building OpenCV with CUDA Support" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

# Set environment variables
$env:CUDA_PATH = "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.0"
$env:PATH = "$env:CUDA_PATH\bin;$env:PATH"

# Create build directory
$buildDir = "C:\opencv-cuda-build"
$installDir = "C:\opencv-cuda"

if (Test-Path $buildDir) {
    Remove-Item $buildDir -Recurse -Force
}
New-Item -ItemType Directory -Path $buildDir

if (Test-Path $installDir) {
    Remove-Item $installDir -Recurse -Force
}
New-Item -ItemType Directory -Path $installDir

# Clone OpenCV and OpenCV contrib (if not exists)
$opencvDir = "C:\opencv-source"
$opencvContribDir = "C:\opencv-contrib-source"

if (!(Test-Path $opencvDir)) {
    Write-Host "Cloning OpenCV..." -ForegroundColor Yellow
    git clone https://github.com/opencv/opencv.git $opencvDir
}

if (!(Test-Path $opencvContribDir)) {
    Write-Host "Cloning OpenCV contrib..." -ForegroundColor Yellow
    git clone https://github.com/opencv/opencv_contrib.git $opencvContribDir
}

# Enter build directory
Set-Location $buildDir

Write-Host "Configuring OpenCV with CUDA..." -ForegroundColor Yellow

# Configure with CMake
cmake -G "Visual Studio 17 2022" -A x64 `
    -D CMAKE_BUILD_TYPE=Release `
    -D CMAKE_INSTALL_PREFIX="$installDir" `
    -D OPENCV_EXTRA_MODULES_PATH="$opencvContribDir\modules" `
    -D WITH_CUDA=ON `
    -D WITH_CUDNN=ON `
    -D OPENCV_DNN_CUDA=ON `
    -D WITH_CUBLAS=ON `
    -D WITH_CUFFT=ON `
    -D WITH_NVCUVID=ON `
    -D CUDA_FAST_MATH=ON `
    -D CUDA_ARCH_BIN="8.6" `
    -D CUDA_ARCH_PTX="8.6" `
    -D BUILD_opencv_world=ON `
    -D BUILD_EXAMPLES=OFF `
    -D BUILD_TESTS=OFF `
    -D BUILD_PERF_TESTS=OFF `
    -D BUILD_opencv_java=OFF `
    -D BUILD_opencv_python2=OFF `
    -D BUILD_opencv_python3=OFF `
    "$opencvDir"

if ($LASTEXITCODE -ne 0) {
    Write-Host "CMake configuration failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Building OpenCV... This will take 30-60 minutes." -ForegroundColor Yellow
cmake --build . --config Release --parallel 8

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Installing OpenCV..." -ForegroundColor Yellow
cmake --install . --config Release

Write-Host "OpenCV with CUDA built successfully!" -ForegroundColor Green
Write-Host "Installation location: $installDir" -ForegroundColor Green

# Update environment variable suggestion
Write-Host "`nTo use this OpenCV build, update your environment:" -ForegroundColor Cyan
Write-Host "  Set OPENCV_DIR=$installDir" -ForegroundColor Cyan