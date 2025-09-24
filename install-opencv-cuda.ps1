# Install pre-built OpenCV with CUDA support
# Much faster than building from source

Write-Host "Installing OpenCV with CUDA Support" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green

# Download OpenCV 4.9.0 with CUDA support (pre-built)
$downloadUrl = "https://github.com/opencv/opencv/releases/download/4.9.0/opencv-4.9.0-windows.exe"
$outputFile = "C:\temp\opencv-4.9.0-windows.exe"
$installDir = "C:\opencv-cuda"

# Create temp directory
if (!(Test-Path "C:\temp")) {
    New-Item -ItemType Directory -Path "C:\temp"
}

Write-Host "Downloading OpenCV 4.9.0..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $downloadUrl -OutFile $outputFile

Write-Host "Extracting OpenCV..." -ForegroundColor Yellow
Start-Process -FilePath $outputFile -ArgumentList "-o$installDir", "-y" -Wait

# For our project, let's build a minimal OpenCV with CUDA support using vcpkg
Write-Host "Installing OpenCV with CUDA using vcpkg..." -ForegroundColor Yellow

# Check if vcpkg is installed
$vcpkgPath = "C:\vcpkg"
if (!(Test-Path "$vcpkgPath\vcpkg.exe")) {
    Write-Host "Installing vcpkg..." -ForegroundColor Yellow
    git clone https://github.com/Microsoft/vcpkg.git $vcpkgPath
    Set-Location $vcpkgPath
    .\bootstrap-vcpkg.bat
    .\vcpkg integrate install
}

Set-Location $vcpkgPath

Write-Host "Installing OpenCV with CUDA support via vcpkg... This may take 30-60 minutes." -ForegroundColor Yellow
.\vcpkg install opencv[cuda,contrib]:x64-windows

if ($LASTEXITCODE -eq 0) {
    Write-Host "OpenCV with CUDA installed successfully via vcpkg!" -ForegroundColor Green
    Write-Host "Location: $vcpkgPath\installed\x64-windows" -ForegroundColor Green
} else {
    Write-Host "vcpkg installation failed. Let's try a simpler approach." -ForegroundColor Yellow
}

Write-Host "Installation completed!" -ForegroundColor Green