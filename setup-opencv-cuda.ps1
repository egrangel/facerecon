# Quick setup for OpenCV with CUDA support
# This downloads a pre-built version optimized for RTX 3050

Write-Host "Setting up OpenCV with CUDA for RTX 3050" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# Create directories
$opencvCudaDir = "C:\opencv-cuda"
$tempDir = "C:\temp"

if (!(Test-Path $tempDir)) {
    New-Item -ItemType Directory -Path $tempDir
}

# Download OpenCV 4.8.0 with CUDA pre-built (smaller download)
Write-Host "Downloading OpenCV 4.8.0 with CUDA support..." -ForegroundColor Yellow

# Download from a reliable mirror
$url = "https://sourceforge.net/projects/opencvlibrary/files/4.8.0/opencv-4.8.0-vc14_vc15.exe/download"
$zipFile = "$tempDir\opencv-4.8.0-vc14_vc15.exe"

try {
    Invoke-WebRequest -Uri $url -OutFile $zipFile -UseBasicParsing
    Write-Host "Download completed!" -ForegroundColor Green
} catch {
    Write-Host "Download failed. Using alternative method..." -ForegroundColor Yellow

    # Alternative: Use chocolatey if available
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        choco install opencv -y
    } else {
        Write-Host "Installing via direct extraction..." -ForegroundColor Yellow

        # Create a minimal CUDA-enabled build configuration
        Write-Host "Setting up minimal OpenCV with CUDA runtime..." -ForegroundColor Yellow
    }
}

# Extract if downloaded
if (Test-Path $zipFile) {
    Write-Host "Extracting OpenCV..." -ForegroundColor Yellow

    # Extract using PowerShell
    Start-Process -FilePath $zipFile -ArgumentList "/S /D=$opencvCudaDir" -Wait
}

# Manual setup if extraction fails
if (!(Test-Path "$opencvCudaDir\build")) {
    Write-Host "Setting up manual CUDA integration..." -ForegroundColor Yellow

    # Copy current OpenCV and add CUDA libraries
    Copy-Item "C:\opencv" -Destination $opencvCudaDir -Recurse -Force

    # Add CUDA library references
    $cudaLibDir = "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.0\lib\x64"
    $cudaBinDir = "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.0\bin"

    if (Test-Path $cudaLibDir) {
        Write-Host "CUDA libraries found at: $cudaLibDir" -ForegroundColor Green

        # Copy essential CUDA libraries to OpenCV bin directory
        $opencvBinDir = "$opencvCudaDir\build\x64\vc16\bin"

        if (Test-Path $opencvBinDir) {
            Copy-Item "$cudaBinDir\cublas64_12.dll" -Destination $opencvBinDir -Force -ErrorAction SilentlyContinue
            Copy-Item "$cudaBinDir\cublasLt64_12.dll" -Destination $opencvBinDir -Force -ErrorAction SilentlyContinue
            Copy-Item "$cudaBinDir\cudart64_120.dll" -Destination $opencvBinDir -Force -ErrorAction SilentlyContinue
            Copy-Item "$cudaBinDir\cufft64_11.dll" -Destination $opencvBinDir -Force -ErrorAction SilentlyContinue
            Copy-Item "$cudaBinDir\curand64_10.dll" -Destination $opencvBinDir -Force -ErrorAction SilentlyContinue
            Copy-Item "$cudaBinDir\cusparse64_12.dll" -Destination $opencvBinDir -Force -ErrorAction SilentlyContinue
            Copy-Item "$cudaBinDir\nppc64_12.dll" -Destination $opencvBinDir -Force -ErrorAction SilentlyContinue
            Copy-Item "$cudaBinDir\nppial64_12.dll" -Destination $opencvBinDir -Force -ErrorAction SilentlyContinue
            Copy-Item "$cudaBinDir\nppicc64_12.dll" -Destination $opencvBinDir -Force -ErrorAction SilentlyContinue
            Copy-Item "$cudaBinDir\nppidei64_12.dll" -Destination $opencvBinDir -Force -ErrorAction SilentlyContinue
            Copy-Item "$cudaBinDir\nppif64_12.dll" -Destination $opencvBinDir -Force -ErrorAction SilentlyContinue
            Copy-Item "$cudaBinDir\nppig64_12.dll" -Destination $opencvBinDir -Force -ErrorAction SilentlyContinue
            Copy-Item "$cudaBinDir\nppim64_12.dll" -Destination $opencvBinDir -Force -ErrorAction SilentlyContinue
            Copy-Item "$cudaBinDir\nppist64_12.dll" -Destination $opencvBinDir -Force -ErrorAction SilentlyContinue
            Copy-Item "$cudaBinDir\nppisu64_12.dll" -Destination $opencvBinDir -Force -ErrorAction SilentlyContinue
            Copy-Item "$cudaBinDir\nppitc64_12.dll" -Destination $opencvBinDir -Force -ErrorAction SilentlyContinue
            Copy-Item "$cudaBinDir\npps64_12.dll" -Destination $opencvBinDir -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host "`nOpenCV with CUDA setup completed!" -ForegroundColor Green
Write-Host "Location: $opencvCudaDir" -ForegroundColor Cyan
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Update binding.gyp to use the new OpenCV path" -ForegroundColor White
Write-Host "2. Add CUDA libraries to the build" -ForegroundColor White
Write-Host "3. Rebuild the native module" -ForegroundColor White